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
from pypdf import PdfReader

from analitik.models import KetentuanRuang
from analitik.services.screening_ruang import isi_ketentuan_bawaan
from inti.models import Provinsi, SektorInvestasi
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

MATRIKS_TERVERIFIKASI = {'52'}
PENANDA_MATRIKS = 'Lampiran Matriks KKPRL'
STATUS_KOLOM = ('DIIZINKAN', 'BERSYARAT', 'TIDAK_DIIZINKAN')
KEGIATAN_INTI = {
    'PERIKANAN_TANGKAP': ('Penangkapan Pisces/Ikan Bersirip di Laut',),
    'PERIKANAN_BUDIDAYA': ('Pembesaran Pisces/Ikan Bersirip di Laut',),
    'PARIWISATA_BAHARI': ('Wisata Selam', 'Wisata Pantai'),
    'ENERGI_KELAUTAN': ('Pembangkitan Tenaga Listrik',),
    'PENGOLAHAN_HASIL_LAUT': ('Industri Pembekuan Ikan',),
    'JASA_MARITIM': ('Aktivitas Pelayanan Kepelabuhan Laut', 'Aktivitas Pelayanan Kepelabuhanan Laut'),
    'INFRASTRUKTUR_LAUT': ('Konstruksi Bangunan Pelabuhan Bukan Perikanan',
                           'Konstruksi Bangunan Bukan Pelabuhan Perikanan'),
    'GARAM': ('Ekstraksi Garam', 'Ekstrasi Garam'),
    'BIOTEKNOLOGI_KELAUTAN': ('Penelitian dan Pengembangan Bioteknologi',),
    'KONSERVASI_PESISIR': ('Rehabilitasi/Transplantasi/Restorasi Ekosistem',),
}
KODE_ZONA = re.compile(r'\b([A-Z]{1,4})\s*-\s*(\d{2,4})\b')
KOORDINAT = re.compile(r"(\d{2,3})\D{1,3}?\s*(\d{1,3})'\s*([\d,.]+)\"\s*BT\s+(\d{1,2})\D{1,3}?\s*(\d{1,2})'\s*([\d,.]+)\"\s*LS")
JUDUL_TABEL = re.compile(r'^(ZONA|KAWASAN) [^/]*\((?!HA\))[A-Z]{1,4}\)')
AKHIR_TABEL = re.compile(r'^Sumber\s*:')
KEPALA_KHUSUS = re.compile(r'^(?:(?:KETENTUAN|KHUSUS|DAN/ATAU|TAMBAHAN)\s*)+')
GLIF = '•�-'


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


def bersih(teks):
    teks = re.sub(rf'(\d)\s*[{GLIF}]\s*(?=\d)', r'\1° ', teks)
    return re.sub(r'\s+', ' ', re.sub(f'[{GLIF}]', '•', teks)).strip()


def kunci(teks):
    return re.sub(r'[^a-z0-9]', '', teks.lower())


def status_kegiatan(kolom, jarum):
    for j in jarum:
        ada = [STATUS_KOLOM[i] for i in range(3) if kunci(j) in kunci(kolom[i])]
        if ada:
            return ada[-1]
    return None


def titik_zona(teks):
    k, c = KODE_ZONA.search(teks), KOORDINAT.search(teks)
    if not (k and c):
        return None
    bd, bm, bs, ld, lm, ls = c.groups()
    return f'{k.group(1)}-{k.group(2)}', (
        int(bd) + int(bm) / 60 + float(bs.replace(',', '.')) / 3600,
        -(int(ld) + int(lm) / 60 + float(ls.replace(',', '.')) / 3600),
    )


def _baris(potongan):
    baris = []
    for y, x, t in sorted(potongan, key=lambda p: (-p[0], p[1])):
        if baris and baris[-1][0] - y <= 1.5:
            baris[-1][1].append((x, t))
        else:
            baris.append([y, [(x, t)]])
    return [(y, sorted(isi)) for y, isi in baris]


def _tepi_kolom(baris, n, peluru):
    y0, isi = baris[n]
    lintang = next((x for x, t in isi if 'LINTANG' in t), None)
    tidak = next((x for x, t in isi if 'TIDAK' in t), None)
    bers = next((i for i, (_, t) in enumerate(isi) if 'BERSYARAT' in t), None)
    khusus = next((x for y, s in baris if y0 - 2 <= y <= y0 + 30 for x, t in s if 'KHUSUS' in t), None)
    if None in (lintang, tidak, bers, khusus):
        return None
    bx = isi[bers - 1][0] if isi[bers][1].strip() == 'BERSYARAT' and bers else isi[bers][0]
    dip = [x for x, t in isi if 'DIPERBOLEHKAN' in t and lintang < x < bx - 20]
    if not dip:
        return None
    tepi = []
    for kira, geser in ((min(dip), 35), (bx, 35), (tidak, 35), (khusus, 15)):
        dekat = [p for p in peluru if kira - geser - 25 <= p <= kira - geser + 40]
        tepi.append((min(dekat) if dekat else kira - geser) - 2)
    return tepi


def baca_matriks(path):
    tabel, aktif, perda = {}, None, ''
    for hal in PdfReader(path).pages:
        potongan, peluru = [], []

        def lihat(t, cm, tm, *_, potongan=potongan, peluru=peluru):
            if t.strip():
                x = cm[0] * tm[4] + cm[2] * tm[5] + cm[4]
                potongan.append((cm[1] * tm[4] + cm[3] * tm[5] + cm[5], x, t))
                if re.match(f'[{GLIF}]', t.strip()):
                    peluru.append(x)

        hal.extract_text(visitor_text=lihat)
        baris = _baris(potongan)
        m = re.search(r'PERATURAN DAERAH (PROVINSI .+?) NOMOR (\d+) TAHUN (\d{4})',
                      ' '.join(t for _, isi in baris for _, t in isi).replace('\n', ' '))
        if m and not perda:
            wilayah = re.sub(r'\s+', ' ', m.group(1)).title()
            perda = f'Perda {wilayah} No. {m.group(2)}/{m.group(3)}'
        tepi, y_kepala = None, None
        for n, (y, isi) in enumerate(baris):
            gabung = re.sub(r'\s+', ' ', ' '.join(t for _, t in isi)).strip()
            gabung = re.sub(r'\(([A-Z ]{1,8})\)', lambda m: '(' + m.group(1).replace(' ', '') + ')', gabung)
            if JUDUL_TABEL.match(gabung):
                aktif = tabel.setdefault(gabung, {'judul': gabung, 'kolom': ['', '', '', ''], 'zona': {}})
                tepi = None
            elif 'BERSYARAT' in gabung:
                tepi, y_kepala = _tepi_kolom(baris, n, peluru), y
            elif AKHIR_TABEL.match(gabung):
                aktif = None
            elif aktif is not None and tepi is not None and y < y_kepala - 9:
                for i, batas in enumerate(tepi):
                    akhir = tepi[i + 1] if i < 3 else float('inf')
                    aktif['kolom'][i] += ' ' + ' '.join(t for x, t in isi if batas <= x < akhir)
                titik = titik_zona(' '.join(t for x, t in isi if x < tepi[0]))
                if titik:
                    aktif['zona'].setdefault(*titik)
    for t in tabel.values():
        t['kolom'][3] = KEPALA_KHUSUS.sub('', bersih(t['kolom'][3]))
        t['sub_zona'] = sub_zona(t['judul'], jenis_kawasan(t['judul']))
        t['nama'] = re.sub(r'\s*\([A-Z]+\)', '', t['judul'].split(' DI ')[0]).title()
    return perda, list(tabel.values())


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
            matriks = None
            for jalur, id_ in _berkas(fid):
                gdb = [i for i, b in enumerate(jalur[:-1]) if b.lower().endswith('.gdb')]
                nama_berkas = jalur[-1].lower()
                if gdb:
                    tujuan = os.path.join(akar, *jalur[gdb[-1]:])
                elif (m.group(1) in MATRIKS_TERVERIFIKASI and matriks is None
                      and 'matriks' in nama_berkas and nama_berkas.endswith('.pdf')):
                    tujuan = matriks = os.path.join(akar, jalur[-1])
                else:
                    continue
                if not os.path.exists(tujuan):
                    os.makedirs(os.path.dirname(tujuan), exist_ok=True)
                    _unduh(id_, tujuan)
            self._impor(provinsi, akar)
            if matriks:
                self._terapkan_matriks(provinsi, matriks)
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

    def _terapkan_matriks(self, provinsi, path):
        perda, tabel = baca_matriks(path)
        if not perda or not tabel:
            self.stdout.write(self.style.WARNING(f'  {os.path.basename(path)}: matriks KKPRL tidak terbaca, dilewati.'))
            return
        acuan = {}
        for t in tabel:
            lama = acuan.get(t['sub_zona'])
            if t['sub_zona'] != 'KONSERVASI' and (lama is None or len(t['zona']) > len(lama['zona'])):
                acuan[t['sub_zona']] = t
        sektor = {s.kode: s for s in SektorInvestasi.objects.filter(kode__in=KEGIATAN_INTI)}
        status = {sub: {k: status_kegiatan(t['kolom'], KEGIATAN_INTI[k]) for k in sektor} for sub, t in acuan.items()}
        sumber = f'{perda}, {PENANDA_MATRIKS}'
        label = dict(KetentuanRuang.STATUS_CHOICES)
        aturan = [
            KetentuanRuang(
                sektor=sektor[k], sub_zona=sub, provinsi=provinsi, status=st,
                syarat=(acuan[sub]['kolom'][3] or 'Diperbolehkan bersyarat menurut matriks KKPRL.')
                if st == 'BERSYARAT' else '',
                sumber=f'{sumber} ({acuan[sub]["nama"]})'[:255],
            )
            for sub, per_sektor in status.items() for k, st in per_sektor.items() if st
        ]
        tangkap, budidaya = status.get('PERIKANAN_TANGKAP'), status.get('PERIKANAN_BUDIDAYA')
        if tangkap and budidaya:
            for k in sektor:
                a, b = tangkap[k], budidaya[k]
                if a and b:
                    st = a if a == b else 'BERSYARAT'
                    aturan.append(KetentuanRuang(
                        sektor=sektor[k], sub_zona='PERIKANAN', provinsi=provinsi, status=st,
                        syarat=(f'Kawasan Perikanan pada {perda} terbagi atas zona perikanan tangkap '
                                f'({label[a].lower()}) dan zona perikanan budi daya ({label[b].lower()}); '
                                'status pasti mengikuti kode zona di lokasi.') if st == 'BERSYARAT' else '',
                        sumber=f'{sumber} (Kawasan Perikanan)',
                    ))

        titik = {k: (xy, t) for t in tabel for k, xy in t['zona'].items()}
        with transaction.atomic():
            KetentuanRuang.objects.filter(provinsi=provinsi, sumber__contains=PENANDA_MATRIKS).delete()
            KetentuanRuang.objects.bulk_create(aturan)
            with connection.cursor() as c:
                c.execute(
                    """
                    SELECT t.kode, z.id
                    FROM unnest(%s::text[], %s::float8[], %s::float8[]) AS t(kode, x, y)
                    CROSS JOIN LATERAL (
                        SELECT z.id FROM inventarisasi_zonasi_ruang_laut z
                        WHERE z.provinsi_id = %s AND z.sumber_data = %s
                          AND ST_DWithin(z.geometry, ST_SetSRID(ST_Point(t.x, t.y), 4326), 0.002)
                        ORDER BY ST_Distance(z.geometry, ST_SetSRID(ST_Point(t.x, t.y), 4326))
                        LIMIT 1
                    ) z
                    """,
                    [list(titik), [xy[0] for xy, _ in titik.values()], [xy[1] for xy, _ in titik.values()],
                     provinsi.id, TANDA],
                )
                per_zona = {}
                for kode, zid in c.fetchall():
                    per_zona.setdefault(zid, []).append(kode)
            zona = list(ZonasiRuangLaut.objects.filter(id__in=per_zona))
            diperinci = 0
            for z in zona:
                kode = sorted(per_zona[z.id])
                jenis = {titik[k][1]['sub_zona'] for k in kode} & {'PERIKANAN_TANGKAP', 'PERIKANAN_BUDIDAYA'}
                if z.sub_zona == 'PERIKANAN' and len(jenis) == 1:
                    t = next(titik[k][1] for k in kode if titik[k][1]['sub_zona'] in jenis)
                    z.sub_zona, z.nama_zona = t['sub_zona'], t['nama']
                    diperinci += 1
                z.keterangan = '; '.join(filter(None, [z.keterangan, f'Kode zona Perda: {", ".join(kode)}']))[:2000]
            ZonasiRuangLaut.objects.bulk_update(zona, ['sub_zona', 'nama_zona', 'keterangan'], batch_size=500)
        self.stdout.write(self.style.SUCCESS(
            f'  Matriks KKPRL {perda}: {len(aturan)} ketentuan per jenis investasi; '
            f'{sum(len(v) for v in per_zona.values())} dari {len(titik)} kode zona tertaut ke poligon; '
            f'{diperinci} Kawasan Perikanan diperinci menjadi zona tangkap/budi daya'
        ))
