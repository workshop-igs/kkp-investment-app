import time
from datetime import UTC, date, datetime

import httpx
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from inti.geospasial import hitung_luas_geodesik_ha
from inti.models import Provinsi
from inventarisasi.management.commands._geometri import jadikan_multipolygon
from inventarisasi.models import IzinTambang

LAYANAN = 'https://geoportal.esdm.go.id/gis1/rest/services/Join_WIUP_vs_IPPKH/MapServer/0/query'
JENIS = ('IUP', 'IUPK')
TAHUN = 5
HALAMAN = 1000
KOLOM = 'kode_wiup,nama_usaha,badan_usah,jenis_izin,kegiatan,komoditas,sk_iup,tgl_berlak,tgl_akhir,luas_sk,nama_prov,nama_kab'


def tanggal(ms):
    return None if ms is None else datetime.fromtimestamp(ms / 1000, UTC).date()


def syarat(hari_ini):
    try:
        awal = hari_ini.replace(year=hari_ini.year - TAHUN)
    except ValueError:
        awal = hari_ini.replace(year=hari_ini.year - TAHUN, day=28)
    jenis = ', '.join(f"'{j}'" for j in JENIS)
    return f"jenis_izin IN ({jenis}) AND tgl_berlak >= DATE '{awal}' AND tgl_berlak <= DATE '{hari_ini}'"


def ambil(klien, params):
    for ke in range(3):
        try:
            r = klien.get(LAYANAN, params=params)
            r.raise_for_status()
            isi = r.json()
            if 'error' in isi:
                raise CommandError(f"Geoportal ESDM menolak kueri: {isi['error'].get('message')}")
            return isi.get('features', [])
        except httpx.HTTPError:
            if ke == 2:
                raise
            time.sleep(2 ** ke)


def tarik(klien, hari_ini):
    fitur, mulai = [], 0
    while True:
        halaman = ambil(klien, {'where': syarat(hari_ini), 'outFields': KOLOM, 'outSR': 4326, 'orderByFields': 'objectid',
                                'resultOffset': mulai, 'resultRecordCount': HALAMAN, 'f': 'geojson'})
        fitur += halaman
        if len(halaman) < HALAMAN:
            break
        mulai += HALAMAN

    indeks = {p.nama.strip().lower(): p for p in Provinsi.objects.all()}
    objek, dilewati = [], 0
    for f in fitur:
        p = f.get('properties') or {}
        geom, berlaku = jadikan_multipolygon(f.get('geometry')), tanggal(p.get('tgl_berlak'))
        if geom is None or berlaku is None:
            dilewati += 1
            continue
        provinsi = (indeks.get((p.get('nama_prov') or '').strip().lower())
                    or Provinsi.objects.filter(geometry__intersects=geom.point_on_surface).first())
        objek.append(IzinTambang(
            kode_wiup=(p.get('kode_wiup') or '')[:40], nama_usaha=(p.get('nama_usaha') or '-')[:255],
            badan_usaha=(p.get('badan_usah') or '')[:40], jenis_izin=(p.get('jenis_izin') or '')[:10],
            kegiatan=(p.get('kegiatan') or '')[:40], komoditas=(p.get('komoditas') or '')[:100],
            sk_iup=(p.get('sk_iup') or '')[:100], tanggal_berlaku=berlaku, tanggal_akhir=tanggal(p.get('tgl_akhir')),
            luas_ha=float(p.get('luas_sk') or 0) or hitung_luas_geodesik_ha(f['geometry']),
            provinsi=provinsi, kabupaten=(p.get('nama_kab') or '')[:100], geometry=geom,
        ))
    if not objek:
        raise CommandError('Geoportal ESDM tidak mengembalikan IUP; data lama dipertahankan.')
    with transaction.atomic():
        IzinTambang.objects.all().delete()
        IzinTambang.objects.bulk_create(objek, batch_size=500)
    return len(objek), dilewati


class Command(BaseCommand):
    help = (f'Tarik wilayah IUP dan IUPK yang mulai berlaku dalam {TAHUN} tahun terakhir dari Geoportal ESDM '
            '(Ditjen Minerba). Data lama diganti hanya setelah seluruh halaman terunduh.')

    def handle(self, *args, **opsi):
        mulai = time.time()
        with httpx.Client(timeout=180, headers={'User-Agent': 'KKP-Investasi-RuangLaut/1.0'}) as klien:
            jumlah, dilewati = tarik(klien, date.today())
        self.stdout.write(self.style.SUCCESS(
            f'{jumlah} izin tambang dimuat, {dilewati} dilewati karena tanpa geometri atau tanggal ({time.time() - mulai:.0f} dtk)'))
