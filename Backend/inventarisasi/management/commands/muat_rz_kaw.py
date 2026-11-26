import json
import re

from django.contrib.gis.gdal import DataSource, GDALException
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from analitik.management.commands.muat_berkas_raster import jalur_gdal
from analitik.services.konstanta import PERPRES_BELUM
from inti.models import Provinsi
from inventarisasi.management.commands._geometri import jadikan_multipolygon
from inventarisasi.models import ZonasiRuangLaut

TANDA = 'KKP-RZKAW'
KOLOM_WAJIB = ('KAW', 'PERPRES', 'KAWASAN', 'ZONA')
SUB_ZONA = [
    (r'perikanan tangkap|penangkapan', 'PERIKANAN_TANGKAP'),
    (r'budi ?daya', 'PERIKANAN_BUDIDAYA'),
    (r'pariwisata|wisata', 'PARIWISATA'),
    (r'pertambangan|migas|minerba|minyak dan gas', 'PERTAMBANGAN'),
    (r'energi|otec', 'ENERGI'),
    (r'pertahanan', 'PERTAHANAN_KEAMANAN'),
    (r'pengerukan|dumping', 'DUMPING'),
    (r'pelabuhan|pelayaran|alur', 'PELAYARAN'),
    (r'industri', 'INDUSTRI'),
]


def _teks(fitur, kolom):
    try:
        nilai = fitur.get(kolom)
    except (GDALException, IndexError, KeyError):
        return ''
    t = str(nilai or '').strip()
    return '' if t in ('-', 'None', 'null') else t


def kelas_kaw(kawasan, zona):
    k, z = kawasan.lower(), (zona or kawasan).lower()
    if 'strategis nasional tertentu' in k or 'ksnt' in z:
        return 'KST', 'LAINNYA'
    if 'konservasi' in k or 'konservasi' in z:
        return 'ZL', 'KONSERVASI'
    return 'ZU', next((s for pola, s in SUB_ZONA if re.search(pola, z)), 'LAINNYA')


def lapisan(berkas):
    try:
        lapis = DataSource(jalur_gdal(berkas))[0]
    except (GDALException, IndexError):
        raise ValueError('Berkas tidak dapat dibaca sebagai data geospasial.') from None
    kurang = [k for k in KOLOM_WAJIB if k not in lapis.fields]
    if kurang:
        raise ValueError(f"Berkas RZ KAW wajib punya kolom {', '.join(KOLOM_WAJIB)}; belum ada: {', '.join(kurang)}.")
    if not len(lapis):
        raise ValueError('Berkas RZ KAW tidak berisi poligon.')
    return lapis


def _provinsi(geom):
    with connection.cursor() as c:
        c.execute('SELECT id FROM inti_provinsi WHERE geometry IS NOT NULL ORDER BY geometry <-> ST_GeomFromEWKT(%s) LIMIT 1',
                  [geom.point_on_surface.ewkt])
        return Provinsi.objects.get(id=c.fetchone()[0])


class Command(BaseCommand):
    help = 'Muat Rencana Zonasi Kawasan Antarwilayah (IGT KKP) dari berkas unggahan, per kawasan.'

    def add_arguments(self, parser):
        parser.add_argument('--berkas', required=True)
        parser.add_argument('--keterangan', default='')
        parser.add_argument('--kelompok', default='tata_ruang')
        parser.add_argument('--kode', default='RZKAW')

    def handle(self, *args, **opsi):
        lapis = lapisan(opsi['berkas'])
        antre, kawasan_kaw, dilewati = [], set(), 0
        for f in lapis:
            kaw, perpres = _teks(f, 'KAW'), _teks(f, 'PERPRES') or PERPRES_BELUM
            kawasan, zona = _teks(f, 'KAWASAN'), _teks(f, 'ZONA')
            geom = jadikan_multipolygon(json.loads(f.geom.json))
            if not kaw or geom is None or not (kawasan or zona):
                dilewati += 1
                continue
            kawasan_kaw.add(kaw)
            jenis, sub = kelas_kaw(kawasan, zona)
            tahun = re.search(r'Tahun (\d{4})', perpres)
            keterangan = ' | '.join(filter(None, [f'RZ KAW {kaw}', kawasan, zona, _teks(f, 'KODE'), _teks(f, 'KETERANGAN'),
                                                  f"versi data {_teks(f, 'VERSI')}" if _teks(f, 'VERSI') else '',
                                                  opsi['keterangan']]))
            antre.append(ZonasiRuangLaut(
                provinsi=_provinsi(geom),
                nama_zona=f'RZ KAW {kaw} - {zona or kawasan}'[:255],
                jenis_zona=jenis,
                sub_zona=sub,
                nomor_regulasi=perpres[:255],
                tahun_penetapan=int(tahun.group(1)) if tahun else None,
                geometry=geom,
                keterangan=keterangan[:500],
                sumber_data=TANDA,
                tingkat_acuan='KAW',
                ranah='LAUT',
            ))
        with transaction.atomic():
            for kaw in kawasan_kaw:
                ZonasiRuangLaut.objects.filter(sumber_data=TANDA, keterangan__startswith=f'RZ KAW {kaw} |').delete()
            ZonasiRuangLaut.objects.bulk_create(antre, batch_size=200)
        self.stdout.write(self.style.SUCCESS(
            f"RZ KAW dimuat: {len(antre)} zona dari {', '.join(sorted(kawasan_kaw))}" + (f'; {dilewati} dilewati' if dilewati else '')))
        return json.dumps({'dimuat': sorted({z.provinsi.kode_bps for z in antre}) or True})
