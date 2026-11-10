import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from inti.layanan_peta import TABEL, daftar_lapisan

WARNA = ['0 86 165', '140 198 63', '64 191 219', '27 106 138', '230 126 34', '155 89 182', '192 57 43', '22 160 133']


def teks(s):
    return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"'


def metadata(judul, abstrak='', tambahan=''):
    return (f'    METADATA\n      "ows_title" {teks(judul)}\n      "ows_abstract" {teks(abstrak)}\n'
            '      "ows_include_items" "all"\n      "gml_include_items" "all"\n      "gml_featureid" "id"\n'
            f'      "wfs_enable_request" "*"\n{tambahan}    END\n')


def vektor(lp, koneksi, warna):
    jenis = lp['jenis']
    gaya = (f'STYLE COLOR {warna} OUTLINECOLOR 255 255 255 SIZE 7 SYMBOL "titik" END' if jenis == 'POINT' else
            f'STYLE COLOR {warna} WIDTH 1.5 END' if jenis == 'LINE' else
            f'STYLE COLOR {warna} OPACITY 35 END STYLE OUTLINECOLOR {warna} WIDTH 0.8 END')
    data = 'geometry FROM (' + lp['sql'] + ') AS t USING UNIQUE id USING SRID=4326'
    return (f'  LAYER\n    NAME "{lp["nama"]}"\n    TYPE {jenis}\n    STATUS ON\n    CONNECTIONTYPE POSTGIS\n'
            f'    CONNECTION {teks(koneksi)}\n    DATA {teks(data)}\n'
            f'    PROJECTION "init=epsg:4326" END\n    TEMPLATE "kosong"\n'
            + (f'    MAXSCALEDENOM {lp["skala"]}\n' if lp['skala'] else '')
            + metadata(lp['judul']) + f'    CLASS NAME {teks(lp["judul"])} {gaya} END\n  END\n')


def raster(r, koneksi):
    c = r['cakupan']
    pg = (f"PG:{koneksi} schema=public table=analitik_raster_oseanografi column=rast "
          f"where='id IN ({','.join(map(str, r['id']))})' mode=2")
    return (f'  LAYER\n    NAME "{r["nama"]}"\n    TYPE RASTER\n    STATUS ON\n'
            f'    DATA {teks(pg)}\n    PROJECTION "init=epsg:4326" END\n    EXTENT {c[0]} {c[1]} {c[2]} {c[3]}\n'
            '    PROCESSING "SCALE=AUTO"\n'
            + metadata(r['judul'], f'Satuan {r["satuan"]}; periode {r["periode"] or "-"}; sumber {r["sumber"]}',
                       f'      "wcs_label" {teks(r["judul"])}\n      "wcs_rangeset_name" "nilai"\n'
                       f'      "wcs_rangeset_label" {teks(r["satuan"])}\n')
            + '  END\n')


class Command(BaseCommand):
    help = 'Membangkitkan mapfile MapServer untuk layanan WMS, WFS, dan WCS dari data aplikasi'

    def add_arguments(self, parser):
        parser.add_argument('--sql-hak', metavar='PERAN', help='Cetak SQL hak baca untuk peran basis data map server')

    def handle(self, *args, **opsi):
        if opsi['sql_hak']:
            peran = opsi['sql_hak']
            self.stdout.write(f'GRANT CONNECT ON DATABASE {settings.DATABASES["default"]["NAME"]} TO {peran};\n'
                              f'GRANT USAGE ON SCHEMA public TO {peran};\n'
                              f'GRANT SELECT ON {", ".join(TABEL)}, raster_columns, raster_overviews, geometry_columns, spatial_ref_sys TO {peran};')
            return
        pengguna, sandi = os.getenv('PETA_DB_USER'), os.getenv('PETA_DB_PASSWORD')
        if not pengguna or not sandi:
            self.stdout.write('Layanan peta belum disiapkan (PETA_DB_USER/PETA_DB_PASSWORD kosong); mapfile tidak dibuat.')
            return
        db = settings.DATABASES['default']
        koneksi = f'host={db["HOST"]} port={db["PORT"]} dbname={db["NAME"]} user={pengguna} password={sandi}'
        semua = daftar_lapisan()
        lapisan = [lp for lp in semua if lp['jenis'] != 'RASTER']
        rasters = [lp for lp in semua if lp['jenis'] == 'RASTER']
        alamat = os.getenv('PETA_URL', '')
        isi = ('MAP\n  NAME "kkp"\n  STATUS ON\n  EXTENT 94 -12 142 7\n  SIZE 800 600\n  UNITS DD\n  IMAGECOLOR 255 255 255\n'
               '  PROJECTION "init=epsg:4326" END\n  SYMBOL NAME "titik" TYPE ELLIPSE FILLED TRUE POINTS 1 1 END END\n'
               '  OUTPUTFORMAT NAME "geojson" DRIVER "OGR/GEOJSON" MIMETYPE "application/json; subtype=geojson" '
               'FORMATOPTION "STORAGE=stream" FORMATOPTION "FORM=SIMPLE" END\n'
               '  OUTPUTFORMAT NAME "shapezip" DRIVER "OGR/ESRI Shapefile" MIMETYPE "application/zip" '
               'FORMATOPTION "STORAGE=memory" FORMATOPTION "FORM=zip" FORMATOPTION "FILENAME=data.zip" END\n'
               '  OUTPUTFORMAT NAME "kml" DRIVER "OGR/KML" MIMETYPE "application/vnd.google-earth.kml+xml" '
               'FORMATOPTION "STORAGE=stream" FORMATOPTION "FORM=SIMPLE" END\n'
               '  OUTPUTFORMAT NAME "GTiff" DRIVER "GDAL/GTiff" MIMETYPE "image/tiff" IMAGEMODE FLOAT32 EXTENSION "tif" END\n'
               '  WEB\n    METADATA\n      "ows_title" "Platform Manajemen Investasi Ruang Laut - KKP"\n'
               '      "ows_abstract" "Data rujukan ruang laut: tata ruang, perizinan, batas wilayah, infrastruktur, ekosistem, '
               'oseanografi, risiko bencana, dan Peta Sebaran Wilayah Potensial Investasi"\n'
               f'      "ows_onlineresource" {teks(alamat + "?")}\n      "ows_srs" "EPSG:4326 EPSG:3857"\n'
               '      "ows_enable_request" "*"\n      "ows_encoding" "UTF-8"\n      "wfs_maxfeatures" "10000"\n'
               '      "wfs_getfeature_formatlist" "geojson,shapezip,kml"\n      "wms_feature_info_mime_type" "application/vnd.ogc.gml"\n'
               '    END\n  END\n'
               + ''.join(vektor(lp, koneksi, WARNA[i % len(WARNA)]) for i, lp in enumerate(lapisan))
               + ''.join(raster(r, koneksi) for r in rasters) + 'END\n')
        berkas = Path(os.getenv('PETA_MAPFILE') or settings.BASE_DIR.parent / 'peta' / 'kkp.map')
        berkas.parent.mkdir(parents=True, exist_ok=True)
        sementara = berkas.with_suffix('.baru')
        sementara.write_text(isi, encoding='utf-8')
        sementara.chmod(0o644)
        sementara.replace(berkas)
        self.stdout.write(f'Mapfile ditulis: {berkas} ({len(lapisan)} layer vektor, {len(rasters)} layer raster)')
