import glob
import html
import json
import os
import re
import tempfile
import time
from ctypes import c_char_p, c_int, c_void_p

import httpx
from django.contrib.gis.gdal import DataSource, SpatialReference
from django.contrib.gis.gdal.libgdal import lgdal
from django.contrib.gis.gdal.prototypes import ds as capi
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from analitik.services.screening_ruang import isi_ketentuan_bawaan
from inti.models import Provinsi
from inventarisasi.klasifikasi import jenis_kawasan, sub_zona
from inventarisasi.management.commands._geometri import perbaiki_geometri
from inventarisasi.models import ZonasiRuangLaut

FOLDER_DRIVE = '1aFW7j1rPi5L_UYSy-7oY9fEO2LflRsb7'
TANDA = 'KKP-RTRW'
TAHUN_INTEGRASI_LAUT = 2021
KATA_LAUT = (
    'pemanfaatan umum', 'zona ', 'konservasi', 'laut', 'perikanan', 'pesisir', 'mangrove', 'pariwisata',
    'transportasi', 'pelabuhan', 'pertambangan', 'energi', 'industri', 'pengerukan', 'pertahanan',
)
POLA = re.compile(r'<a href="https://drive\.google\.com/(file/d|drive/folders)/([A-Za-z0-9_-]+)[^"]*"[^>]*>'
                  r'.*?<div class="flip-entry-title">([^<]*)</div>', re.S)

def _isi_folder(fid):
    for ke in range(4):
        try:
            teks = httpx.get(f'https://drive.google.com/embeddedfolderview?id={fid}', timeout=60).text
            return [(jenis == 'drive/folders', id_, html.unescape(nama)) for jenis, id_, nama in POLA.findall(teks)]
        except httpx.HTTPError:
            time.sleep(2 ** ke)
    raise RuntimeError(f'Folder Drive {fid} tidak dapat dibaca.')


def _berkas(fid, jalur=()):
    for folder, id_, nama in _isi_folder(fid):
        if folder:
            yield from _berkas(id_, (*jalur, nama))
        else:
            yield (*jalur, nama), id_


def _unduh(fid, tujuan):
    for ke in range(5):
        try:
            r = httpx.get(f'https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t',
                          timeout=300, follow_redirects=True)
            r.raise_for_status()
            if r.content[:15].lower().startswith(b'<!doctype html'):
                raise httpx.HTTPError('Drive membalas halaman HTML')
            with open(tujuan, 'wb') as f:
                f.write(r.content)
            return
        except httpx.HTTPError:
            time.sleep(2 ** ke)
    raise RuntimeError(f'Berkas Drive {fid} gagal diunduh.')


def _fungsi(nama, hasil):
    f = lgdal[nama]
    f.restype = hasil
    f.argtypes = [c_void_p] * (2 if nama == 'OGR_G_TransformTo' else 1)
    return f


OGR = {nama: _fungsi(nama, hasil) for nama, hasil in (
    ('OGR_F_GetGeometryRef', c_void_p), ('OGR_G_Clone', c_void_p), ('OGR_G_ForceToMultiPolygon', c_void_p),
    ('OGR_G_ExportToJson', c_void_p), ('OGR_G_TransformTo', c_int), ('OGR_G_DestroyGeometry', None), ('VSIFree', None),
)}
WGS84 = SpatialReference(4326)


def geojson_fitur(fitur, ubah):
    acuan = OGR['OGR_F_GetGeometryRef'](fitur.ptr)
    if not acuan:
        return None
    g = OGR['OGR_G_ForceToMultiPolygon'](OGR['OGR_G_Clone'](acuan))
    if ubah:
        OGR['OGR_G_TransformTo'](g, WGS84.ptr)
    teks = OGR['OGR_G_ExportToJson'](g)
    hasil = json.loads(c_char_p(teks).value)
    OGR['VSIFree'](teks)
    OGR['OGR_G_DestroyGeometry'](g)
    return hasil


def _tipe_poligon(lapisan):
    return (capi.get_fd_geom_type(lapisan._ldefn) & 0x7FFFFFFF) % 1000 in (3, 6, 10, 12)


def lapisan_laut(ds, gdb_laut=False):
    poligon = [
        lap for lap in ds
        if not lap.name.upper().startswith('T_') and _tipe_poligon(lap)
        and {'JNSRPR', 'NAMOBJ'} & {m.upper() for m in lap.fields}
    ]
    khusus = [lap for lap in poligon if 'KKPRL' in lap.name.upper()
              or (gdb_laut and 'JNSRPR' in {m.upper() for m in lap.fields})]
    if khusus:
        return khusus, False
    return [lap for lap in poligon if re.search(r'(AR_PR|PR_PR)_', lap.name.upper())], True


def atribut(fitur, medan):
    def ambil(kunci):
        nilai = fitur.get(medan[kunci]) if kunci in medan else None
        teks = str(nilai).strip() if nilai is not None else ''
        return '' if teks in ('-', 'None', 'Tidak Ada') else teks

    jnsrpr, namobj = ambil('JNSRPR'), ambil('NAMOBJ')
    teks_zona = ' '.join(filter(None, [ambil('SUB_ZONA'), namobj]))
    jenis = jenis_kawasan(namobj if jnsrpr.isdigit() or not jnsrpr else jnsrpr)
    return {
        'nama_zona': (namobj or ambil('SUB_ZONA') or 'Zona RTRW')[:255],
        'jenis_zona': jenis,
        'sub_zona': sub_zona(teks_zona, jenis),
        'teks': f'{jnsrpr} {teks_zona}'.lower(),
        'adat': ambil('WKMHA'),
        'keterangan': '; '.join(filter(None, [
            ambil('KODKWS') and f'Kode {ambil("KODKWS")}', ambil('REMARK'),
            ambil('WKMHA') and f'Wilayah kelola masyarakat hukum adat: {ambil("WKMHA")}',
        ]))[:2000],
    }


def kunci(teks):
    return re.sub(r'[^a-z0-9]', '', teks.lower())


class Command(BaseCommand):
    help = ('Tarik zona laut dari geodatabase RTRW Provinsi (folder Google Drive KKP) ke ZonasiRuangLaut '
            f'sebagai acuan RTRW Provinsi ({TANDA}).')

    def add_arguments(self, parser):
        parser.add_argument('--provinsi', action='append', help='Kode BPS provinsi, mis. 33 (boleh berulang).')
        parser.add_argument('--folder', default=FOLDER_DRIVE, help='ID folder Google Drive berisi RTRW per provinsi.')
        parser.add_argument('--simpan-di', default=os.path.join(tempfile.gettempdir(), 'kkp-rtrw'),
                            help='Folder unduhan geodatabase (dipakai ulang bila berkasnya sudah ada).')

    def handle(self, *args, **opsi):
        diminta = set(opsi['provinsi'] or [])
        for folder, fid, nama in _isi_folder(opsi['folder']):
            m = re.match(r'\[(\d{2})00\]', nama)
            if not (folder and m) or (diminta and m.group(1) not in diminta):
                continue
            provinsi = Provinsi.objects.filter(kode_bps=m.group(1)).first()
            if provinsi is None:
                continue
            self.stdout.write(self.style.MIGRATE_HEADING(nama))
            akar = os.path.join(opsi['simpan_di'], m.group(1) + '00')
            for jalur, id_ in _berkas(fid):
                gdb = [i for i, b in enumerate(jalur[:-1]) if b.lower().endswith('.gdb')]
                if not gdb:
                    continue
                tujuan = os.path.join(akar, *jalur[gdb[-1]:])
                if not os.path.exists(tujuan):
                    os.makedirs(os.path.dirname(tujuan), exist_ok=True)
                    _unduh(id_, tujuan)
            self._impor(provinsi, akar)
        dibuat = isi_ketentuan_bawaan()
        if dibuat:
            self.stdout.write(f'{dibuat} ketentuan ruang bawaan ditambahkan untuk sub-zona baru.')

    def _impor(self, provinsi, akar):
        baris, pilihan = [], []
        for gdb in sorted(glob.glob(os.path.join(akar, '**', '*.gdb'), recursive=True)):
            if not glob.glob(os.path.join(gdb, '*.gdb')):
                ds = DataSource(gdb)
                pilihan.append((gdb, ds, *lapisan_laut(ds, 'KKPRL' in os.path.basename(gdb).upper())))
        ada_khusus = any(lapisan and not saring for _, _, lapisan, saring in pilihan)
        for gdb, ds, lapisan, saring in pilihan:
            if saring and ada_khusus:
                self.stdout.write(f'  {os.path.basename(gdb)}: Pola Ruang campuran tidak dipakai, '
                                  'provinsi ini punya data zona laut khusus.')
                continue
            nama = [os.path.basename(gdb), *(lap.name for lap in (lapisan if not saring else ds))]
            tahun = max((int(t) for n in nama for t in re.findall(r'(?<!\d)(20[0-4]\d)(?!\d)', n)), default=None)
            if saring and (tahun is None or tahun < TAHUN_INTEGRASI_LAUT):
                self.stdout.write(f'  {os.path.basename(gdb)}: RTRWP {tahun or "tanpa tahun"} disusun sebelum '
                                  'zonasi laut diintegrasikan ke RTRW, dilewati.')
                continue
            for lap in lapisan:
                medan = {m.upper(): m for m in lap.fields}
                ubah = lap.srs is not None and not lap.srs.geographic
                n = 0
                for f in lap:
                    a = atribut(f, medan)
                    if saring and not any(k in a['teks'] for k in KATA_LAUT):
                        continue
                    geom, _ = perbaiki_geometri(geojson_fitur(f, ubah))
                    if geom is None:
                        continue
                    baris.append((ZonasiRuangLaut(
                        provinsi=provinsi, tingkat_acuan='RTRW_PROVINSI', nama_zona=a['nama_zona'],
                        jenis_zona=a['jenis_zona'], sub_zona=a['sub_zona'], geometry=geom,
                        nomor_regulasi=' '.join(filter(None, ['RTRW Provinsi', provinsi.nama, str(tahun or '')])),
                        tahun_penetapan=tahun,
                        keterangan=a['keterangan'], sumber_data=TANDA,
                    ), saring, a['adat']))
                    n += 1
                self.stdout.write(f'  {lap.name}: {n} zona{" (disaring ke laut)" if saring else ""}')

        with transaction.atomic():
            ZonasiRuangLaut.objects.filter(provinsi=provinsi, sumber_data=TANDA).delete()
            ZonasiRuangLaut.objects.bulk_create([z for z, _, _ in baris], batch_size=500)
            saring_id = [z.id for z, saring, _ in baris if saring]
            adat = {}
            for z, _, nama_adat in baris:
                if nama_adat:
                    adat.setdefault(nama_adat, []).append(z.id)
            with connection.cursor() as c:
                c.execute(
                    """
                    DELETE FROM inventarisasi_zonasi_ruang_laut z
                    WHERE z.id = ANY(%s) AND EXISTS (
                        SELECT 1 FROM inti_provinsi p
                        WHERE p.geometry && ST_PointOnSurface(z.geometry)
                          AND ST_Intersects(p.geometry, ST_PointOnSurface(z.geometry))
                    )
                    """,
                    [saring_id],
                )
                darat = c.rowcount
                c.execute(
                    'UPDATE inventarisasi_zonasi_ruang_laut SET luas_ha = ST_Area(geometry::geography) / 10000 '
                    'WHERE provinsi_id = %s AND sumber_data = %s',
                    [provinsi.id, TANDA],
                )
                tersimpan = c.rowcount
                c.execute(
                    "DELETE FROM inventarisasi_unsur_ruang_laut WHERE kelompok = 'MHA' AND provinsi_id = %s "
                    'AND sumber_data = %s',
                    [provinsi.id, TANDA],
                )
                wilayah_adat = 0
                for nama_adat, ids in adat.items():
                    c.execute(
                        """
                        INSERT INTO inventarisasi_unsur_ruang_laut (kelompok, kode_lapisan, nama, jenis, keterangan,
                            nomor_regulasi, provinsi_id, geometry, luas_ha, sumber_data, created_at, updated_at)
                        SELECT 'MHA', 'RTRW Provinsi (kolom WKMHA)', %s, 'Wilayah Kelola Masyarakat Hukum Adat', %s,
                               %s, %s, d.geom, ST_Area(d.geom::geography) / 10000, %s, now(), now()
                        FROM (
                            SELECT (ST_Dump(ST_Union(ST_MakeValid(geometry)))).geom AS geom
                            FROM inventarisasi_zonasi_ruang_laut WHERE id = ANY(%s)
                        ) d
                        WHERE ST_GeometryType(d.geom) = 'ST_Polygon'
                        """,
                        [
                            f'Wilayah kelola MHA (RTRW Provinsi {provinsi.nama})' if nama_adat == 'Ada' else nama_adat,
                            'Zona laut RTRW Provinsi yang ditandai berada di wilayah kelola masyarakat hukum adat'
                            + ('; data RTRW tidak mencantumkan nama masyarakat adatnya.' if nama_adat == 'Ada' else '.'),
                            f'RTRW Provinsi {provinsi.nama}', provinsi.id, TANDA, ids,
                        ],
                    )
                    wilayah_adat += c.rowcount
        self.stdout.write(self.style.SUCCESS(
            f'  {tersimpan} zona laut tersimpan' + (f', {darat} poligon darat dibuang' if darat else '')
            + (f', {wilayah_adat} poligon wilayah kelola masyarakat hukum adat' if wilayah_adat else '')
        ))
