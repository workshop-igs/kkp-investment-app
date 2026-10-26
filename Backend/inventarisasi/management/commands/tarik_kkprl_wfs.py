import time

import httpx
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from inti.models import Provinsi, SektorInvestasi
from inventarisasi.models import KKPRL

WFS = 'https://portaldata.kkp.go.id/gis/wms'
LAYER = 'demo:KKPRL_AR'
TANDA = 'KKP-WFS'
UKURAN_HALAMAN = 500

PETA_STATUS = {
    'AKTIF': 'AKTIF',
    'BERLAKU': 'AKTIF',
    'TERBIT': 'AKTIF',
    'PROSES': 'PROSES',
    'BERAKHIR': 'BERAKHIR',
    'DICABUT': 'DICABUT',
}


ATURAN_SEKTOR = [
    ('PERIKANAN_BUDIDAYA', ('BUDIDAYA',)),
    ('KONSERVASI_PESISIR', ('MANGROVE', 'REHABILITASI TERUMBU', 'REHABILITASI EKOSISTEM', 'REHABILITASI PANTAI',
                            'REHABILITASI HABITAT', 'REHABILITASI MAMALIA', 'PENYU', 'DILINDUNGI',
                            'TRANSPLANTASI', 'KONSERVASI', 'CORAL STOCK', 'RESTORASI',
                            'TERUMBU KARANG', 'RUMAH IKAN', 'RUMAN IKAN', 'ARTIFICIAL REEF', 'PEMULIHAN',
                            'EKOSISTEM ESSENSIAL', 'TERUMBU BUATAN')),
    ('GARAM', ('GARAM',)),
    ('PARIWISATA_BAHARI', ('WISATA', 'PENYELAMAN', 'PENGINAPAN', 'RESOR', 'HOTEL', 'MARINA', 'VILLA', 'VILA', 'SELAM', 'DIVING',
                           'SNORKEL', 'RESTORAN', 'GLAMPING', 'COTTAGE', 'BUNGALOW', 'AKOMODASI', 'GARDU PANDANG')),
    ('PENGOLAHAN_HASIL_LAUT', ('COLD STORAGE', 'PENYIMPANAN HASIL', 'PENYIMPANAN IKAN', 'PENAMPUNGAN',
                               'PEMASARAN HASIL', 'PENGOLAHAN HASIL', 'PENGOLAHAN IKAN', 'PENGAWETAN', 'PABRIK ES')),
    ('ENERGI_KELAUTAN', ('TAMBANG', 'PENAMBANGAN', 'TIMAH', 'MINYAK', 'MIGAS', 'GAS', 'OIL', 'PASIR LAUT', 'ENERGI',
                         'PEMBANGKIT', 'PLTU', 'PLTD', 'PLTS', 'AIR LAUT SELAIN ENERGI', 'PENGAMBILAN AIR LAUT', 'SEA WATER', 'DESALINASI', 'REVERSE OSMOSIS',
                         'PENGEBORAN', 'PEMBORAN', 'SUMUR', 'EKSPLORASI', 'EKSPLOITASI', 'PENGEMBANGAN LAPANGAN',
                         'RDMP')),
    ('BIOTEKNOLOGI_KELAUTAN', ('BIOTEKNOLOGI', 'LABORATORIUM', 'BIOASSAY', 'PENELITIAN', 'RISET')),
    ('PERIKANAN_BUDIDAYA', ('BUDIDAYA', 'KERAMBA', 'KJA', 'MUTIARA', 'RUMPUT LAUT', 'TAMBAK', 'UDANG', 'VANAME',
                            'LOBSTER', 'KERANG', 'INSTALASI PERIKANAN', 'PEMBENIHAN', 'HATCHERY', 'KARANG HIAS',
                            'KORAL', 'PEMBESARAN')),
    ('JASA_MARITIM', ('SPBUN', 'BAHAN BAKAR', 'PENDARATAN IKAN', 'PELELANGAN IKAN', '(TPI)')),
    ('PERIKANAN_TANGKAP', ('RUMPON', 'BAGAN', 'PENANGKAPAN', 'TANGKAP', 'SERO', 'SUMBER DAYA IKAN')),
    ('JASA_MARITIM', ('TERMINAL', 'TUKS', 'PELABUHAN', 'DERMAGA', 'GALANGAN', 'DOCKING', 'TAMBAT', 'LABUH',
                      'BONGKAR MUAT', 'KAPAL', 'ALUR', 'JETTY', 'SANDAR', 'TONGKANG', 'BUNKER', 'LOGISTIK', 'MOORING',
                      'BUOY', 'PONTOON', 'KOLAM PUTAR', 'SPEEDBOAT', 'SEAPLANE')),
    ('INFRASTRUKTUR_LAUT', ('PENGAMAN PANTAI', 'PENGAMANAN PANTAI', 'PELINDUNG PANTAI', 'ABRASI', 'REVETMENT', 'TURAP',
                            'BREAKWATER', 'PEMECAH', 'REKLAMASI', 'JEMBATAN', 'JALAN', 'TOL', 'KABEL', 'PIPA',
                            'DUMPING', 'PENGERUKAN', 'LIMBAH', 'MATERIAL KERUK', 'INDUSTRI', 'TANGGUL', 'BANJIR',
                            'DAYA RUSAK AIR', 'SEAWALL', 'MERCUSUAR', 'TELEKOMUNIKASI', 'INFRASTRUKTUR', 'INTERKONEKSI',
                            'SKLTET', 'BANDARA', 'COASTAL', 'WATER FRONT', 'PERMUKIMAN', 'PEMUKIMAN', 'PERUMAHAN',
                            'REAL ESTAT', 'RUMAH SUSUN', 'GEDUNG', 'MASJID', 'TUGU', 'BANGUNAN', 'KAWASAN')),
]


def sektor_dari_kegiatan(teks):
    teks = (teks or '').upper()
    return next((kode for kode, kata in ATURAN_SEKTOR if any(k in teks for k in kata)), None)


def ambil_halaman(klien, mulai, jumlah, percobaan=4):
    galat = None
    for ke in range(percobaan):
        try:
            r = klien.get(
                WFS,
                params={
                    'service': 'WFS',
                    'version': '1.0.0',
                    'request': 'GetFeature',
                    'typeName': LAYER,
                    'outputFormat': 'application/json',
                    'maxFeatures': jumlah,
                    'startIndex': mulai,
                },
                timeout=120.0,
            )
            r.raise_for_status()
            return r.json().get('features', [])
        except Exception as exc:
            galat = exc
            if ke < percobaan - 1:
                time.sleep(2 ** ke)
    raise galat


class Command(BaseCommand):
    help = 'Tarik KKPRL (area) dari WFS Portal Satu Data KKP ke tabel KKPRL.'

    def add_arguments(self, parser):
        parser.add_argument('--batas', type=int, default=0, help='Berhenti setelah N fitur (0 = semua).')
        parser.add_argument('--hapus', action='store_true', help='Hapus hasil tarikan, tidak menarik yang baru.')
        parser.add_argument('--klasifikasi', action='store_true',
                            help='Hanya tetapkan ulang jenis investasi KKPRL yang ada dari teks kegiatannya.')

    def handle(self, *args, **options):
        sektor = {s.kode: s for s in SektorInvestasi.objects.all()}
        if options['klasifikasi']:
            semua = list(KKPRL.objects.only('id', 'jenis_kegiatan', 'sektor'))
            for k in semua:
                k.sektor = sektor.get(sektor_dari_kegiatan(k.jenis_kegiatan))
            KKPRL.objects.bulk_update(semua, ['sektor'], batch_size=500)
            tanpa = [k.jenis_kegiatan for k in semua if k.sektor is None]
            self.stdout.write(self.style.SUCCESS(
                f'Jenis investasi ditetapkan untuk {len(semua) - len(tanpa)} dari {len(semua)} KKPRL.'))
            if tanpa:
                self.stdout.write(f'Tanpa jenis investasi (tampil sebagai "Kegiatan lain"): {", ".join(sorted(set(tanpa)))}')
            return

        if options['hapus']:
            terhapus = KKPRL.objects.filter(sumber_data=TANDA).delete()[0]
            self.stdout.write(self.style.SUCCESS(f'Selesai — {terhapus} izin hasil tarikan dibuang.'))
            return

        indeks_provinsi = {p.nama.strip().lower(): p for p in Provinsi.objects.all()}
        cadangan_provinsi = Provinsi.objects.order_by('kode_bps').first()
        if cadangan_provinsi is None:
            self.stdout.write(self.style.ERROR('Tabel Provinsi kosong — jalankan setup data wilayah dulu.'))
            return

        batas = options['batas']
        provinsi_bergeometri = [x for x in indeks_provinsi.values() if x.geometry]

        def cocokkan_provinsi(teks, geom):
            n = (teks or '').strip().lower().split(',')[0].strip()
            if n:
                if n in indeks_provinsi:
                    return indeks_provinsi[n]
                for nama, prov in indeks_provinsi.items():
                    if n in nama or nama in n:
                        return prov
            if provinsi_bergeometri:
                titik = geom.centroid
                return min(provinsi_bergeometri, key=lambda x: x.geometry.distance(titik))
            return cadangan_provinsi

        mulai, disimpan, dilewati = 0, 0, 0
        antre = []

        self.stdout.write('Menarik %s dari %s …' % (LAYER, WFS))

        with httpx.Client(follow_redirects=True) as klien:
            while True:
                jumlah = UKURAN_HALAMAN
                if batas:
                    jumlah = min(UKURAN_HALAMAN, batas - disimpan - dilewati)
                    if jumlah <= 0:
                        break

                try:
                    fitur = ambil_halaman(klien, mulai, jumlah)
                except Exception as e:
                    raise CommandError(
                        f'Gagal mengambil halaman pada indeks {mulai}: {e}. Data izin lama dipertahankan.') from e

                if not fitur:
                    break

                for f in fitur:
                    p = f.get('properties') or {}
                    geom_json = f.get('geometry')
                    if not geom_json:
                        dilewati += 1
                        continue

                    try:
                        geom = GEOSGeometry(str(geom_json).replace("'", '"'), srid=4326)
                    except Exception:
                        import json as _json

                        try:
                            geom = GEOSGeometry(_json.dumps(geom_json), srid=4326)
                        except Exception:
                            dilewati += 1
                            continue

                    if not geom.valid:
                        geom = geom.buffer(0)
                    if geom.geom_type == 'Polygon':
                        geom = MultiPolygon(geom, srid=4326)
                    if geom.geom_type != 'MultiPolygon':
                        dilewati += 1
                        continue

                    provinsi = cocokkan_provinsi(p.get('PROVINSI'), geom)

                    nomor = (p.get('NO_KKPRL') or '').strip() or f.get('id') or ''
                    if not nomor:
                        dilewati += 1
                        continue

                    status_mentah = (p.get('STATUS') or '').strip().upper()
                    jenis_dok = (p.get('JENIS') or '').strip().upper()
                    keterangan = ' · '.join(
                        str(p.get(k)) for k in ('JENIS', 'KATEGORI', 'PERAIRAN') if p.get(k)
                    )

                    antre.append(
                        KKPRL(
                            nomor_izin=nomor[:100],
                            jenis_dokumen=(
                                jenis_dok if jenis_dok in ('PERSETUJUAN', 'KONFIRMASI') else 'LAINNYA'
                            ),
                            nama_pemohon=(p.get('Nama_Objek') or '-')[:255],
                            jenis_kegiatan=(p.get('KEGIATAN') or '-')[:255],
                            sektor=sektor.get(sektor_dari_kegiatan(p.get('KEGIATAN'))),
                            provinsi=provinsi,
                            geometry=geom,
                            status=PETA_STATUS.get(status_mentah, 'AKTIF'),
                            keterangan=keterangan[:500],
                            sumber_data=TANDA,
                        )
                    )
                    disimpan += 1

                mulai += len(fitur)
                self.stdout.write('  … %d fitur diproses' % (disimpan + dilewati))

                if len(fitur) < jumlah:
                    break

        unik, terlihat = [], set()
        for obj in antre:
            if obj.nomor_izin in terlihat:
                dilewati += 1
                continue
            terlihat.add(obj.nomor_izin)
            unik.append(obj)

        if not unik:
            raise CommandError('Portal tidak mengembalikan izin KKPRL. Data izin lama dipertahankan.')
        with transaction.atomic():
            KKPRL.objects.filter(sumber_data=TANDA).delete()
            KKPRL.objects.bulk_create(unik, batch_size=200, ignore_conflicts=True)

        total = KKPRL.objects.filter(sumber_data=TANDA).count()
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Tersimpan: %d izin KKPRL' % total))
        if dilewati:
            self.stdout.write(self.style.WARNING('Dilewati (tanpa geometri/duplikat): %d' % dilewati))
        self.stdout.write('')
        self.stdout.write('Sumber: Portal Satu Data KKP (WFS). Jalankan ulang untuk menyegarkan.')
