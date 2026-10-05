import httpx
from django.core.management.base import BaseCommand
from django.db import transaction

from inti.models import Provinsi
from inventarisasi.management.commands._geometri import jadikan_multipolygon
from inventarisasi.models import ZonasiRuangLaut

WFS = 'https://portaldata.kkp.go.id/gis/wms'
LAYER = 'demo:POLA_RUANG_AR'
TANDA = 'KKP-WFS'

PETA_KAWASAN = {
    'kawasan pemanfaatan umum': 'ZU',
    'kawasan konservasi': 'ZL',
    'kawasan strategis nasional': 'KSN',
    'kawasan strategis nasional tertentu': 'KST',
    'alur laut': 'ALKI',
}

PETA_ZONA = {
    'perikanan tangkap': 'PERIKANAN_TANGKAP',
    'perikanan budidaya': 'PERIKANAN_BUDIDAYA',
    'pariwisata': 'PARIWISATA',
    'pelabuhan': 'PELAYARAN',
    'pertambangan minyak dan gas bumi': 'PERTAMBANGAN',
    'pertambangan': 'PERTAMBANGAN',
    'industri': 'INDUSTRI',
    'kawasan konservasi': 'KONSERVASI',
    'indikasi kawasan konservasi': 'KONSERVASI',
    'indikasi kawasan konservasi maritim': 'KONSERVASI',
    'energi': 'ENERGI',
}


def bersih(nilai):
    t = str(nilai or '').strip()
    return '' if t in ('-', 'None', 'null') else t


class Command(BaseCommand):
    help = 'Tarik Pola Ruang Laut (RTRL) dari WFS KKP ke tabel ZonasiRuangLaut.'

    def add_arguments(self, parser):
        parser.add_argument('--hapus', action='store_true', help='Hapus hasil tarikan saja.')

    def handle(self, *args, **options):
        terhapus = ZonasiRuangLaut.objects.filter(sumber_data=TANDA).delete()[0]
        if terhapus:
            self.stdout.write('Data tarikan sebelumnya dihapus: %d baris.' % terhapus)

        if options['hapus']:
            self.stdout.write(self.style.SUCCESS('Selesai — data tarikan dibuang.'))
            return

        provinsi_default = Provinsi.objects.order_by('kode_bps').first()
        if provinsi_default is None:
            self.stdout.write(self.style.ERROR('Tabel Provinsi kosong.'))
            return

        self.stdout.write('Menarik %s …' % LAYER)
        r = httpx.get(
            WFS,
            params={
                'service': 'WFS',
                'version': '1.0.0',
                'request': 'GetFeature',
                'typeName': LAYER,
                'outputFormat': 'application/json',
                'maxFeatures': 100000,
            },
            timeout=300.0,
        )
        r.raise_for_status()
        fitur = r.json().get('features', [])
        self.stdout.write('  %d fitur diterima (%.1f MB)' % (len(fitur), len(r.content) / 1048576))

        provinsi_list = list(Provinsi.objects.exclude(geometry=None))

        def cari_provinsi(geom):
            titik = geom.centroid
            for p in provinsi_list:
                if p.geometry.contains(titik):
                    return p
            terdekat, jarak_min = provinsi_default, None
            for p in provinsi_list:
                d = p.geometry.distance(titik)
                if jarak_min is None or d < jarak_min:
                    terdekat, jarak_min = p, d
            return terdekat

        antre, dilewati = [], 0
        for f in fitur:
            geom = jadikan_multipolygon(f.get('geometry'))
            if geom is None:
                dilewati += 1
                continue

            p = f.get('properties') or {}
            kawasan = bersih(p.get('Nama_Kawasan'))
            zona = bersih(p.get('Nama_Zona'))

            antre.append(
                ZonasiRuangLaut(
                    provinsi=cari_provinsi(geom),
                    nama_zona=(bersih(p.get('Nama_Objek')) or kawasan or 'Zona Ruang Laut')[:255],
                    jenis_zona=PETA_KAWASAN.get(kawasan.lower(), 'ZU'),
                    sub_zona=PETA_ZONA.get(zona.lower(), 'LAINNYA'),
                    nomor_regulasi=bersih(p.get('Dasar_Hukum'))[:255],
                    geometry=geom,
                    keterangan=('%s | %s' % (kawasan, bersih(p.get('Keterangan'))))[:500],
                    sumber_data=TANDA,
                    tingkat_acuan='KAW',
                )
            )

        with transaction.atomic():
            ZonasiRuangLaut.objects.bulk_create(antre, batch_size=100)

        total = ZonasiRuangLaut.objects.filter(sumber_data=TANDA).count()
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Tersimpan: %d zona ruang laut' % total))
        if dilewati:
            self.stdout.write(self.style.WARNING('Dilewati: %d' % dilewati))

        from django.db.models import Count

        rincian = (
            ZonasiRuangLaut.objects.filter(sumber_data=TANDA)
            .values('jenis_zona')
            .annotate(n=Count('id'))
            .order_by('-n')
        )
        for x in rincian:
            self.stdout.write('   %-6s %d' % (x['jenis_zona'], x['n']))
        self.stdout.write('')
        self.stdout.write('Sumber: Portal Satu Data KKP (WFS).')
