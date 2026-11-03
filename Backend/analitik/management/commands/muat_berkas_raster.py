import json
import math

import numpy as np
import rasterio
from django.contrib.gis.gdal import DataSource, GDALException, GDALRaster
from django.contrib.gis.geos import Polygon
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from rasterio.errors import RasterioIOError
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject, transform_bounds

from analitik.management.commands.muat_raster import KOSONG
from analitik.management.commands.tarik_risiko_bencana import PIKSEL_PER_DERAJAT
from analitik.management.commands.vektorkan_risiko_bencana import Command as Vektorkan
from analitik.models import RasterOseanografi, RasterRisikoBencana, ZonaRisikoBencana
from inti.models import Provinsi
from penarikan_data.inarisk import AMBANG_KELAS, VARIAN_JENIS

ASAL = (94.0, -11.0, 142.0, 7.0)
PETAK_OSEANOGRAFI = 6.0
NILAI_KELAS = {'RENDAH': 0.2, 'SEDANG': 0.5, 'TINGGI': 0.85}


def jalur_gdal(berkas):
    return f'/vsizip/{berkas}' if berkas.lower().endswith('.zip') else berkas


def _baca_vektor(jalur):
    lapis = DataSource(jalur)[0]
    kolom = {f.lower(): f for f in lapis.fields}
    return kolom, [({k: f.get(k) for k in lapis.fields}, f.geom.geos if f.geom else None) for f in lapis]


def _nilai_fitur(sifat, kolom, angka):
    v = sifat.get(kolom)
    if angka:
        return None if v is None else float(v)
    return NILAI_KELAS.get(str(v or '').strip().upper())


def baca_berkas(berkas, bencana):
    jalur = jalur_gdal(berkas)
    try:
        with rasterio.open(jalur) as r:
            if r.crs is None:
                raise ValueError('Raster tidak memiliki sistem koordinat.')
            return 'raster', jalur, transform_bounds(r.crs, 'EPSG:4326', *r.bounds)
    except RasterioIOError:
        pass
    try:
        kolom, fitur = _baca_vektor(jalur)
    except (GDALException, IndexError):
        raise ValueError('Berkas tidak dapat dibaca sebagai data geospasial.') from None
    if not bencana:
        raise ValueError('Data ini harus berupa raster GeoTIFF.')
    if 'indeks' not in kolom and 'kelas' not in kolom:
        raise ValueError('Poligon wajib punya kolom "indeks" (0 sampai 1) atau "kelas" (rendah, sedang, tinggi).')
    angka = 'indeks' in kolom
    bentuk = []
    for sifat, g in fitur:
        v = _nilai_fitur(sifat, kolom['indeks' if angka else 'kelas'], angka)
        if v is None or g is None:
            continue
        if g.srid is None:
            g.srid = 4326
        g.transform(4326)
        bentuk.append((g, v))
    if not bentuk:
        raise ValueError('Tidak ada poligon dengan nilai indeks atau kelas yang terbaca.')
    x0, y0 = min(g.extent[0] for g, _ in bentuk), min(g.extent[1] for g, _ in bentuk)
    x1, y1 = max(g.extent[2] for g, _ in bentuk), max(g.extent[3] for g, _ in bentuk)
    return 'vektor', [(json.loads(g.geojson), v) for g, v in bentuk], (x0, y0, x1, y1)


def baca_petak(jenis, isi, kotak, resolusi):
    lebar, tinggi = round((kotak[2] - kotak[0]) / resolusi), round((kotak[3] - kotak[1]) / resolusi)
    transform = from_origin(kotak[0], kotak[3], resolusi, resolusi)
    if jenis == 'vektor':
        return rasterize(isi, out_shape=(tinggi, lebar), transform=transform, fill=np.nan, dtype='float32').astype('float64')
    hasil = np.full((tinggi, lebar), np.nan, dtype='float32')
    with rasterio.open(isi) as r:
        reproject(rasterio.band(r, 1), hasil, dst_transform=transform, dst_crs='EPSG:4326', dst_nodata=np.nan,
                  resampling=Resampling.average)
    return hasil.astype('float64')


def data_lama(r):
    if r is None:
        return None
    pita = r.bands[0]
    data = pita.data().reshape(r.height, r.width).astype('float64')
    if pita.nodata_value is not None:
        data[data == pita.nodata_value] = np.nan
    return data


def timpa(berkas, bencana, resolusi, petak, lama, simpan, sah=None):
    jenis, isi, (x0, y0, x1, y1) = baca_berkas(berkas, bencana)
    x0, y0, x1, y1 = max(x0, ASAL[0]), max(y0, ASAL[1]), min(x1, ASAL[2]), min(y1, ASAL[3])
    if x0 >= x1 or y0 >= y1:
        raise ValueError('Berkas berada di luar wilayah Indonesia.')
    terisi, nilai = [], []
    for i in range(math.floor((x0 - ASAL[0]) / petak), math.ceil((x1 - ASAL[0]) / petak)):
        for j in range(math.floor((y0 - ASAL[1]) / petak), math.ceil((y1 - ASAL[1]) / petak)):
            kotak = (ASAL[0] + i * petak, ASAL[1] + j * petak, ASAL[0] + (i + 1) * petak, ASAL[1] + (j + 1) * petak)
            baru = baca_petak(jenis, isi, kotak, resolusi)
            if np.isnan(baru).all():
                continue
            nilai.append(baru[~np.isnan(baru)])
            dulu = data_lama(lama(kotak))
            if dulu is not None and dulu.shape == baru.shape:
                baru = np.where(np.isnan(baru), dulu, baru)
            terisi.append((kotak, baru))
    if not terisi:
        raise ValueError('Berkas tidak berisi nilai di wilayah Indonesia.')
    nilai = np.concatenate(nilai)
    kecil, besar = float(nilai.min()), float(nilai.max())
    if sah:
        sah(kecil, besar)
    with transaction.atomic():
        for kotak, data in terisi:
            simpan(kotak, data)
    return [k for k, _ in terisi], kecil, besar


def gdal_raster(kotak, data, resolusi):
    return GDALRaster({
        'srid': 4326, 'width': data.shape[1], 'height': data.shape[0], 'origin': [kotak[0], kotak[3]],
        'scale': [resolusi, -resolusi], 'datatype': 6,
        'bands': [{'data': np.where(np.isnan(data), KOSONG, data).astype('float32').ravel(), 'nodata_value': KOSONG}],
    })


def poligon(kotak):
    p = Polygon.from_bbox(kotak)
    p.srid = 4326
    return p


def sah_indeks(kecil, besar):
    if kecil < 0 or besar > AMBANG_KELAS[-1][0]:
        raise ValueError(f'Nilai indeks risiko harus 0 sampai 1; berkas berisi {kecil:.2f} sampai {besar:.2f}.')


def muat_bencana(berkas, jenis, keterangan):
    varian = VARIAN_JENIS.get(jenis)
    if varian is None:
        raise ValueError(f'Jenis bencana {jenis} tidak dikenal.')
    resolusi = 1 / PIKSEL_PER_DERAJAT
    saring = {'jenis': jenis, 'varian': varian}

    def lama(kotak):
        r = RasterRisikoBencana.objects.filter(**saring, cakupan__equals=poligon(kotak)).only('rast').first()
        return r and r.rast

    def simpan(kotak, data):
        batas = poligon(kotak)
        RasterRisikoBencana.objects.filter(**saring, cakupan__equals=batas).delete()
        ZonaRisikoBencana.objects.filter(**saring, cakupan__equals=batas).delete()
        r = RasterRisikoBencana.objects.create(
            **saring, rast=gdal_raster(kotak, data, resolusi), cakupan=batas, nilai_maks=float(np.nanmax(data)),
            sumber=keterangan[:120], layanan='Unggahan admin')
        Vektorkan()._vektorkan(r.id, jenis, varian)

    return timpa(berkas, True, resolusi, 1.0, lama, simpan, sah_indeks)


def muat_kondisi(berkas, kode, keterangan):
    contoh = RasterOseanografi.objects.filter(parameter=kode).only('rast', 'satuan').first()
    if contoh is None:
        raise ValueError(f'Parameter {kode} belum pernah dimuat.')
    resolusi = round(contoh.rast.scale.x, 6)

    def lama(kotak):
        r = RasterOseanografi.objects.filter(parameter=kode, cakupan__equals=poligon(kotak)).only('rast').first()
        return r and r.rast

    def simpan(kotak, data):
        batas = poligon(kotak)
        RasterOseanografi.objects.filter(parameter=kode, cakupan__equals=batas).delete()
        RasterOseanografi.objects.create(parameter=kode, rast=gdal_raster(kotak, data, resolusi), cakupan=batas,
                                         satuan=contoh.satuan, sumber=keterangan[:400])

    return timpa(berkas, False, resolusi, PETAK_OSEANOGRAFI, lama, simpan)


class Command(BaseCommand):
    help = 'Ganti raster risiko bencana atau kondisi fisik dengan berkas unggahan admin di wilayah yang dicakup berkas.'

    def add_arguments(self, parser):
        parser.add_argument('--kelompok', required=True, choices=['bencana', 'kondisi_tetap'])
        parser.add_argument('--kode', required=True)
        parser.add_argument('--berkas', required=True)
        parser.add_argument('--keterangan', required=True)

    def handle(self, *args, **o):
        muat = muat_bencana if o['kelompok'] == 'bencana' else muat_kondisi
        try:
            kotak, kecil, besar = muat(o['berkas'], o['kode'], o['keterangan'])
        except ValueError as e:
            raise CommandError(str(e)) from None
        wilayah = poligon((min(k[0] for k in kotak), min(k[1] for k in kotak),
                           max(k[2] for k in kotak), max(k[3] for k in kotak)))
        provinsi = list(Provinsi.objects.filter(geometry__intersects=wilayah).values_list('kode_bps', flat=True))
        self.stdout.write(self.style.SUCCESS(
            f"{o['kode']}: {len(kotak)} petak diganti, nilai {kecil:.3f} sampai {besar:.3f}, {len(provinsi)} provinsi"))
        return json.dumps({'dimuat': provinsi or True, 'petak': len(kotak)})
