import json
import logging
from typing import Any, Dict, List, Optional

from django.db.models import Count, Sum

from inti.geospasial import hitung_luas_geodesik_ha

from .konstanta import (
    GMW_AMBANG_TREN_PERSEN,
    GMW_TAHUN_AKHIR,
    GMW_TAHUN_AWAL,
    SENSITIVITAS_EKOSISTEM,
    SUMBER_EKOSISTEM_UTAMA,
    SUMBER_KARANG,
    SUMBER_LAMUN,
    SUMBER_MANGROVE_GMW,
    rerata_berbobot_berdata,
    skor_sosial_ekonomi,
)
from .konstanta import (
    risiko_sosial as hitung_risiko_sosial,
)
from .pengaturan import atur

logger = logging.getLogger('analitik')


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _to_geos(geometry: Dict[str, Any]):
    from django.contrib.gis.geos import GEOSGeometry

    if geometry.get('type') == 'Feature':
        geometry = geometry.get('geometry', {})

    geom = GEOSGeometry(json.dumps(geometry), srid=4326)
    if not geom.valid:
        logger.warning('[SPATIAL] Geometry tidak valid, mencoba perbaikan buffer(0).')
        geom = geom.buffer(0)
    return geom


def _nilai_wilayah(geom) -> Dict[str, Any]:
    from inti.geospasial import kabupaten_dari_geometri, provinsi_dari_geometri

    hasil: Dict[str, Any] = {
        'provinsi': None, 'provinsi_id': None, 'kode_bps': None,
        'kabupaten_kota': None, 'metode': None, 'jarak_km': None,
    }

    w = provinsi_dari_geometri(geom, batas_m=None)
    provinsi = w['provinsi']
    hasil['metode'] = 'irisan' if w['metode'] == 'irisan' else 'provinsi terdekat'
    hasil['jarak_km'] = w['jarak_km']

    if provinsi:
        hasil['provinsi'] = provinsi.nama
        hasil['provinsi_id'] = provinsi.id
        hasil['kode_bps'] = provinsi.kode_bps

    kabkota = kabupaten_dari_geometri(geom, provinsi)
    if kabkota:
        hasil['kabupaten_kota'] = kabkota.nama
        hasil['kabkota_obj'] = kabkota

    return hasil


def _nilai_tata_ruang(screening: Dict[str, Any]) -> Dict[str, Any]:
    risiko = atur('SPATIAL_DEFAULT_RISK')['regulasi']
    if screening['status'] == 'SESUAI':
        risiko -= atur('REGULASI_PENALTY')['zona_tidak_cocok']
    catatan = [a for a in screening['alasan'] if 'bersyarat' in a]
    return {
        'kesesuaian': screening['lanjut'],
        'risiko_regulasi': _clamp(risiko),
        'zona_teririsan': [
            {'nama': z['nama'], 'jenis': z['jenis_zona'], 'sub_zona': z['sub_zona'], 'regulasi': z['regulasi']}
            for z in screening['zona']
        ],
        'kkprl_tumpang_tindih': [],
        'catatan': catatan,
    }


def _nilai_bencana(geom) -> Dict[str, Any]:
    from penarikan_data.inarisk import indeks_risiko

    hasil: Dict[str, Any] = {
        'risiko_operasional': None,
        'risiko_lingkungan': None,
        'bencana': [],
        'sumber': None,
        'catatan': '',
    }

    try:
        ina = indeks_risiko(geom)
    except Exception as e:
        logger.warning(f'[BENCANA] InaRISK tidak dapat dibaca: {e}')
        hasil['catatan'] = 'Indeks bahaya BNPB tidak dapat diambil.'
        return hasil

    hasil['sumber'] = ina.get('sumber')
    hasil['catatan'] = ina.get('catatan') or ''

    per_jenis: Dict[str, float] = {}
    for kode, b in (ina.get('bahaya') or {}).items():
        hasil['bencana'].append(
            {
                'jenis': kode,
                'label': b['label'],
                'indeks': b['indeks'],
                'maks': b.get('maks'),
                'kelas': b['kelas'],
                'catatan': b.get('catatan', ''),
            }
        )
        if b['indeks'] is not None:
            per_jenis[kode] = float(b['indeks'])

    if not per_jenis:
        if not hasil['catatan']:
            hasil['catatan'] = 'Tidak ada indeks bahaya yang dapat dinilai untuk area ini.'
        return hasil

    def _gabung(bobot_map: Dict[str, float], default: float) -> float:
        bobot_maks = max(bobot_map.values()) if bobot_map else 0.0
        if bobot_maks <= 0:
            return default

        kandidat = []
        for jenis, skor in per_jenis.items():
            relevansi = bobot_map.get(jenis, 0.0) / bobot_maks
            kandidat.append(skor * relevansi + default * (1.0 - relevansi))
        return max(kandidat) if kandidat else default

    hasil['risiko_operasional'] = _clamp(
        _gabung(atur('HAZARD_OPERASIONAL_WEIGHTS'), atur('SPATIAL_DEFAULT_RISK')['operasional'])
    )
    hasil['risiko_lingkungan'] = _clamp(
        _gabung(atur('HAZARD_LINGKUNGAN_WEIGHTS'), atur('SPATIAL_DEFAULT_RISK')['lingkungan'])
    )
    return hasil


def _irisan_ekosistem(geom, *sumber, tahun=None):
    from inventarisasi.models import SumberDayaAlam

    qs = SumberDayaAlam.objects.filter(sumber_data__in=sumber, geometry__intersects=geom)
    if tahun is not None:
        qs = qs.filter(tahun_data=tahun)
    return list(
        qs.values('jenis', 'kondisi').annotate(jumlah=Count('id'), luas=Sum('luas_ha'))
    )


def _tren_mangrove(geom) -> Optional[Dict[str, Any]]:
    from inventarisasi.models import SumberDayaAlam

    luas = {}
    for tahun in (GMW_TAHUN_AWAL, GMW_TAHUN_AKHIR):
        agg = SumberDayaAlam.objects.filter(
            sumber_data=SUMBER_MANGROVE_GMW, tahun_data=tahun, geometry__intersects=geom
        ).aggregate(total=Sum('luas_ha'))
        luas[tahun] = float(agg['total'] or 0)

    awal, akhir = luas[GMW_TAHUN_AWAL], luas[GMW_TAHUN_AKHIR]
    if awal <= 0:
        return None

    perubahan = (akhir - awal) / awal * 100.0
    return {
        'tahun_awal': GMW_TAHUN_AWAL,
        'tahun_akhir': GMW_TAHUN_AKHIR,
        'luas_awal_ha': round(awal, 2),
        'luas_akhir_ha': round(akhir, 2),
        'perubahan_persen': round(perubahan, 1),
        'berarti': abs(perubahan) >= GMW_AMBANG_TREN_PERSEN,
        'sumber': 'GMW v3.0 (CC-BY-4.0)',
    }


def _nilai_ekosistem(geom) -> Dict[str, Any]:
    hasil: Dict[str, Any] = {
        'sensitivitas': None, 'rincian': [], 'sumber': None, 'tren': None,
    }

    try:
        beririsan = _irisan_ekosistem(geom, SUMBER_EKOSISTEM_UTAMA)
        sumber_dipakai = 'KKP:Ekosistem'
        if not beririsan:
            beririsan = _irisan_ekosistem(
                geom, SUMBER_MANGROVE_GMW, tahun=GMW_TAHUN_AKHIR
            )
            sumber_dipakai = 'GMW:Mangrove'
        sidako = _irisan_ekosistem(geom, SUMBER_LAMUN, SUMBER_KARANG)
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal membaca ekosistem: {e}')
        return hasil

    try:
        hasil['tren'] = _tren_mangrove(geom)
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal menghitung tren mangrove: {e}')

    dasar = 0.0
    luas_total = 0.0
    for r, sumber in [(r, sumber_dipakai) for r in beririsan] + [(r, 'Sidako:Ekosistem') for r in sidako]:
        kondisi = r['kondisi'] or ''
        nilai = SENSITIVITAS_EKOSISTEM.get(
            (r['jenis'], kondisi), SENSITIVITAS_EKOSISTEM.get((r['jenis'], ''), 0.5)
        )
        dasar = max(dasar, nilai)
        luas_total += float(r['luas'] or 0)
        hasil['rincian'].append(
            {
                'jenis': r['jenis'],
                'kondisi': kondisi or None,
                'jumlah': r['jumlah'],
                'luas_ha': round(float(r['luas'] or 0), 2),
                'sumber': sumber,
            }
        )

    if not hasil['rincian']:
        return hasil

    luas_area = hitung_luas_geodesik_ha(json.loads(geom.geojson)) if geom else 0
    nisbah = min(1.0, luas_total / luas_area) if luas_area else 1.0
    hasil['sensitivitas'] = _clamp(
        dasar * (atur('EKOSISTEM_LANTAI_CAKUPAN') + (1 - atur('EKOSISTEM_LANTAI_CAKUPAN')) * nisbah)
    )
    hasil['sumber'] = ', '.join(sorted({r['sumber'] for r in hasil['rincian']}))
    return hasil


def _nilai_sosial(geom, kabkota, zona_teririsan) -> Dict[str, Any]:
    from inventarisasi.models import UnsurRuangLaut

    hasil: Dict[str, Any] = {
        'risiko': None, 'dipakai': [], 'rincian': {}, 'adat': [],
    }

    rasio_dtks = rasio_nelayan = None
    if kabkota is not None and kabkota.jumlah_penduduk:
        if kabkota.penduduk_dtks:
            rasio_dtks = kabkota.penduduk_dtks / kabkota.jumlah_penduduk
        if kabkota.jumlah_nelayan:
            rasio_nelayan = kabkota.jumlah_nelayan / kabkota.jumlah_penduduk

    adat = list(
        UnsurRuangLaut.objects.filter(kelompok='MHA', geometry__intersects=geom)[:10]
    )
    hasil['adat'] = [
        {'nama': u.nama, 'jenis': u.jenis, 'keterangan': u.keterangan, 'provinsi':
         u.provinsi.nama if u.provinsi else None}
        for u in adat
    ]

    sub_zona_lantai = ''
    tertinggi = 0.0
    for z in zona_teririsan or []:
        nilai = atur('TENURIAL_LANTAI_SUB_ZONA').get(z.get('sub_zona'), 0.0)
        if nilai > tertinggi:
            tertinggi, sub_zona_lantai = nilai, z['sub_zona']

    adat_terdata = bool(
        kabkota is not None
        and kabkota.provinsi_id
        and UnsurRuangLaut.objects.filter(
            kelompok='MHA', provinsi_id=kabkota.provinsi_id
        ).exists()
    )

    nilai, dipakai, komponen = hitung_risiko_sosial(
        rasio_dtks=rasio_dtks,
        rasio_nelayan=rasio_nelayan,
        ada_adat=bool(adat),
        sub_zona=sub_zona_lantai,
        adat_terdata=adat_terdata,
    )
    bulat = lambda x: round(x, 4) if x is not None else None  # noqa: E731
    hasil['risiko'] = nilai
    hasil['dipakai'] = dipakai
    hasil['rincian'] = {
        'kabupaten_kota': kabkota.nama if kabkota else None,
        'jumlah_penduduk': kabkota.jumlah_penduduk if kabkota else None,
        'rasio_dtks': bulat(rasio_dtks),
        'rasio_nelayan': bulat(rasio_nelayan),
        'jumlah_nelayan': kabkota.jumlah_nelayan if kabkota else None,
        'penduduk_dtks': kabkota.penduduk_dtks if kabkota else None,
        'sub_zona_melekat': sub_zona_lantai or None,
        'adat_terdata': adat_terdata,
        'tahun_data': kabkota.tahun_data_sosial if kabkota else None,
        'nilai_kemiskinan': bulat(komponen['kemiskinan']),
        'nilai_tenurial': bulat(komponen['tenurial']),
        'bobot': dict(atur('BOBOT_RISIKO_SOSIAL')),
    }
    return hasil


def _nilai_peta_risiko(geom) -> Dict[str, Any]:
    from django.db.models import Avg

    from analitik.models import PetaRisiko

    hasil: Dict[str, Any] = {
        'risiko_regulasi': None,
        'risiko_lingkungan': None,
        'risiko_sosial': None,
        'zona': [],
    }

    qs = PetaRisiko.objects.filter(geometry__intersects=geom)
    if not qs.exists():
        return hasil

    agg = qs.aggregate(reg=Avg('risiko_regulasi'), ling=Avg('risiko_lingkungan'), sos=Avg('risiko_sosial'))
    hasil['risiko_regulasi'] = _clamp(float(agg['reg'])) if agg['reg'] is not None else None
    hasil['risiko_lingkungan'] = _clamp(float(agg['ling'])) if agg['ling'] is not None else None
    hasil['risiko_sosial'] = _clamp(float(agg['sos'])) if agg['sos'] is not None else None
    hasil['zona'] = [{'nama': z.nama_zona, 'kelas': z.get_kelas_risiko_display()} for z in qs[:10]]
    return hasil


def _skor_aksesibilitas(potensi) -> float:
    if potensi.jarak_pelabuhan_km is None:
        jarak_skor = atur('SPATIAL_DEFAULT_LOCATION')['aksesibilitas']
    elif potensi.jarak_pelabuhan_km <= atur('AKSESIBILITAS_PELABUHAN_IDEAL_KM'):
        jarak_skor = 1.0
    elif potensi.jarak_pelabuhan_km >= atur('AKSESIBILITAS_PELABUHAN_MAX_KM'):
        jarak_skor = 0.1
    else:
        rentang = atur('AKSESIBILITAS_PELABUHAN_MAX_KM') - atur('AKSESIBILITAS_PELABUHAN_IDEAL_KM')
        posisi = (potensi.jarak_pelabuhan_km - atur('AKSESIBILITAS_PELABUHAN_IDEAL_KM')) / rentang
        jarak_skor = 1.0 - posisi * 0.9

    return _clamp(
        jarak_skor * atur('AKSESIBILITAS_WEIGHTS')['jarak_pelabuhan']
        + (1.0 if potensi.akses_jalan else 0.0) * atur('AKSESIBILITAS_WEIGHTS')['akses_jalan']
        + (1.0 if potensi.akses_listrik else 0.0) * atur('AKSESIBILITAS_WEIGHTS')['akses_listrik']
        + (1.0 if potensi.akses_air_bersih else 0.0) * atur('AKSESIBILITAS_WEIGHTS')['akses_air']
    )


def _jarak_infrastruktur(geom) -> Dict[str, Any]:
    from django.contrib.gis.db.models.functions import Distance
    from django.contrib.gis.geos import Polygon

    from inventarisasi.models import InfrastrukturPendukung

    rincian: List[Dict[str, Any]] = []
    total_bobot = 0.0
    total_nilai = 0.0

    minx, miny, maxx, maxy = geom.extent

    def kotak(radius_km):
        d = radius_km / 111.0
        k = Polygon.from_bbox((minx - d, miny - d, maxx + d, maxy + d))
        k.srid = 4326
        return k

    RADIUS_BERTAHAP = [40.0, 120.0, atur('INFRASTRUKTUR_RADIUS_CARI_KM')]

    for kategori, bobot, ideal_km, maks_km in atur('INFRASTRUKTUR_AKSESIBILITAS'):
        terdekat = None
        for radius_km in RADIUS_BERTAHAP:
            terdekat = (
                InfrastrukturPendukung.objects.filter(
                    kategori=kategori,
                    geometry__intersects=kotak(radius_km),
                )
                .annotate(jarak=Distance('geometry', geom))
                .order_by('jarak')
                .first()
            )
            if terdekat is not None:
                break
        if terdekat is None:
            continue

        jarak_km = terdekat.jarak.km
        if jarak_km <= ideal_km:
            skor = 1.0
        elif jarak_km >= maks_km:
            skor = 0.1
        else:
            posisi = (jarak_km - ideal_km) / (maks_km - ideal_km)
            skor = 1.0 - posisi * 0.9

        total_bobot += bobot
        total_nilai += skor * bobot
        rincian.append({
            'kategori': terdekat.get_kategori_display(),
            'nama': terdekat.nama,
            'jarak_km': round(jarak_km, 2),
            'skor': round(skor, 3),
        })

    if total_bobot == 0:
        return {'skor': None, 'rincian': []}
    return {'skor': _clamp(total_nilai / total_bobot), 'rincian': rincian}


def _nilai_potensi(geom, sektor_kode: str) -> Dict[str, Any]:
    from inventarisasi.models import PotensiInvestasi

    hasil: Dict[str, Any] = {'potensi_sda': None, 'aksesibilitas': None, 'zona': [], 'cocok_sektor': False}

    zona_list = list(PotensiInvestasi.objects.filter(geometry__intersects=geom).select_related('sektor')[:20])
    if not zona_list:
        return hasil

    sesuai_sektor = [z for z in zona_list if z.sektor and z.sektor.kode == sektor_kode]
    dipakai = sesuai_sektor or zona_list

    skor_sda: List[float] = []
    skor_akses: List[float] = []
    for z in dipakai:
        nilai = atur('TINGKAT_POTENSI_SCORE').get(z.tingkat_potensi, 0.5)
        if z.skor_kelayakan is not None:
            nilai = (nilai + _clamp(float(z.skor_kelayakan))) / 2.0
        skor_sda.append(nilai)
        skor_akses.append(_skor_aksesibilitas(z))
        hasil['zona'].append(
            {
                'nama': z.nama,
                'tingkat_potensi': z.tingkat_potensi,
                'sektor': z.sektor.nama if z.sektor else None,
                'nilai_potensi_miliar': z.nilai_potensi_miliar,
            }
        )

    hasil['potensi_sda'] = _clamp(sum(skor_sda) / len(skor_sda))
    hasil['aksesibilitas'] = _clamp(sum(skor_akses) / len(skor_akses))
    hasil['cocok_sektor'] = bool(sesuai_sektor)
    return hasil


def _nilai_sosek(kabkota) -> Optional[float]:
    if kabkota is None:
        return None
    return skor_sosial_ekonomi(kabkota.jumlah_penduduk, kabkota.pesisir)


def ambil_skor_spasial(geometry: Dict[str, Any], sektor_kode: str, screening: Dict[str, Any]) -> Dict[str, Any]:
    risiko = dict(atur('SPATIAL_DEFAULT_RISK'))
    lokasi = dict(atur('SPATIAL_DEFAULT_LOCATION'))
    sumber = {k: 'default' for k in list(risiko) + list(lokasi)}
    sumber['tata_ruang'] = 'default'
    catatan: List[str] = []
    detail: Dict[str, Any] = {}
    wilayah: Dict[str, Any] = {}
    tata_ruang_terverifikasi = False
    kesesuaian_tr = True

    def _bungkus() -> Dict[str, Any]:
        jumlah_spasial = sum(1 for v in sumber.values() if v != 'default')
        return {
            'risiko': {k: round(v, 4) for k, v in risiko.items()},
            'lokasi': {'kesesuaian_tr': kesesuaian_tr, **{k: round(v, 4) for k, v in lokasi.items()}},
            'sumber': sumber,
            'wilayah': wilayah,
            'catatan': catatan,
            'tata_ruang_terverifikasi': tata_ruang_terverifikasi,
            'skor_berbasis_spasial': jumlah_spasial,
            'total_skor': len(sumber),
            'detail': detail,
        }

    try:
        geom = _to_geos(geometry)
    except Exception as e:
        logger.error(f'[SPATIAL] Geometry tidak dapat diproses: {e}')
        catatan.append('Geometry tidak dapat diproses untuk analisis spasial; seluruh skor memakai nilai default.')
        return _bungkus()

    kabkota_obj = None
    try:
        wilayah = _nilai_wilayah(geom)
        kabkota_obj = wilayah.pop('kabkota_obj', None)
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal menentukan wilayah: {e}')

    try:
        tr = _nilai_tata_ruang(screening)
        catatan.extend(tr['catatan'])
        detail['zonasi'] = tr['zona_teririsan']
        detail['kkprl'] = tr['kkprl_tumpang_tindih']
        if tr['kesesuaian'] is not None:
            kesesuaian_tr = tr['kesesuaian']
            tata_ruang_terverifikasi = True
            sumber['tata_ruang'] = 'DB:ZonasiRuangLaut'
        if tr['risiko_regulasi'] is not None:
            risiko['regulasi'] = tr['risiko_regulasi']
            sumber['regulasi'] = 'DB:ZonasiRuangLaut+KKPRL'
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal menilai tata ruang: {e}')

    try:
        bencana = _nilai_bencana(geom)
        if bencana['bencana']:
            detail['bencana'] = bencana['bencana']
            detail['bencana_sumber'] = bencana.get('sumber')
            if bencana.get('catatan'):
                catatan.append(bencana['catatan'])

            if bencana['risiko_operasional'] is not None:
                risiko['operasional'] = bencana['risiko_operasional']
                sumber['operasional'] = 'BNPB:InaRISK'
            if bencana['risiko_lingkungan'] is not None:
                risiko['lingkungan'] = bencana['risiko_lingkungan']
                sumber['lingkungan'] = 'BNPB:InaRISK'
            berangka = [b for b in bencana['bencana'] if b.get('indeks') is not None]
            if berangka:
                tertinggi = max(berangka, key=lambda b: b['indeks'])
                catatan.append(
                    f"Ancaman bencana dominan: {tertinggi['label']} "
                    f"(kelas {tertinggi['kelas']}, indeks {tertinggi['indeks']:.2f}) "
                    f"menurut BNPB InaRISK."
                )
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal menilai risiko bencana: {e}')

    try:
        eko = _nilai_ekosistem(geom)
        if eko['sensitivitas'] is not None:
            tekanan_bencana = risiko.get('lingkungan')
            ada_bencana = sumber.get('lingkungan') == 'BNPB:InaRISK'
            gabungan, dipakai = rerata_berbobot_berdata({
                'ekosistem': (
                    eko['sensitivitas'], atur('BOBOT_RISIKO_LINGKUNGAN')['ekosistem'], True
                ),
                'bencana': (
                    tekanan_bencana or 0.0, atur('BOBOT_RISIKO_LINGKUNGAN')['bencana'], ada_bencana
                ),
            })
            detail['ekosistem'] = {
                'indeks': round(eko['sensitivitas'], 4),
                'tekanan_bencana': (
                    round(tekanan_bencana, 4) if ada_bencana and tekanan_bencana is not None
                    else None
                ),
                'gabungan': round(gabungan, 4),
                'bobot': dict(atur('BOBOT_RISIKO_LINGKUNGAN')),
                'dipakai': dipakai,
                'rincian': eko['rincian'],
                'sumber_ekosistem': eko['sumber'],
                'tren': eko.get('tren'),
            }
            risiko['lingkungan'] = gabungan
            sumber['lingkungan'] = '+'.join(filter(None, [
                eko['sumber'], 'BNPB:InaRISK' if ada_bencana else None,
            ]))
            terberat = max(eko['rincian'], key=lambda r: r['luas_ha'])
            catatan.append(
                'Indeks kesehatan ekosistem '
                f"{eko['sensitivitas']:.2f} — terdapat "
                f"{terberat['jenis'].replace('_', ' ').lower()}"
                + (f" kondisi {terberat['kondisi'].lower()}" if terberat['kondisi'] else '')
                + f" seluas {terberat['luas_ha']:.1f} ha di dalam atau bersinggungan "
                'dengan area. Ekosistem yang sehat menaikkan kewajiban lingkungan '
                'dan memperberat perizinan.'
            )
            tren = eko.get('tren')
            if tren and tren['berarti']:
                arah = 'berkurang' if tren['perubahan_persen'] < 0 else 'bertambah'
                catatan.append(
                    f"Mangrove di area ini {arah} {abs(tren['perubahan_persen']):.0f}% "
                    f"antara {tren['tahun_awal']} dan {tren['tahun_akhir']} — "
                    f"{tren['luas_awal_ha']:.0f} ha menjadi {tren['luas_akhir_ha']:.0f} ha "
                    'menurut Global Mangrove Watch. Angka ini KETERANGAN; ia belum ikut '
                    'berbobot pada skor.'
                )
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal menilai ekosistem: {e}')

    try:
        peta = _nilai_peta_risiko(geom)
        if peta['zona']:
            detail['peta_risiko'] = peta['zona']
            for kunci in ('regulasi', 'lingkungan', 'sosial'):
                nilai = peta[f'risiko_{kunci}']
                if nilai is not None:
                    risiko[kunci] = nilai
                    sumber[kunci] = 'DB:PetaRisiko'
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal membaca peta risiko: {e}')

    try:
        potensi = _nilai_potensi(geom, sektor_kode)
        if potensi['zona']:
            detail['potensi'] = potensi['zona']
            lokasi['potensi_sda'] = potensi['potensi_sda']
            lokasi['aksesibilitas'] = potensi['aksesibilitas']
            sumber['potensi_sda'] = 'DB:PotensiInvestasi'
            sumber['aksesibilitas'] = 'DB:PotensiInvestasi'
            if not potensi['cocok_sektor']:
                catatan.append(
                    'Zona potensi pada lokasi ini terdaftar untuk sektor lain; '
                    'skor potensi SDA dihitung dari zona tersebut sebagai pendekatan.'
                )
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal menilai potensi investasi: {e}')

    try:
        akses = _jarak_infrastruktur(geom)
        if akses['skor'] is not None:
            lokasi['aksesibilitas'] = akses['skor']
            sumber['aksesibilitas'] = 'DB:InfrastrukturPendukung'
            detail['infrastruktur_terdekat'] = akses['rincian']
            if akses['rincian']:
                terdekat = min(akses['rincian'], key=lambda x: x['jarak_km'])
                catatan.append(
                    'Infrastruktur terdekat: %s (%s) berjarak %.1f km.'
                    % (terdekat['nama'], terdekat['kategori'], terdekat['jarak_km'])
                )
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal menghitung jarak infrastruktur: {e}')

    try:
        sosek = _nilai_sosek(kabkota_obj)
        if sosek is not None:
            lokasi['kondisi_sosek'] = sosek
            sumber['kondisi_sosek'] = 'DB:KabupatenKota'
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal menilai kondisi sosial-ekonomi: {e}')

    try:
        sos = _nilai_sosial(geom, kabkota_obj, detail.get('zonasi'))
        if sos['risiko'] is not None:
            risiko['sosial'] = sos['risiko']
            detail['sosial'] = sos['rincian']
            if sos['adat']:
                detail['wilayah_adat'] = sos['adat']
            sumber['sosial'] = 'KKP:Statistik' + ('+MHA' if sos['adat'] else '')

            r = sos['rincian']
            bagian = []
            if r['rasio_dtks'] is not None:
                bagian.append(
                    f"{r['rasio_dtks'] * 100:.1f}% penduduk {r['kabupaten_kota']} "
                    'terdaftar DTKS desil 1-4'
                )
            if r['rasio_nelayan'] is not None:
                bagian.append(
                    f"{r['jumlah_nelayan']:,} nelayan "
                    f"({r['rasio_nelayan'] * 100:.1f}% penduduk)".replace(',', '.')
                )
            if sos['adat']:
                nama_adat = sos['adat'][0]['nama']
                bagian.append(
                    f'beririsan dengan wilayah kelola masyarakat hukum adat ({nama_adat})'
                    + (f" dan {len(sos['adat']) - 1} lainnya" if len(sos['adat']) > 1 else '')
                )
            if r['sub_zona_melekat']:
                bagian.append(
                    'berada di ' + r['sub_zona_melekat'].replace('_', ' ').lower()
                )
            if bagian:
                penutup = (
                    'Angka ini menyatakan berat tidaknya kewajiban sosial dan '
                    'kemungkinan penolakan warga, bukan kelayakan teknis.'
                )
                if len(sos['dipakai']) < 2:
                    penutup += (
                        ' Dihitung dari '
                        + ('kemiskinan' if 'kemiskinan' in sos['dipakai'] else 'konflik tenurial')
                        + ' saja; komponen satunya belum berdata untuk wilayah ini.'
                    )
                catatan.append(
                    f"Risiko sosial {sos['risiko']:.2f} — " + '; '.join(bagian) + '. ' + penutup
                )
    except Exception as e:
        logger.warning(f'[SPATIAL] Gagal menilai risiko sosial: {e}')

    if not tata_ruang_terverifikasi:
        catatan.append(
            'Keputusan kelayakan pada analisis ini TIDAK digerbangi oleh verifikasi tata ruang '
            'karena data RTR/RZ untuk lokasi tersebut belum tersedia di sistem.'
        )

    hasil = _bungkus()
    logger.info(
        f"[SPATIAL] {hasil['skor_berbasis_spasial']}/{hasil['total_skor']} skor berasal dari data spasial "
        f"(wilayah={wilayah.get('provinsi')}, sektor={sektor_kode}, "
        f'tata_ruang_terverifikasi={tata_ruang_terverifikasi})'
    )
    return hasil


def ambil_risiko_ruang(geometry: Dict[str, Any]) -> Dict[str, Any]:
    hasil: Dict[str, Any] = {
        'lingkungan': None, 'sosial': None, 'wilayah_adat': [], 'sumber': {},
    }
    try:
        geom = _to_geos(geometry)
    except Exception as e:
        logger.warning(f'[RISIKO RUANG] Geometry tidak dapat diproses: {e}')
        return hasil

    try:
        eko = _nilai_ekosistem(geom)
        tekanan = None
        try:
            tekanan = _nilai_bencana(geom)['risiko_lingkungan']
        except Exception as e:
            logger.warning(f'[RISIKO RUANG] Tekanan bencana gagal: {e}')

        ada_eko = eko['sensitivitas'] is not None
        ada_bencana = tekanan is not None
        if ada_eko or ada_bencana:
            gabungan, dipakai = rerata_berbobot_berdata({
                'ekosistem': (
                    eko['sensitivitas'] or 0.0, atur('BOBOT_RISIKO_LINGKUNGAN')['ekosistem'], ada_eko
                ),
                'bencana': (
                    tekanan or 0.0, atur('BOBOT_RISIKO_LINGKUNGAN')['bencana'], ada_bencana
                ),
            })
            hasil['lingkungan'] = {
                'indeks': round(eko['sensitivitas'], 4) if ada_eko else None,
                'tekanan_bencana': round(tekanan, 4) if ada_bencana else None,
                'gabungan': round(gabungan, 4),
                'bobot': dict(atur('BOBOT_RISIKO_LINGKUNGAN')),
                'dipakai': dipakai,
                'rincian': eko['rincian'],
                'sumber_ekosistem': eko['sumber'],
                'tren': eko.get('tren'),
            }
            hasil['sumber']['lingkungan'] = '+'.join(filter(None, [
                eko['sumber'] if ada_eko else None,
                'BNPB:InaRISK' if ada_bencana else None,
            ]))
        elif eko.get('tren'):
            hasil['lingkungan'] = {
                'indeks': None, 'tekanan_bencana': None, 'gabungan': None,
                'bobot': dict(atur('BOBOT_RISIKO_LINGKUNGAN')), 'dipakai': [],
                'rincian': [], 'sumber_ekosistem': None, 'tren': eko['tren'],
            }
    except Exception as e:
        logger.warning(f'[RISIKO RUANG] Gagal menilai ekosistem: {e}')

    try:
        from inventarisasi.models import ZonasiRuangLaut

        kabkota = None
        try:
            kabkota = _nilai_wilayah(geom).get('kabkota_obj')
        except Exception as e:
            logger.warning(f'[RISIKO RUANG] Gagal menentukan wilayah: {e}')

        zona = [
            {'sub_zona': z.sub_zona}
            for z in ZonasiRuangLaut.objects.filter(geometry__intersects=geom).only('sub_zona')[:20]
        ]
        sos = _nilai_sosial(geom, kabkota, zona)
        if sos['risiko'] is not None:
            hasil['sosial'] = {'nilai': round(sos['risiko'], 4), **sos['rincian']}
            hasil['wilayah_adat'] = sos['adat']
            hasil['sumber']['sosial'] = 'KKP:Statistik' + ('+MHA' if sos['adat'] else '')
        elif sos['adat']:
            hasil['wilayah_adat'] = sos['adat']
    except Exception as e:
        logger.warning(f'[RISIKO RUANG] Gagal menilai risiko sosial: {e}')

    return hasil
