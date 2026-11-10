import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection

from analitik.models import RasterOseanografi

JENIS_GEOMETRI = {0: 'POINT', 1: 'LINE', 2: 'POLYGON'}
WARNA = ['0 86 165', '140 198 63', '64 191 219', '27 106 138', '230 126 34', '155 89 182', '192 57 43', '22 160 133']

VEKTOR = [
    ('batas_provinsi', 'Batas provinsi', 'SELECT id, kode_bps, nama, geometry FROM inti_provinsi', None),
    ('batas_kabupaten_kota', 'Batas kabupaten/kota',
     'SELECT id, kode_bps, nama, jenis, pesisir, geometry FROM inti_kabupaten_kota', None),
    ('wpp', 'Wilayah Pengelolaan Perikanan Negara Republik Indonesia (WPP-NRI)',
     'SELECT id, kode, perairan, zona_pit, geometry FROM inti_wpp', None),
    ('zonasi_ruang_laut', 'Zonasi ruang laut (RTRW Provinsi, RZ KAW, RTRWN)',
     'SELECT id, tingkat_acuan, nama_zona, jenis_zona, sub_zona, ranah, nomor_regulasi, tahun_penetapan, luas_ha, '
     'sumber_data, geometry FROM inventarisasi_zonasi_ruang_laut', 2000000),
    ('kkprl', 'Persetujuan KKPRL yang telah terbit',
     'SELECT id, jenis_dokumen, jenis_kegiatan, status, tanggal_terbit, tanggal_berakhir, luas_ha, sumber_data, geometry '
     'FROM inventarisasi_kkprl', 2000000),
    ('izin_tambang', 'Izin usaha pertambangan (ESDM)',
     'SELECT id, kode_wiup, nama_usaha, jenis_izin, kegiatan, komoditas, tanggal_berlaku, tanggal_akhir, luas_ha, geometry '
     'FROM inventarisasi_izin_tambang', 2000000),
    ('zona_risiko_bencana', 'Zona risiko bencana pesisir (BNPB InaRISK)',
     'SELECT id, jenis, varian, kelas, luas_ha, sumber, geometry FROM analitik_zona_risiko_bencana', 2000000),
    ('lokasi_potensial', 'Peta Sebaran Wilayah Potensial Investasi',
     "SELECT l.id, s.nama AS jenis_investasi, l.rincian->>'sub_sektor' AS sub_jenis, "
     "l.rincian->>'sub_sektor_kode' AS kode_sub_jenis, p.nama AS provinsi, l.luas_ha, l.dihitung_pada, l.geometry "
     'FROM analitik_lokasi_potensial l JOIN inti_sektor_investasi s ON s.id = l.sektor_id '
     'JOIN inti_provinsi p ON p.id = l.provinsi_id WHERE l.tampil', None),
    ('ruang_sesuai', 'Ruang sesuai per sub-jenis investasi (sel 250 m)',
     'SELECT r.id, s.nama AS jenis_investasi, r.sub_kode AS kode_sub_jenis, r.kelas, p.nama AS provinsi, r.luas_ha, r.geometry '
     'FROM analitik_ruang_sesuai r JOIN inti_sektor_investasi s ON s.id = r.sektor_id '
     'JOIN inti_provinsi p ON p.id = r.provinsi_id', 2000000),
]
EKOSISTEM = {'MANGROVE': 'Mangrove', 'TERUMBU_KARANG': 'Terumbu karang', 'LAMUN': 'Padang lamun'}
PER_KATEGORI = [
    ('infrastruktur', 'inventarisasi_infrastruktur_pendukung', 'kategori',
     'id, kategori, nama, kelas, pengelola, status, sumber_data'),
    ('unsur_ruang_laut', 'inventarisasi_unsur_ruang_laut', 'kelompok',
     'id, kelompok, nama, jenis, nomor_regulasi, sumber_data'),
]
TABEL = ['inti_provinsi', 'inti_kabupaten_kota', 'inti_wpp', 'inti_sektor_investasi', 'inventarisasi_zonasi_ruang_laut',
         'inventarisasi_kkprl', 'inventarisasi_izin_tambang', 'inventarisasi_sumber_daya_alam',
         'inventarisasi_infrastruktur_pendukung', 'inventarisasi_unsur_ruang_laut', 'analitik_zona_risiko_bencana',
         'analitik_lokasi_potensial', 'analitik_ruang_sesuai', 'analitik_raster_oseanografi']


def teks(s):
    return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"'


def metadata(judul, abstrak='', tambahan=''):
    return (f'    METADATA\n      "ows_title" {teks(judul)}\n      "ows_abstract" {teks(abstrak)}\n'
            '      "ows_include_items" "all"\n      "gml_include_items" "all"\n      "gml_featureid" "id"\n'
            f'      "wfs_enable_request" "*"\n{tambahan}    END\n')


def vektor(nama, judul, sql, jenis, koneksi, warna, skala=None):
    gaya = (f'STYLE COLOR {warna} OUTLINECOLOR 255 255 255 SIZE 7 SYMBOL "titik" END' if jenis == 'POINT' else
            f'STYLE COLOR {warna} WIDTH 1.5 END' if jenis == 'LINE' else
            f'STYLE COLOR {warna} OPACITY 35 END STYLE OUTLINECOLOR {warna} WIDTH 0.8 END')
    return (f'  LAYER\n    NAME "{nama}"\n    TYPE {jenis}\n    STATUS ON\n    CONNECTIONTYPE POSTGIS\n'
            f'    CONNECTION {teks(koneksi)}\n    DATA {teks(f"geometry FROM ({sql}) AS t USING UNIQUE id USING SRID=4326")}\n'
            f'    PROJECTION "init=epsg:4326" END\n    TEMPLATE "kosong"\n'
            + (f'    MAXSCALEDENOM {skala}\n' if skala else '')
            + metadata(judul) + f'    CLASS {gaya} END\n  END\n')


def raster(r, koneksi):
    c = r['extent']
    pg = (f"PG:{koneksi} schema=public table=analitik_raster_oseanografi column=rast "
          f"where='id IN ({','.join(map(str, r['id']))})' mode=2")
    return (f'  LAYER\n    NAME "oseanografi_{r["parameter"].lower()}"\n    TYPE RASTER\n    STATUS ON\n'
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
        lapisan = [(n, j, s, 'POLYGON', z) for n, j, s, z in VEKTOR]
        lapisan += [(f'ekosistem_{k.lower()}', v,
                     f"SELECT id, jenis, nama, luas_ha, kondisi, tahun_data, sumber_data, COALESCE(geometry_tampilan, geometry) "
                     f"AS geometry FROM inventarisasi_sumber_daya_alam WHERE jenis = '{k}'", 'POLYGON', 2000000)
                    for k, v in EKOSISTEM.items()]
        with connection.cursor() as c:
            for awalan, tabel, kolom, isi in PER_KATEGORI:
                c.execute(f'SELECT DISTINCT {kolom}, ST_Dimension(geometry) FROM {tabel} '
                          f'WHERE {kolom} IS NOT NULL AND NOT ST_IsEmpty(geometry) ORDER BY 1, 2')
                for nilai, dimensi in c.fetchall():
                    aman = nilai.replace("'", "''")
                    lapisan.append((f'{awalan}_{nilai.lower()}_{JENIS_GEOMETRI[dimensi].lower()}', f'{awalan.replace("_", " ").capitalize()}: {nilai}',
                                    f"SELECT {isi}, geometry FROM {tabel} WHERE {kolom} = '{aman}' AND ST_Dimension(geometry) = {dimensi}",
                                    JENIS_GEOMETRI[dimensi], 2000000))
        judul = dict(RasterOseanografi.PARAMETER_CHOICES)
        rasters = {}
        for r in RasterOseanografi.objects.order_by('parameter', 'id').values('id', 'parameter', 'cakupan', 'satuan', 'periode', 'sumber'):
            e = r['cakupan'].extent
            g = rasters.setdefault(r['parameter'], {**r, 'id': [], 'extent': e, 'judul': judul.get(r['parameter'], r['parameter'])})
            g['id'].append(r['id'])
            g['extent'] = (min(g['extent'][0], e[0]), min(g['extent'][1], e[1]), max(g['extent'][2], e[2]), max(g['extent'][3], e[3]))
        rasters = list(rasters.values())
        alamat = os.getenv('PETA_URL', '')
        isi = ('MAP\n  NAME "kkp"\n  STATUS ON\n  EXTENT 94 -12 142 7\n  SIZE 800 600\n  UNITS DD\n  IMAGECOLOR 255 255 255\n'
               '  PROJECTION "init=epsg:4326" END\n  SYMBOL NAME "titik" TYPE ELLIPSE FILLED TRUE POINTS 1 1 END END\n'
               '  OUTPUTFORMAT NAME "geojson" DRIVER "OGR/GEOJSON" MIMETYPE "application/json; subtype=geojson" '
               'FORMATOPTION "STORAGE=stream" FORMATOPTION "FORM=SIMPLE" END\n'
               '  OUTPUTFORMAT NAME "GTiff" DRIVER "GDAL/GTiff" MIMETYPE "image/tiff" IMAGEMODE FLOAT32 EXTENSION "tif" END\n'
               '  WEB\n    METADATA\n      "ows_title" "Platform Manajemen Investasi Ruang Laut - KKP"\n'
               '      "ows_abstract" "Data rujukan ruang laut: tata ruang, perizinan, batas wilayah, infrastruktur, ekosistem, '
               'oseanografi, risiko bencana, dan Peta Sebaran Wilayah Potensial Investasi"\n'
               f'      "ows_onlineresource" {teks(alamat + "?")}\n      "ows_srs" "EPSG:4326 EPSG:3857"\n'
               '      "ows_enable_request" "*"\n      "ows_encoding" "UTF-8"\n      "wfs_maxfeatures" "10000"\n'
               '      "wfs_getfeature_formatlist" "geojson"\n      "wms_feature_info_mime_type" "application/vnd.ogc.gml"\n'
               '    END\n  END\n'
               + ''.join(vektor(n, j, s, t, koneksi, WARNA[i % len(WARNA)], z) for i, (n, j, s, t, z) in enumerate(lapisan))
               + ''.join(raster(r, koneksi) for r in rasters) + 'END\n')
        berkas = Path(os.getenv('PETA_MAPFILE') or settings.BASE_DIR.parent / 'peta' / 'kkp.map')
        berkas.parent.mkdir(parents=True, exist_ok=True)
        sementara = berkas.with_suffix('.baru')
        sementara.write_text(isi, encoding='utf-8')
        sementara.chmod(0o644)
        sementara.replace(berkas)
        self.stdout.write(f'Mapfile ditulis: {berkas} ({len(lapisan)} layer vektor, {len(rasters)} layer raster)')
