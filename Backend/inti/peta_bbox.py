import gzip
import hashlib
import json

from django.contrib.gis.db.models import Extent, GeometryField
from django.contrib.gis.db.models.functions import AsGeoJSON, PointOnSurface
from django.contrib.gis.geos import Polygon
from django.core.cache import cache as cache_bawaan
from django.db.models import Count, F, Func
from django.http import HttpResponse, HttpResponseNotModified
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle


class SimplifyPreserveTopology(Func):
    function = 'ST_SimplifyPreserveTopology'
    output_field = GeometryField()


class Simplify(Func):
    function = 'ST_Simplify'
    output_field = GeometryField()


def jawaban_peta(request, kunci, bangun, umur):
    simpanan = cache_bawaan.get(kunci)
    if simpanan is None:
        muatan = bangun()
        if isinstance(muatan, Response):
            return muatan
        badan = json.dumps(muatan, separators=(',', ':')).encode('utf-8')
        sidik = hashlib.md5(badan, usedforsecurity=False).hexdigest()
        simpanan = {
            'badan': badan,
            'gz': gzip.compress(badan, compresslevel=6),
            'etag': f'W/"{sidik}"',
        }
        cache_bawaan.set(kunci, simpanan, umur)

    def berkepala(resp):
        resp['ETag'] = simpanan['etag']
        resp['Cache-Control'] = f'public, max-age={umur}'
        return resp

    if request.headers.get('If-None-Match') == simpanan['etag']:
        return berkepala(HttpResponseNotModified())

    terima = request.headers.get('Accept-Encoding', '')
    if 'gzip' in terima:
        resp = HttpResponse(simpanan['gz'], content_type='application/json')
        resp['Content-Encoding'] = 'gzip'
    else:
        resp = HttpResponse(simpanan['badan'], content_type='application/json')
    resp['Vary'] = 'Accept-Encoding'
    return berkepala(resp)


class PetaBBoxMixin:
    SKALA = [
        (30.0, 0.05, 400),
        (20.0, 0.02, 600),
        (10.0, 0.01, 800),
        (5.0, 0.005, 1000),
        (2.0, 0.001, 1200),
        (0.5, 0.0002, 1500),
    ]
    BATAS_FITUR = 1500

    LEBAR_JAUH = 12.0
    BATAS_JAUH = 300

    SERTAKAN_TITIK = False

    throttle_scope = 'peta'

    BBOX_INDONESIA = (94.5, -11.5, 141.5, 6.5)

    PETA_PEMILIHAN = 'terbesar'

    PETA_KOLOM = ()

    def label_peta(self, bidang, nilai):
        peta = self._peta_label.get(bidang)
        if peta is None:
            peta = dict(self.queryset.model._meta.get_field(bidang).choices or ())
            self._peta_label[bidang] = peta
        return peta.get(nilai, nilai)

    @property
    def _peta_label(self):
        if not hasattr(self, '_simpanan_label'):
            self._simpanan_label = {}
        return self._simpanan_label

    CACHE_PETA_DETIK = 300

    def _kunci_cache(self, request, aksi):
        bagian = sorted(request.query_params.items())
        sidik = hashlib.md5(
            repr(bagian).encode('utf-8'), usedforsecurity=False
        ).hexdigest()
        return f'peta:{type(self).__name__}:{aksi}:{sidik}'

    def peta_urutan(self, qs, request, batas):
        return qs.order_by('-luas_ha', 'id')

    def _skala(self, lebar):
        for ambang, toleransi, batas in self.SKALA:
            if lebar >= ambang:
                return toleransi, batas
        return 0.0, self.BATAS_FITUR

    @action(
        detail=False,
        methods=['get'],
        url_path='peta',
        permission_classes=[AllowAny],
        throttle_classes=[ScopedRateThrottle],
    )
    def peta(self, request):
        return jawaban_peta(
            request,
            self._kunci_cache(request, 'peta'),
            lambda: self._bangun_peta(request),
            self.CACHE_PETA_DETIK,
        )

    def _bangun_peta(self, request):
        qs = self.get_queryset()

        provinsi = request.query_params.get('provinsi')
        if provinsi:
            qs = qs.filter(provinsi_id=provinsi)

        qs = self.peta_queryset_tambahan(qs, request)

        bbox = request.query_params.get('bbox')
        if bbox:
            try:
                minx, miny, maxx, maxy = (float(v) for v in bbox.split(','))
            except (ValueError, TypeError):
                return Response({'detail': 'Parameter bbox harus berupa minx,miny,maxx,maxy.'}, status=400)
        else:
            minx, miny, maxx, maxy = self.BBOX_INDONESIA
        kotak = Polygon.from_bbox((minx, miny, maxx, maxy))
        kotak.srid = 4326
        qs = qs.filter(geometry__intersects=kotak)
        toleransi, batas = self._skala(abs(maxx - minx))
        if self.BATAS_JAUH and abs(maxx - minx) >= self.LEBAR_JAUH:
            batas = min(batas, self.BATAS_JAUH)

        if provinsi:
            batas = self.BATAS_FITUR

        qs = self.peta_urutan(qs, request, batas)

        if self.SERTAKAN_TITIK:
            qs = qs.annotate(titik_wakil=PointOnSurface('geometry'))

        if toleransi > 0:
            fungsi = Simplify if toleransi >= 0.005 else SimplifyPreserveTopology
            ekspresi = fungsi('geometry', toleransi)
        else:
            ekspresi = F('geometry')

        qs = qs.annotate(geojson_teks=AsGeoJSON(ekspresi, precision=6))

        kolom = ['id', 'geojson_teks', *self.PETA_KOLOM]
        if self.SERTAKAN_TITIK:
            kolom.append('titik_wakil')

        fitur = []
        dihabiskan = 0
        sebagai_titik = 0
        for baris in qs.values(*kolom)[:batas]:
            g = baris['geojson_teks']
            titik = baris.get('titik_wakil')
            properti = self.properti_peta(baris)
            if titik is not None:
                properti['titik'] = [round(titik.x, 6), round(titik.y, 6)]

            if g:
                geometri = json.loads(g)
            elif titik is not None:
                sebagai_titik += 1
                geometri = {
                    'type': 'Point',
                    'coordinates': [round(titik.x, 6), round(titik.y, 6)],
                }
            else:
                dihabiskan += 1
                continue

            fitur.append(
                {
                    'type': 'Feature',
                    'id': baris['id'],
                    'geometry': geometri,
                    'properties': properti,
                }
            )

        muatan = {
            'type': 'FeatureCollection',
            'features': fitur,
            'meta': {
                'jumlah': len(fitur),
                'toleransi_penyederhanaan': toleransi,
                'batas_fitur': batas,
                'pemilihan': getattr(self, '_pemilihan', self.PETA_PEMILIHAN),
                'dihabiskan_penyederhanaan': dihabiskan,
                'sebagai_titik': sebagai_titik,
                'dipangkas': (
                    getattr(self, '_dipangkas', False)
                    or len(fitur) >= batas
                    or dihabiskan > 0
                ),
            },
        }
        return muatan

    @action(
        detail=False,
        methods=['get'],
        url_path='wilayah',
        permission_classes=[AllowAny],
        throttle_classes=[ScopedRateThrottle],
    )
    def wilayah(self, request):
        qs = self.peta_queryset_tambahan(self.get_queryset(), request)
        baris = (
            qs.filter(provinsi__isnull=False)
            .values('provinsi_id', 'provinsi__nama')
            .annotate(jumlah=Count('id', distinct=True))
            .order_by('provinsi__nama')
        )
        return Response(
            {
                'wilayah': [
                    {'id': b['provinsi_id'], 'nama': b['provinsi__nama'], 'jumlah': b['jumlah']}
                    for b in baris
                ]
            }
        )

    @action(
        detail=False,
        methods=['get'],
        url_path='cakupan',
        permission_classes=[AllowAny],
        throttle_classes=[ScopedRateThrottle],
    )
    def cakupan(self, request):
        qs = self.peta_queryset_tambahan(self.get_queryset(), request)
        provinsi = request.query_params.get('provinsi')
        if provinsi:
            qs = qs.filter(provinsi_id=provinsi)
        kotak = qs.aggregate(batas=Extent('geometry'))['batas']
        return Response({'cakupan': list(kotak) if kotak else None, 'jumlah': qs.count()})

    def peta_queryset_tambahan(self, qs, request):  # pragma: no cover
        return qs

    def properti_peta(self, obj):  # pragma: no cover
        return {}
