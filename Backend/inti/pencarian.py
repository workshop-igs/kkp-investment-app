import hashlib

from django.contrib.gis.db.models.functions import Envelope, PointOnSurface
from django.core.cache import cache
from django.db.models import Case, IntegerField, Q, When
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from inventarisasi.models import (
    KKPRL,
    InfrastrukturPendukung,
    PotensiInvestasi,
    UnsurRuangLaut,
    ZonasiRuangLaut,
)

from .geospasial import nama_kabupaten
from .models import DesaKelurahan, KabupatenKota, Kecamatan, Provinsi, WilayahPengelolaanPerikanan

MIN_KATA_KUNCI = 2

BATAS_PER_SUMBER = 6
BATAS_TOTAL = 24

CACHE_DETIK = 120


class ThrottlePencarian(SimpleRateThrottle):
    scope = 'peta'

    def get_cache_key(self, request, view):
        pengguna = getattr(request, 'user', None)
        ident = pengguna.pk if pengguna and pengguna.is_authenticated else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


def _titik(obj):
    t = getattr(obj, 'titik_wakil', None)
    if t is None or t.empty:
        return None
    return [round(t.x, 6), round(t.y, 6)]


def _peringkat(bidang, kata):
    return Case(
        When(**{f'{bidang}__iexact': kata}, then=0),
        When(**{f'{bidang}__istartswith': kata}, then=1),
        default=2,
        output_field=IntegerField(),
    )


def _cari_wilayah(model, kata, sumber, kolom, jenis, keterangan):
    qs = (
        model.objects.filter(nama__icontains=kata)
        .exclude(geometry=None)
        .annotate(peringkat=_peringkat('nama', kata), kotak=Envelope('geometry'))
        .order_by('peringkat', 'nama')
        .values('nama', 'peringkat', 'kotak', *kolom)[:BATAS_PER_SUMBER]
    )
    hasil = []
    for r in qs:
        cakupan = list(r['kotak'].extent) if r['kotak'] else None
        hasil.append(
            {
                'kelompok': 'Wilayah Administratif',
                'sumber': sumber,
                'kode': r[kolom[0]],
                'jenis': jenis(r),
                'nama': r['nama'],
                'keterangan': keterangan(r),
                'bbox': [round(v, 6) for v in cakupan] if cakupan else None,
                'titik': None,
                'peringkat': r['peringkat'],
            }
        )
    return hasil


def _cari_wpp(kata):
    angka = ''.join(h for h in kata if h.isdigit())
    saring = Q(kode__startswith=angka) if angka else Q(perairan__icontains=kata)
    if not angka and 'wpp' in kata.lower():
        saring = Q()
    qs = (
        WilayahPengelolaanPerikanan.objects.filter(saring)
        .annotate(kotak=Envelope('geometry'))
        .order_by('kode')
        .values('kode', 'perairan', 'zona_pit', 'kotak')[:BATAS_PER_SUMBER * 2]
    )
    return [
        {
            'kelompok': 'Wilayah Administratif',
            'sumber': 'wpp',
            'kode': r['kode'],
            'jenis': 'Wilayah Pengelolaan Perikanan',
            'nama': f"WPP-RI {r['kode']}",
            'keterangan': _gabung(r['perairan'], r['zona_pit'].replace('Zona ', 'Zona PIT ')),
            'bbox': [round(v, 6) for v in r['kotak'].extent],
            'titik': None,
            'peringkat': 0 if angka else 1,
        }
        for r in qs
    ]


def _gabung(*bagian):
    return ', '.join(b for b in bagian if b)


def _cari_sederhana(model, kata, kelompok, label_jenis, sumber, kode=None, bidang_keterangan=None, bidang_nama='nama',
                    saring=None):
    qs = (
        model.objects.filter(**{f'{bidang_nama}__icontains': kata}, **(saring or {}))
        .exclude(geometry=None)
        .annotate(peringkat=_peringkat(bidang_nama, kata), titik_wakil=PointOnSurface('geometry'))
        .select_related('provinsi')
        .defer('geometry', 'provinsi__geometry')
        .order_by('peringkat', bidang_nama)[:BATAS_PER_SUMBER]
    )
    hasil = []
    for o in qs:
        ket = []
        if bidang_keterangan:
            nilai = getattr(o, bidang_keterangan, '')
            if nilai:
                ket.append(str(nilai))
        if getattr(o, 'provinsi_id', None):
            ket.append(o.provinsi.nama)
        hasil.append(
            {
                'kelompok': kelompok,
                'sumber': sumber,
                'kode': kode(o) if kode else None,
                'jenis': label_jenis(o) if callable(label_jenis) else label_jenis,
                'nama': getattr(o, bidang_nama),
                'keterangan': ' · '.join(ket),
                'bbox': None,
                'titik': _titik(o),
                'peringkat': o.peringkat,
            }
        )
    return [h for h in hasil if h['titik']]


def _cari_kkprl(kata):
    qs = (
        KKPRL.objects.filter(
            Q(nama_pemohon__icontains=kata)
            | Q(nomor_izin__icontains=kata)
            | Q(jenis_kegiatan__icontains=kata)
        )
        .exclude(geometry=None)
        .annotate(peringkat=_peringkat('nama_pemohon', kata), titik_wakil=PointOnSurface('geometry'))
        .select_related('provinsi')
        .defer('geometry', 'provinsi__geometry')
        .order_by('peringkat', 'nama_pemohon')[:BATAS_PER_SUMBER]
    )
    hasil = []
    for o in qs:
        ket = [o.jenis_kegiatan or '', o.provinsi.nama if o.provinsi_id else '']
        hasil.append(
            {
                'kelompok': 'Perizinan Ruang Laut',
                'sumber': 'kkprl',
                'kode': None,
                'jenis': o.get_jenis_dokumen_display(),
                'nama': o.nama_pemohon,
                'keterangan': ' · '.join([k for k in ket if k]),
                'bbox': None,
                'titik': _titik(o),
                'peringkat': o.peringkat,
            }
        )
    return [h for h in hasil if h['titik']]


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([ThrottlePencarian])
def cari_lokasi(request):
    kata = (request.query_params.get('q') or '').strip()
    if len(kata) < MIN_KATA_KUNCI:
        return Response({'hasil': [], 'catatan': f'Ketik minimal {MIN_KATA_KUNCI} huruf.'})

    kunci = 'cari:' + hashlib.md5(kata.lower().encode('utf-8'), usedforsecurity=False).hexdigest()
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return Response(tersimpan)

    hasil = []
    hasil += _cari_wpp(kata)
    hasil += _cari_wilayah(Provinsi, kata, 'provinsi', ('kode_bps',), lambda r: 'Provinsi',
                           lambda r: f"Kode BPS {r['kode_bps']}")
    hasil += _cari_wilayah(KabupatenKota, kata, 'kabupaten', ('kode_bps', 'jenis', 'provinsi__nama'),
                           lambda r: 'Kota' if r['jenis'] == 'KOTA' else 'Kabupaten', lambda r: r['provinsi__nama'])
    hasil += _cari_wilayah(Kecamatan, kata, 'kecamatan', ('kode', 'kabupaten__nama', 'kabupaten__jenis', 'provinsi__nama'),
                           lambda r: 'Kecamatan',
                           lambda r: _gabung(nama_kabupaten(r['kabupaten__nama'], r['kabupaten__jenis']), r['provinsi__nama']))
    hasil += _cari_wilayah(
        DesaKelurahan, kata, 'desa',
        ('kode', 'jenis', 'kecamatan__nama', 'kecamatan__kabupaten__nama', 'kecamatan__kabupaten__jenis', 'provinsi__nama'),
        lambda r: r['jenis'],
        lambda r: _gabung(r['kecamatan__nama'] and f"Kec. {r['kecamatan__nama']}",
                          nama_kabupaten(r['kecamatan__kabupaten__nama'], r['kecamatan__kabupaten__jenis']),
                          r['provinsi__nama']),
    )
    hasil += _cari_sederhana(
        InfrastrukturPendukung, kata, 'Infrastruktur & Transportasi',
        lambda o: o.get_kategori_display(), 'infrastruktur', kode=lambda o: o.kategori, bidang_keterangan='kelas',
    )
    hasil += _cari_sederhana(
        PotensiInvestasi, kata, 'Lokasi Potensi Investasi', 'Lokasi Prioritas', 'potensi',
    )
    hasil += _cari_kkprl(kata)
    hasil += _cari_sederhana(
        ZonasiRuangLaut, kata, 'Zona Tata Ruang Laut', lambda o: o.get_sub_zona_display(), 'zonasi',
        kode=lambda o: o.tingkat_acuan, bidang_nama='nama_zona', saring={'ranah': 'LAUT'},
    )
    hasil += _cari_sederhana(
        UnsurRuangLaut, kata, 'Unsur Ruang Laut', lambda o: o.jenis or 'Unsur', 'unsur', kode=lambda o: o.kelompok,
    )

    hasil.sort(key=lambda h: (h['peringkat'], h['nama'].lower()))
    for h in hasil:
        h.pop('peringkat', None)

    muatan = {'hasil': hasil[:BATAS_TOTAL], 'jumlah': len(hasil[:BATAS_TOTAL])}
    cache.set(kunci, muatan, CACHE_DETIK)
    return Response(muatan)
