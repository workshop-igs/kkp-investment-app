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
)

from .models import Provinsi

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
    if t is None:
        return None
    return [round(t.x, 6), round(t.y, 6)]


def _peringkat(bidang, kata):
    return Case(
        When(**{f'{bidang}__iexact': kata}, then=0),
        When(**{f'{bidang}__istartswith': kata}, then=1),
        default=2,
        output_field=IntegerField(),
    )


def _cari_provinsi(kata):
    qs = (
        Provinsi.objects.filter(nama__icontains=kata)
        .exclude(geometry=None)
        .annotate(peringkat=_peringkat('nama', kata), kotak=Envelope('geometry'))
        .defer('geometry')
        .order_by('peringkat', 'nama')[:BATAS_PER_SUMBER]
    )
    hasil = []
    for p in qs:
        cakupan = list(p.kotak.extent) if p.kotak else None
        hasil.append(
            {
                'kelompok': 'Wilayah Administratif',
                'jenis': 'Provinsi',
                'nama': p.nama,
                'keterangan': f'Kode BPS {p.kode_bps}',
                'bbox': [round(v, 6) for v in cakupan] if cakupan else None,
                'titik': None,
                'peringkat': p.peringkat,
            }
        )
    return hasil


def _cari_sederhana(model, kata, kelompok, label_jenis, bidang_keterangan=None, tambahan=None):
    saring = Q(nama__icontains=kata)
    if tambahan:
        saring |= tambahan
    qs = (
        model.objects.filter(saring)
        .exclude(geometry=None)
        .annotate(peringkat=_peringkat('nama', kata), titik_wakil=PointOnSurface('geometry'))
        .select_related('provinsi')
        .defer('geometry', 'provinsi__geometry')
        .order_by('peringkat', 'nama')[:BATAS_PER_SUMBER]
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
                'jenis': label_jenis(o) if callable(label_jenis) else label_jenis,
                'nama': o.nama,
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
    hasil += _cari_provinsi(kata)
    hasil += _cari_sederhana(
        InfrastrukturPendukung, kata, 'Infrastruktur & Transportasi',
        lambda o: o.get_kategori_display(), bidang_keterangan='kelas',
    )
    hasil += _cari_sederhana(
        PotensiInvestasi, kata, 'Lokasi Potensi Investasi', 'Lokasi Prioritas',
    )
    hasil += _cari_kkprl(kata)
    hasil += _cari_sederhana(
        UnsurRuangLaut, kata, 'Unsur Ruang Laut', lambda o: o.jenis or 'Unsur',
    )

    hasil.sort(key=lambda h: (h['peringkat'], h['nama'].lower()))
    for h in hasil:
        h.pop('peringkat', None)

    muatan = {'hasil': hasil[:BATAS_TOTAL], 'jumlah': len(hasil[:BATAS_TOTAL])}
    cache.set(kunci, muatan, CACHE_DETIK)
    return Response(muatan)
