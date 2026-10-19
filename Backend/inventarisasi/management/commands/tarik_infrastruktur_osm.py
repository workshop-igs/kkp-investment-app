import time

import httpx
from django.contrib.gis.geos import LineString, Point
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from inventarisasi.management.commands.tarik_bangunan_eksisting import KEPALA, OVERPASS
from inventarisasi.models import InfrastrukturPendukung

BATAS = (94.0, -11.0, 142.0, 7.0)
PETAK_GARIS = 2.0
SUMBER = 'OSM'
TITIK = {
    'BANDARA': 'nwr["aeroway"="aerodrome"]["iata"](area.id);nwr["aeroway"="aerodrome"]["icao"](area.id);',
    'GARDU_INDUK': 'nwr["power"="substation"]["substation"!~"distribution"](area.id);',
    'KAMPUS_RISET': ('nwr["amenity"="university"](area.id);nwr["amenity"="research_institute"](area.id);'
                     'nwr["office"="research"](area.id);'),
}
GARIS = {
    'JARINGAN_LISTRIK_TM': 'way["power"="minor_line"]({b});way["power"="line"]["voltage"~"(^|;)20000(;|$)"]({b});',
}


def _nama(tag, cadangan):
    return (tag.get('name') or tag.get('name:id') or tag.get('name:en') or cadangan)[:255]


class Command(BaseCommand):
    help = ('Tarik bandara, gardu induk, kampus dan lembaga riset, serta jaringan listrik tegangan menengah 20 kV dari '
            'OpenStreetMap (Overpass) sebagai infrastruktur pendukung.')

    def add_arguments(self, parser):
        parser.add_argument('--kategori', choices=[*TITIK, *GARIS], action='append')

    def handle(self, *args, **opsi):
        for kategori in opsi['kategori'] or [*TITIK, *GARIS]:
            mulai = time.time()
            objek = self._titik(kategori) if kategori in TITIK else self._garis(kategori)
            with transaction.atomic():
                InfrastrukturPendukung.objects.filter(kategori=kategori, sumber_data=SUMBER).delete()
                InfrastrukturPendukung.objects.bulk_create(objek, batch_size=500)
            self.stdout.write(self.style.SUCCESS(f'{kategori}: {len(objek)} objek ({time.time() - mulai:.0f} dtk)'))
        with connection.cursor() as c:
            c.execute(
                'UPDATE inventarisasi_infrastruktur_pendukung i SET provinsi_id = (SELECT p.id FROM inti_provinsi p '
                'WHERE p.geometry IS NOT NULL ORDER BY p.geometry <-> i.geometry LIMIT 1) '
                'WHERE i.sumber_data = %s AND i.provinsi_id IS NULL',
                [SUMBER],
            )
        cache.delete_many(['kriteria:sumber', 'asal-data:terbaru'])

    def _ambil(self, kueri):
        isi = f'[out:json][timeout:180][maxsize:268435456];{kueri}'
        for coba in range(6):
            try:
                r = httpx.post(OVERPASS[coba % len(OVERPASS)], data={'data': isi}, headers=KEPALA, timeout=240)
                r.raise_for_status()
                data = r.json()
                if 'runtime error' in (data.get('remark') or ''):
                    raise ValueError(data['remark'])
                return data['elements']
            except Exception as e:
                self.stderr.write(f'  coba {coba + 1}: {type(e).__name__} {str(e)[:120]}')
                time.sleep(10 * (coba + 1))
        raise CommandError('Overpass gagal setelah 6 percobaan; jalankan ulang perintah ini.')

    def _baru(self, kategori, tag, geom, cadangan):
        return InfrastrukturPendukung(
            kategori=kategori, kode_lapisan=f'osm:{kategori.lower()}', nama=_nama(tag, cadangan),
            kelas='/'.join(filter(None, [tag.get('iata'), tag.get('icao'), tag.get('voltage')]))[:120],
            pengelola=(tag.get('operator') or '')[:180], status='', keterangan='', geometry=geom, sumber_data=SUMBER,
        )

    def _titik(self, kategori):
        hasil, terlihat = [], set()
        for e in self._ambil(f'area["ISO3166-1"="ID"][admin_level=2]->.id;({TITIK[kategori]});out center tags;'):
            lokasi = e if e['type'] == 'node' else e.get('center')
            kunci = (e['type'], e['id'])
            if not lokasi or kunci in terlihat:
                continue
            terlihat.add(kunci)
            hasil.append(self._baru(kategori, e.get('tags', {}), Point(lokasi['lon'], lokasi['lat'], srid=4326),
                                    kategori.replace('_', ' ').title()))
        return hasil

    def _garis(self, kategori):
        hasil, terlihat = [], set()
        x = BATAS[0]
        while x < BATAS[2]:
            y = BATAS[1]
            while y < BATAS[3]:
                b = f'{y},{x},{y + PETAK_GARIS},{x + PETAK_GARIS}'
                for e in self._ambil(f'({GARIS[kategori].format(b=b)});out geom;'):
                    titik = [(g['lon'], g['lat']) for g in e.get('geometry') or []]
                    if e['id'] in terlihat or len(titik) < 2:
                        continue
                    terlihat.add(e['id'])
                    hasil.append(self._baru(kategori, e.get('tags', {}), LineString(titik, srid=4326),
                                            'Jaringan listrik tegangan menengah'))
                self.stdout.write(f'  petak {x:.0f}°BT {y:.0f}°LU: {len(hasil)} ruas')
                y += PETAK_GARIS
            x += PETAK_GARIS
        return hasil
