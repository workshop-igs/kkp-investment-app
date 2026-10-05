import time

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.models import Count

from analitik.models import SkorKelayakanZona
from analitik.services.konstanta import (
    BOBOT_RISIKO_LINGKUNGAN,
    BOBOT_SKOR_ZONA,
    GMW_TAHUN_AKHIR,
    kelas_risiko_investasi as hitung_kelas_risiko,
    risiko_sosial as hitung_risiko_sosial,
    skor_sosial_ekonomi,
    EKOSISTEM_LANTAI_CAKUPAN,
    HAZARD_LINGKUNGAN_WEIGHTS,
    HAZARD_OPERASIONAL_WEIGHTS,
    INFRASTRUKTUR_AKSESIBILITAS,
    KELAS_RISIKO_SCORE,
    LOCATION_WEIGHTS,
    REGULASI_PENALTY,
    RISK_WEIGHTS,
    SENSITIVITAS_EKOSISTEM,
    SPATIAL_DEFAULT_LOCATION,
    SPATIAL_DEFAULT_RISK,
    TATA_RUANG_FAIL_SCORE,
    TATA_RUANG_PASS_SCORE,
    TINGKAT_POTENSI_SCORE,
    kelas_kelayakan,
    rerata_berbobot_berdata,
)
from analitik.services.screening_ruang import BOLEH, _aturan_per_sektor, _ketentuan
from inti.models import Provinsi, SektorInvestasi

KELAS_KE_RISIKO = {
    'RENDAH': KELAS_RISIKO_SCORE['RENDAH'],
    'SEDANG': KELAS_RISIKO_SCORE['SEDANG'],
    'TINGGI': KELAS_RISIKO_SCORE['TINGGI'],
}


def _batas(nilai, bawah=0.0, atas=1.0):
    return max(bawah, min(atas, nilai))


class Command(BaseCommand):
    help = 'Hitung skor kelayakan per zona ruang laut untuk peta tematik.'

    def add_arguments(self, parser):
        parser.add_argument('--provinsi', help='Kode BPS provinsi, mis. 51.')
        parser.add_argument('--sektor', help='Kode sektor, mis. PARIWISATA_BAHARI.')
        parser.add_argument(
            '--lanjutkan',
            action='store_true',
            help='Lewati provinsi yang skornya sudah lengkap.',
        )

    def _bencana(self, provinsi_id):
        with connection.cursor() as c:
            c.execute(
                """
                SELECT z.id, r.jenis,
                       MAX(CASE r.kelas WHEN 'TINGGI' THEN 3
                                        WHEN 'SEDANG' THEN 2 ELSE 1 END)
                FROM inventarisasi_zonasi_ruang_laut z
                JOIN analitik_zona_risiko_bencana r
                  ON ST_Intersects(z.geometry, r.geometry)
                WHERE z.provinsi_id = %s
                GROUP BY 1, 2
                """,
                [provinsi_id],
            )
            hasil = {}
            peringkat = {3: 'TINGGI', 2: 'SEDANG', 1: 'RENDAH'}
            for zona_id, jenis, tingkat in c.fetchall():
                hasil.setdefault(zona_id, {})[jenis] = peringkat[tingkat]
        return hasil

    def _kkprl(self, provinsi_id):
        with connection.cursor() as c:
            c.execute(
                """
                SELECT z.id, COUNT(*)
                FROM inventarisasi_zonasi_ruang_laut z
                JOIN inventarisasi_kkprl k
                  ON ST_Intersects(z.geometry, k.geometry)
                WHERE z.provinsi_id = %s
                GROUP BY 1
                """,
                [provinsi_id],
            )
            return dict(c.fetchall())

    def _aksesibilitas(self, provinsi_id):
        kategori = [k for k, _, _, _ in INFRASTRUKTUR_AKSESIBILITAS]
        nilai = ', '.join(['(%s)'] * len(kategori))
        with connection.cursor() as c:
            c.execute(
                f"""
                SELECT z.id, k.kategori, d.jarak_km
                FROM (
                    SELECT id, ST_PointOnSurface(geometry) AS titik
                    FROM inventarisasi_zonasi_ruang_laut
                    WHERE provinsi_id = %s
                ) z
                CROSS JOIN (VALUES {nilai}) AS k(kategori)
                CROSS JOIN LATERAL (
                    SELECT ST_Distance(z.titik::geography, i.geometry::geography) / 1000
                           AS jarak_km
                    FROM inventarisasi_infrastruktur_pendukung i
                    WHERE i.kategori = k.kategori
                    ORDER BY z.titik <-> i.geometry
                    LIMIT 1
                ) d
                """,
                [provinsi_id] + kategori,
            )
            hasil = {}
            for zona_id, kat, jarak in c.fetchall():
                hasil.setdefault(zona_id, {})[kat] = jarak
        return hasil

    def _ekosistem(self, provinsi_id):
        with connection.cursor() as c:
            c.execute(
                """
                SELECT z.id, e.sumber_data, e.jenis, COALESCE(e.kondisi, ''),
                       SUM(e.luas_ha), COUNT(*)
                FROM inventarisasi_zonasi_ruang_laut z
                JOIN inventarisasi_sumber_daya_alam e
                  ON e.geometry IS NOT NULL
                 AND ST_Intersects(z.geometry, e.geometry)
                WHERE z.provinsi_id = %s
                  AND (
                        e.sumber_data IN ('KKP-EKOSISTEM', 'SIDAKO-LAMUN', 'SIDAKO-KARANG')
                     OR (e.sumber_data = 'GMW-MANGROVE' AND e.tahun_data = %s)
                  )
                GROUP BY 1, 2, 3, 4
                """,
                [provinsi_id, GMW_TAHUN_AKHIR],
            )
            per_sumber = {}
            for zona_id, sumber, jenis, kondisi, luas, n in c.fetchall():
                per_sumber.setdefault(zona_id, {}).setdefault(sumber, []).append(
                    {'jenis': jenis, 'kondisi': kondisi, 'luas_ha': float(luas or 0), 'jumlah': n}
                )

        hasil = {}
        for zona_id, sumber in per_sumber.items():
            hasil[zona_id] = ((sumber.get('KKP-EKOSISTEM') or sumber.get('GMW-MANGROVE') or [])
                              + sumber.get('SIDAKO-LAMUN', []) + sumber.get('SIDAKO-KARANG', []))
        return hasil

    def _sosial(self, provinsi_id):
        with connection.cursor() as c:
            c.execute(
                """
                SELECT z.id, d.nama, d.penduduk_dtks, d.jumlah_nelayan,
                       d.jumlah_penduduk, d.pesisir
                FROM (
                    SELECT id, ST_PointOnSurface(geometry) AS titik
                    FROM inventarisasi_zonasi_ruang_laut
                    WHERE provinsi_id = %s
                ) z
                CROSS JOIN LATERAL (
                    SELECT k.nama, k.penduduk_dtks, k.jumlah_nelayan,
                           k.jumlah_penduduk, k.pesisir
                    FROM inti_kabupaten_kota k
                    WHERE k.geometry IS NOT NULL
                      AND k.jumlah_penduduk > 0
                    ORDER BY z.titik <-> k.geometry
                    LIMIT 1
                ) d
                """,
                [provinsi_id],
            )
            hasil = {}
            for zona_id, nama, dtks, nelayan, penduduk, pesisir in c.fetchall():
                if not penduduk:
                    continue
                hasil[zona_id] = {
                    'kabupaten': nama,
                    'penduduk': penduduk,
                    'pesisir': pesisir,
                    'rasio_dtks': (dtks / penduduk) if dtks else None,
                    'rasio_nelayan': (nelayan / penduduk) if nelayan else None,
                }
        return hasil

    def _adat(self, provinsi_id):
        with connection.cursor() as c:
            c.execute(
                """
                SELECT DISTINCT z.id
                FROM inventarisasi_zonasi_ruang_laut z
                JOIN inventarisasi_unsur_ruang_laut u
                  ON u.kelompok = 'MHA'
                 AND ST_Intersects(z.geometry, u.geometry)
                WHERE z.provinsi_id = %s
                """,
                [provinsi_id],
            )
            return {baris[0] for baris in c.fetchall()}

    def _adat_terdata(self, provinsi_id):
        with connection.cursor() as c:
            c.execute(
                """
                SELECT EXISTS (
                  SELECT 1 FROM inventarisasi_unsur_ruang_laut
                  WHERE kelompok = 'MHA' AND provinsi_id = %s
                )
                """,
                [provinsi_id],
            )
            return bool(c.fetchone()[0])

    def _potensi(self, provinsi_id):
        with connection.cursor() as c:
            c.execute(
                """
                SELECT z.id, p.tingkat_potensi, s.kode
                FROM inventarisasi_zonasi_ruang_laut z
                JOIN inventarisasi_potensi_investasi p
                  ON ST_Intersects(z.geometry, p.geometry)
                LEFT JOIN inti_sektor_investasi s ON s.id = p.sektor_id
                WHERE z.provinsi_id = %s
                """,
                [provinsi_id],
            )
            hasil = {}
            for zona_id, tingkat, sektor_kode in c.fetchall():
                hasil.setdefault(zona_id, []).append((tingkat, sektor_kode))
        return hasil

    def _skor(self, sub_zona, sesuai, sektor_kode, bencana, jarak, potensi, n_kkprl,
              ekosistem, luas_zona, sosial, ada_adat, adat_terdata):
        skor_tr = TATA_RUANG_PASS_SCORE if sesuai else TATA_RUANG_FAIL_SCORE

        skor_potensi = SPATIAL_DEFAULT_LOCATION['potensi_sda']
        if potensi:
            terbaik = 0.0
            for tingkat, kode_sektor in potensi:
                dasar = TINGKAT_POTENSI_SCORE.get(tingkat, 0.5)
                terbaik = max(terbaik, dasar if kode_sektor == sektor_kode else dasar * 0.8)
            skor_potensi = terbaik

        total_bobot = total_nilai = 0.0
        terdekat = None
        for kategori, bobot, ideal_km, maks_km in INFRASTRUKTUR_AKSESIBILITAS:
            km = jarak.get(kategori)
            if km is None:
                continue
            if km <= ideal_km:
                nilai = 1.0
            elif km >= maks_km:
                nilai = 0.1
            else:
                nilai = 1.0 - (km - ideal_km) / (maks_km - ideal_km) * 0.9
            total_bobot += bobot
            total_nilai += nilai * bobot
            terdekat = km if terdekat is None else min(terdekat, km)
        skor_akses = (
            _batas(total_nilai / total_bobot)
            if total_bobot
            else SPATIAL_DEFAULT_LOCATION['aksesibilitas']
        )

        skor_sosek = skor_sosial_ekonomi(
            (sosial or {}).get('penduduk', 0), (sosial or {}).get('pesisir', False)
        )
        ada_sosek = skor_sosek is not None
        if not ada_sosek:
            skor_sosek = SPATIAL_DEFAULT_LOCATION['kondisi_sosek']

        skor_lokasi, _ = rerata_berbobot_berdata({
            'tata_ruang': (skor_tr, LOCATION_WEIGHTS['tata_ruang'], True),
            'potensi_sda': (skor_potensi, LOCATION_WEIGHTS['potensi_sda'], bool(potensi)),
            'aksesibilitas': (skor_akses, LOCATION_WEIGHTS['aksesibilitas'], total_bobot > 0),
            'sosial_ekonomi': (skor_sosek, LOCATION_WEIGHTS['sosial_ekonomi'], ada_sosek),
        })

        def tekanan(bobot_map):
            total_b = total_n = 0.0
            for jenis, kelas in bencana.items():
                bobot = bobot_map.get(jenis, 0)
                if not bobot:
                    continue
                total_b += bobot
                total_n += KELAS_KE_RISIKO.get(kelas, 0.4) * bobot
            return total_n / total_b if total_b else SPATIAL_DEFAULT_RISK['operasional']

        risiko_operasional = tekanan(HAZARD_OPERASIONAL_WEIGHTS)
        tekanan_bencana = tekanan(HAZARD_LINGKUNGAN_WEIGHTS)

        sensitivitas = None
        ekosistem_rincian = []
        if ekosistem:
            dasar = 0.0
            luas_total = 0.0
            for e in ekosistem:
                nilai = SENSITIVITAS_EKOSISTEM.get(
                    (e['jenis'], e['kondisi']),
                    SENSITIVITAS_EKOSISTEM.get((e['jenis'], ''), 0.5),
                )
                dasar = max(dasar, nilai)
                luas_total += e['luas_ha']
                ekosistem_rincian.append(
                    f"{e['jenis'].replace('_', ' ').title()}"
                    + (f" ({e['kondisi']})" if e['kondisi'] else '')
                    + f" {e['jumlah']} objek"
                )
            nisbah = min(1.0, luas_total / luas_zona) if luas_zona else 1.0
            sensitivitas = _batas(
                dasar * (EKOSISTEM_LANTAI_CAKUPAN + (1 - EKOSISTEM_LANTAI_CAKUPAN) * nisbah)
            )

        risiko_lingkungan, sumber_lingkungan = rerata_berbobot_berdata({
            'ekosistem': (sensitivitas or 0.0, BOBOT_RISIKO_LINGKUNGAN['ekosistem'], sensitivitas is not None),
            'bencana': (tekanan_bencana, BOBOT_RISIKO_LINGKUNGAN['bencana'], bool(bencana)),
        })
        if not sumber_lingkungan:
            risiko_lingkungan = SPATIAL_DEFAULT_RISK['lingkungan']

        risiko_regulasi = SPATIAL_DEFAULT_RISK['regulasi']
        if not sesuai:
            risiko_regulasi += REGULASI_PENALTY['zona_tidak_cocok']
        if n_kkprl:
            risiko_regulasi += REGULASI_PENALTY['tumpang_tindih_kkprl']
        risiko_regulasi = _batas(risiko_regulasi)

        risiko_sosial_nilai, sumber_sosial, _ = hitung_risiko_sosial(
            rasio_dtks=(sosial or {}).get('rasio_dtks'),
            rasio_nelayan=(sosial or {}).get('rasio_nelayan'),
            ada_adat=ada_adat,
            sub_zona=sub_zona,
            adat_terdata=adat_terdata,
        )

        ada_bencana = bool(bencana)
        skor_risiko, _ = rerata_berbobot_berdata({
            'pasar': (1.0 - SPATIAL_DEFAULT_RISK['pasar'], RISK_WEIGHTS['pasar'], False),
            'operasional': (1.0 - risiko_operasional, RISK_WEIGHTS['operasional'], ada_bencana),
            'regulasi': (1.0 - risiko_regulasi, RISK_WEIGHTS['regulasi'], True),
            'lingkungan': (1.0 - risiko_lingkungan, RISK_WEIGHTS['lingkungan'], bool(sumber_lingkungan)),
            'sosial': (
                1.0 - (risiko_sosial_nilai or 0.0),
                RISK_WEIGHTS['sosial'],
                risiko_sosial_nilai is not None,
            ),
        })

        kelas_risiko = hitung_kelas_risiko(
            None,
            risiko_operasional,
            risiko_regulasi,
            risiko_lingkungan,
            risiko_sosial_nilai,
        )

        skor_total = (
            skor_lokasi * BOBOT_SKOR_ZONA['lokasi'] + skor_risiko * BOBOT_SKOR_ZONA['risiko']
        )

        return {
            'skor_total': round(_batas(skor_total), 4),
            'skor_lokasi': round(_batas(skor_lokasi), 4),
            'skor_risiko': round(_batas(skor_risiko), 4),
            'kelas': kelas_kelayakan(skor_total),
            'kelas_risiko': kelas_risiko,
            'kesesuaian_tr': sesuai,
            'potensi_sda': round(skor_potensi, 4),
            'aksesibilitas': round(skor_akses, 4),
            'kondisi_sosek': round(skor_sosek, 4),
            'jarak_infra_km': round(terdekat, 2) if terdekat is not None else None,
            'risiko_bencana': round(max(risiko_operasional, tekanan_bencana), 4),
            'sensitivitas_ekosistem': round(sensitivitas, 4) if sensitivitas is not None else None,
            'ekosistem_rincian': '; '.join(ekosistem_rincian[:4]),
            'sumber_lingkungan': '+'.join(sumber_lingkungan) if sumber_lingkungan else 'NETRAL',
            'risiko_regulasi': round(risiko_regulasi, 4),
            'jumlah_kkprl': n_kkprl,
            'risiko_sosial': (
                round(risiko_sosial_nilai, 4) if risiko_sosial_nilai is not None else None
            ),
            'rasio_dtks': self._bulat((sosial or {}).get('rasio_dtks')),
            'rasio_nelayan': self._bulat((sosial or {}).get('rasio_nelayan')),
            'wilayah_adat': ada_adat,
            'sumber_sosial': '+'.join(sumber_sosial) if sumber_sosial else 'NETRAL',
            'sumber_sosek': 'KKP' if ada_sosek else 'NETRAL',
        }

    @staticmethod
    def _bulat(nilai, angka=4):
        return round(nilai, angka) if nilai is not None else None

    def _provinsi(self, prov, sektor_list):
        from inventarisasi.models import ZonasiRuangLaut

        zona = list(
            ZonasiRuangLaut.objects.filter(provinsi_id=prov.id).values_list(
                'id', 'sub_zona', 'jenis_zona', 'luas_ha'
            )
        )
        if not zona:
            return 0

        bencana = self._bencana(prov.id)
        kkprl = self._kkprl(prov.id)
        jarak = self._aksesibilitas(prov.id)
        potensi = self._potensi(prov.id)
        ekosistem = self._ekosistem(prov.id)
        sosial = self._sosial(prov.id)
        adat = self._adat(prov.id)
        adat_terdata = self._adat_terdata(prov.id)
        aturan = _aturan_per_sektor()

        baris = []
        for zona_id, sub_zona, jenis_zona, luas_zona in zona:
            b = bencana.get(zona_id, {})
            j = jarak.get(zona_id, {})
            p = potensi.get(zona_id, [])
            n = kkprl.get(zona_id, 0)
            e = ekosistem.get(zona_id, [])
            for sektor in sektor_list:
                ket = _ketentuan(
                    aturan.get(sektor.id, {}),
                    {'jenis_zona': jenis_zona, 'sub_zona': sub_zona, 'provinsi_id': prov.id},
                )
                nilai = self._skor(
                    sub_zona, ket['status'] in BOLEH, sektor.kode, b, j, p, n, e, luas_zona,
                    sosial.get(zona_id), zona_id in adat, adat_terdata,
                )
                baris.append(SkorKelayakanZona(zona_id=zona_id, sektor_id=sektor.id, **nilai))

        with transaction.atomic():
            SkorKelayakanZona.objects.filter(
                zona_id__in=[z[0] for z in zona], sektor__in=sektor_list
            ).delete()
            SkorKelayakanZona.objects.bulk_create(baris, batch_size=2000)
        return len(baris)

    def handle(self, *args, **opsi):
        sektor_list = list(SektorInvestasi.objects.filter(aktif=True).order_by('kode'))
        if opsi['sektor']:
            sektor_list = [s for s in sektor_list if s.kode == opsi['sektor']]
            if not sektor_list:
                self.stderr.write(f'Sektor {opsi["sektor"]} tidak ditemukan.')
                return

        provinsi = Provinsi.objects.all().order_by('kode_bps')
        if opsi['provinsi']:
            provinsi = provinsi.filter(kode_bps=str(opsi['provinsi']).zfill(2))
        daftar = list(provinsi)
        if not daftar:
            self.stderr.write('Tidak ada provinsi yang cocok.')
            return

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f'{len(daftar)} provinsi x {len(sektor_list)} sektor aktif'
            )
        )

        mulai = time.time()
        total = dilewati = 0
        for i, prov in enumerate(daftar, 1):
            if opsi['lanjutkan'] and SkorKelayakanZona.objects.filter(
                zona__provinsi_id=prov.id
            ).exists():
                dilewati += 1
                continue

            t0 = time.time()
            n = self._provinsi(prov, sektor_list)
            total += n
            if n:
                self.stdout.write(
                    f'  [{i}/{len(daftar)}] {prov.nama:28s} {n:7d} baris  '
                    f'{time.time() - t0:5.1f} dtk'
                )

        lewat = time.time() - mulai
        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'Selesai dalam {lewat:.0f} dtk — {total} baris skor tersimpan'
                + (f', {dilewati} provinsi dilewati' if dilewati else '')
            )
        )
        if total:
            rekap = (
                SkorKelayakanZona.objects.filter(
                    zona__provinsi_id__in=[p.id for p in daftar]
                )
                .values('kelas')
                .annotate(n=Count('id'))
                .order_by('-n')
            )
            self.stdout.write('  Sebaran kelas: ' + ' · '.join(
                f'{r["kelas"]} {r["n"]}' for r in rekap
            ))
