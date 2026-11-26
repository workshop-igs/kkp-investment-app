import json
import re

from django.contrib.gis.gdal import DataSource, GDALException
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from analitik.management.commands.muat_berkas_raster import jalur_gdal
from analitik.services.konstanta import REGULASI_RTRL
from inventarisasi.management.commands._geometri import jadikan_multipolygon
from inventarisasi.management.commands.muat_rz_kaw import _provinsi, _teks
from inventarisasi.models import ZonasiRuangLaut

TANDA = 'KKP-RTRL'
KOLOM_WAJIB = ('Nama_Kawasan', 'Keterangan')


def lapisan(berkas):
    try:
        lapis = DataSource(jalur_gdal(berkas))[0]
    except (GDALException, IndexError):
        raise ValueError('Berkas tidak dapat dibaca sebagai data geospasial.') from None
    kurang = [k for k in KOLOM_WAJIB if k not in lapis.fields]
    if kurang:
        raise ValueError(f"Berkas KSNT wajib punya kolom {', '.join(KOLOM_WAJIB)}; belum ada: {', '.join(kurang)}.")
    if not len(lapis):
        raise ValueError('Berkas KSNT tidak berisi poligon.')
    return lapis


def nama_ksnt(keterangan):
    nama = re.split(r'\bBERUPA\s+', keterangan, maxsplit=1)[-1]
    nama = re.sub(r'^KAWASAN YANG SIGNIFIKAN SECARA BIOLOGIS DAN EKOLOGIS\s*', '', nama)
    return f'KSNT {nama.title()}'


class Command(BaseCommand):
    help = 'Muat Kawasan Strategis Nasional Tertentu dari RTRL Nasional (PP 32/2019, IGT KKP) sebagai acuan RTRWN.'

    def add_arguments(self, parser):
        parser.add_argument('--berkas', required=True)
        parser.add_argument('--keterangan', default='')
        parser.add_argument('--kelompok', default='tata_ruang')
        parser.add_argument('--kode', default='RTRL')

    def handle(self, *args, **opsi):
        antre = []
        for f in lapisan(opsi['berkas']):
            ket = _teks(f, 'Keterangan')
            geom = jadikan_multipolygon(json.loads(f.geom.json))
            if not ket or geom is None:
                continue
            antre.append(ZonasiRuangLaut(
                provinsi=_provinsi(geom), nama_zona=nama_ksnt(ket)[:255], jenis_zona='KST', sub_zona='LAINNYA',
                nomor_regulasi=REGULASI_RTRL, tahun_penetapan=2019, geometry=geom,
                keterangan=' | '.join(filter(None, ['KSNT', ket, opsi['keterangan']]))[:500],
                sumber_data=TANDA, tingkat_acuan='RTRWN', ranah='LAUT'))
        with transaction.atomic():
            ZonasiRuangLaut.objects.filter(sumber_data=TANDA).delete()
            ZonasiRuangLaut.objects.bulk_create(antre)
            with connection.cursor() as c:
                c.execute(f'UPDATE {ZonasiRuangLaut._meta.db_table} SET luas_ha = ST_Area(geometry::geography) / 10000 '
                          'WHERE sumber_data = %s', [TANDA])
        self.stdout.write(self.style.SUCCESS(f'KSNT dimuat: {len(antre)} kawasan'))
        return json.dumps({'dimuat': sorted({z.provinsi.kode_bps for z in antre}) or True})
