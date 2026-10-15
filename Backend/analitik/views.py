import hashlib
import json
import logging

from django.contrib.gis.geos import GEOSGeometry
from django.core.cache import cache
from django.db import transaction
from django.http import Http404, HttpResponse, JsonResponse
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from inti.geospasial import hitung_luas_geodesik_ha
from inti.peta_bbox import PetaBBoxMixin

from .models import (
    AnalisisKelayakan,
    LokasiPotensial,
    PetaRisiko,
    ZonaRisikoBencana,
)
from .services.ahp import jalankan_analisis_ahp
from .services.finansial import jalankan_analisis_finansial
from .services.laporan_spasial import bagian_bencana, bangun_laporan
from .services.oseanografi import PALET, gambar_peta, keterangan_peta
from .services.pengaturan import atur
from .services.screening_ruang import screening_ruang
from .services.skor_spasial import ambil_skor_spasial


class StatistikBPSView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        kode = (request.query_params.get('provinsi') or '').strip()
        if not kode.isdigit():
            return Response(
                {'detail': 'Parameter provinsi (kode BPS) wajib diisi.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from penarikan_data.bps import statistik_ketenagakerjaan

        kab = (request.query_params.get('kabupaten') or '').strip()
        return Response(statistik_ketenagakerjaan(kode, kode_kabupaten=kab if kab.isdigit() else None))


class LaporanSpasialView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        geometry = request.data.get('geometry')
        if not geometry:
            return Response(
                {'detail': 'Geometry (GeoJSON) wajib disertakan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        kunci = 'laporan:' + hashlib.md5(
            json.dumps(geometry, sort_keys=True).encode('utf-8'), usedforsecurity=False
        ).hexdigest()
        tersimpan = cache.get(kunci)
        if tersimpan is not None:
            return Response(tersimpan)

        with transaction.atomic():
            hasil = bangun_laporan(geometry)

        if hasil.get('galat'):
            return Response({'detail': hasil['galat']}, status=status.HTTP_400_BAD_REQUEST)

        if not hasil['bagian_gagal']:
            cache.set(kunci, hasil, 600)
        return Response(hasil)


class BahayaBencanaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        geometry = request.data.get('geometry')
        if not geometry:
            return Response(
                {'detail': 'Geometry (GeoJSON) wajib disertakan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        kunci = 'bencana:' + hashlib.md5(
            json.dumps(geometry, sort_keys=True).encode('utf-8'), usedforsecurity=False
        ).hexdigest()
        tersimpan = cache.get(kunci)
        if tersimpan is not None:
            return Response(tersimpan)

        try:
            geom = GEOSGeometry(json.dumps(geometry), srid=4326)
        except Exception:
            return Response(
                {'detail': 'Geometry tidak dapat diproses.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hasil = bagian_bencana(geom)
        if not hasil.get('kosong'):
            cache.set(kunci, hasil, 60 * 60 * 24 * 7)
        return Response(hasil)


class AnalisisSerializer(serializers.ModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)
    sektor_nama = serializers.CharField(source='sektor.nama', read_only=True)

    class Meta:
        model = AnalisisKelayakan
        fields = '__all__'


class PetaRisikoSerializer(GeoFeatureModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)

    class Meta:
        model = PetaRisiko
        geo_field = 'geometry'
        fields = '__all__'


class ZonaRisikoBencanaSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = ZonaRisikoBencana
        geo_field = 'geometry'
        fields = ['id', 'jenis', 'varian', 'kelas', 'luas_ha', 'sumber']


class AnalisisKelayakanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AnalisisKelayakan.objects.select_related('provinsi', 'sektor').all()
    filterset_fields = ['provinsi', 'sektor', 'keputusan', 'prioritas']
    ordering_fields = ['skor_ahp_total', 'tanggal_analisis']
    serializer_class = AnalisisSerializer


class ZonaRisikoBencanaViewSet(PetaBBoxMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ZonaRisikoBencana.objects.all()
    serializer_class = ZonaRisikoBencanaSerializer
    filterset_fields = ['jenis', 'varian', 'kelas']

    SKALA = [
        (30.0, 0.01, 300),
        (20.0, 0.006, 400),
        (10.0, 0.003, 600),
        (5.0, 0.0015, 800),
        (2.0, 0.0006, 1000),
        (0.5, 0.0002, 1200),
    ]

    @action(
        detail=False,
        methods=['get'],
        url_path='wilayah',
        permission_classes=[AllowAny],
        throttle_classes=[ScopedRateThrottle],
    )
    def wilayah(self, request):
        return Response(
            {
                'detail': (
                    'Lapisan zona risiko bencana tidak berpenyaring provinsi: satu '
                    'baris adalah petak kisi InaRISK yang dapat melintasi beberapa '
                    'provinsi. Batasi tampilan dengan parameter bbox pada /peta/.'
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.query_params.get('provinsi'):
            raise ParseError(
                'Lapisan zona risiko bencana tidak berpenyaring provinsi. '
                'Batasi tampilan dengan parameter bbox.'
            )

    def peta_queryset_tambahan(self, qs, request):
        qs = qs.filter(varian=(request.query_params.get('varian') or 'RISIKO').upper())
        jenis = (request.query_params.get('jenis') or '').upper()
        return qs.filter(jenis=jenis) if jenis else qs

    PETA_KOLOM = ('jenis', 'varian', 'kelas', 'luas_ha', 'sumber')

    def properti_peta(self, r):
        return {
            'jenis': r['jenis'],
            'jenis_label': self.label_peta('jenis', r['jenis']),
            'varian': r['varian'],
            'varian_label': self.label_peta('varian', r['varian']),
            'kelas': r['kelas'],
            'kelas_label': self.label_peta('kelas', r['kelas']),
            'luas_ha': round(r['luas_ha'] or 0, 1),
            'sumber': r['sumber'],
        }


def _jalankan_screening(geometry, sektor_kode):
    if not geometry:
        return None, Response({'detail': 'Geometry (GeoJSON) wajib disertakan.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return screening_ruang(geometry, sektor_kode), None
    except ValueError as e:
        return None, Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logging.getLogger('analitik').warning(f'[Screening] Gagal: {e}')
        return None, Response(
            {'detail': 'Geometry tidak dapat diproses untuk screening kesesuaian ruang.'},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ScreeningRuangView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        hasil, galat = _jalankan_screening(request.data.get('geometry'), request.data.get('sektor'))
        return galat or Response(hasil)


class RunAnalysisView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        geometry = data.get('geometry')
        sektor_kode = data.get('sektor')
        screening, galat = _jalankan_screening(geometry, sektor_kode)
        if galat:
            return galat
        if not screening['lanjut']:
            return Response(
                {
                    'detail': (
                        f"Lokasi {screening['status_label'].lower()} secara ruang untuk "
                        f"{screening['sektor_nama']}; analisis tidak dilanjutkan ke Tahap 2."
                    ),
                    'screening': screening,
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            area_ha = hitung_luas_geodesik_ha(geometry)
        except Exception as e:
            return Response(
                {'detail': f'Gagal menghitung luas area dari geometry: {e}'}, status=status.HTTP_400_BAD_REQUEST
            )

        required_fields = {
            'capex_idr': 'CapEx / Investasi Awal',
            'annual_revenue_idr': 'Estimasi Pendapatan Tahun Pertama',
            'annual_opex_idr': 'Estimasi OpEx Tahun Pertama',
            'wacc_pct': 'Discount Rate (%)',
            'lifetime_yr': 'Umur Proyek (Tahun)',
        }
        missing = []
        for field, label in required_fields.items():
            val = data.get(field)
            if val is None or str(val).strip() == '':
                missing.append(label)
        if missing:
            return Response(
                {'detail': f'Field berikut wajib diisi untuk analisis finansial yang valid: {", ".join(missing)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        capex_idr = float(data.get('capex_idr'))
        annual_revenue_idr = float(data.get('annual_revenue_idr'))
        annual_opex_idr = float(data.get('annual_opex_idr'))
        wacc_pct = float(data.get('wacc_pct'))
        lifetime_yr = int(data.get('lifetime_yr'))

        if capex_idr <= 0:
            return Response({'detail': 'CapEx harus lebih dari 0.'}, status=status.HTTP_400_BAD_REQUEST)
        if annual_revenue_idr <= 0:
            return Response({'detail': 'Pendapatan per tahun harus lebih dari 0.'}, status=status.HTTP_400_BAD_REQUEST)
        if annual_opex_idr < 0:
            return Response({'detail': 'OpEx per tahun tidak boleh negatif.'}, status=status.HTTP_400_BAD_REQUEST)
        if wacc_pct <= 0 or wacc_pct > 100:
            return Response({'detail': 'Discount rate harus antara 0.01% dan 100%.'}, status=status.HTTP_400_BAD_REQUEST)
        if lifetime_yr < 1 or lifetime_yr > 100:
            return Response({'detail': 'Umur proyek harus antara 1 dan 100 tahun.'}, status=status.HTTP_400_BAD_REQUEST)

        revenue_growth_pct = float(data.get('revenue_growth_pct', 0.0))
        opex_growth_pct = float(data.get('opex_growth_pct', 0.0))

        fin = jalankan_analisis_finansial(
            area_ha=area_ha,
            sektor_kode=sektor_kode,
            capex_idr=capex_idr,
            annual_revenue_idr=annual_revenue_idr,
            annual_opex_idr=annual_opex_idr,
            revenue_growth_pct=revenue_growth_pct,
            opex_growth_pct=opex_growth_pct,
            wacc_pct=wacc_pct,
            lifetime_yr=lifetime_yr,
        )

        eff_investasi = fin['capex_idr'] / 1e9

        spasial = ambil_skor_spasial(geometry, sektor_kode, screening)
        risiko = spasial['risiko']
        lokasi = spasial['lokasi']

        ahp = jalankan_analisis_ahp(
            npv=fin['npv_idr'],
            irr=fin['irr_pct'],
            payback=fin['payback_period_tahun'],
            roi=fin['roi_pct'],
            investasi_miliar=eff_investasi,
            risiko_pasar=risiko['pasar'],
            risiko_operasional=risiko['operasional'],
            risiko_regulasi=risiko['regulasi'],
            risiko_lingkungan=risiko['lingkungan'],
            risiko_sosial=risiko['sosial'],
            kesesuaian_tr=lokasi['kesesuaian_tr'],
            potensi_sda=lokasi['potensi_sda'],
            aksesibilitas=lokasi['aksesibilitas'],
            kondisi_sosek=lokasi['kondisi_sosek'],
            prediksi_keuntungan=fin['npv_idr'] * 1.2,
            sektor_kode=sektor_kode,
            wacc_pct=fin['wacc_pct'],
            umur_proyek=fin['project_lifetime_yr'],
            payback_tercapai=fin.get('payback_tercapai'),
            catatan_spasial=spasial['catatan'],
        )

        from ketenagakerjaan.proyeksi import hitung_proyeksi_tk

        try:
            serapan = data.get('tenaga_kerja_estimasi')
            serapan = float(serapan) if serapan not in (None, '') else None
            if serapan is not None and serapan <= 0:
                serapan = None
        except (TypeError, ValueError):
            serapan = None

        tk = hitung_proyeksi_tk(sektor_kode, serapan_dimasukkan=serapan)

        tk['demografi'] = None
        tk['catatan_demografi'] = (
            'Profil demografi diambil dari BPS lewat endpoint terpisah agar '
            'analisis tidak tertahan menunggu jawaban BPS.'
        )

        return Response(
            {
                'success': True,
                'area_ha': area_ha,
                'sektor': sektor_kode,
                'investasi_miliar': eff_investasi,
                'kelayakan': ahp,
                'finansial': fin,
                'ketenagakerjaan': tk,
                'spasial': spasial,
                'screening': screening,
            }
        )


class PetaRisikoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PetaRisiko.objects.select_related('provinsi').all()
    filterset_fields = ['provinsi', 'kelas_risiko']
    serializer_class = PetaRisikoSerializer


class LokasiPotensialViewSet(PetaBBoxMixin, viewsets.GenericViewSet):
    BATAS_FITUR = 2000

    SERTAKAN_TITIK = True
    permission_classes = [AllowAny]

    SKALA = [
        (30.0, 0.0005, 1200),
        (10.0, 0.0002, 1500),
        (2.0, 0.0001, 1800),
    ]

    queryset = LokasiPotensial.objects.select_related('provinsi', 'sektor').all()

    def retrieve(self, request, pk=None):
        return Response({'geometry': json.loads(self.get_object().geometry.geojson)})

    def peta_urutan(self, qs, request, batas):
        return qs.order_by('-persen_sesuai', '-luas_ha', 'id')

    def peta_queryset_tambahan(self, qs, request):
        kode = (request.query_params.get('sektor') or 'SEMUA').strip().upper()
        return qs.filter(sektor__isnull=True) if kode == 'SEMUA' else qs.filter(sektor__kode=kode)

    PETA_KOLOM = ('provinsi__nama', 'persen_sesuai', 'jenis', 'rincian', 'luas_ha')

    def properti_peta(self, r):
        return {
            **r['rincian'],
            'provinsi': r['provinsi__nama'],
            'sektor_kode': r['jenis'][0],
            'jenis': r['jenis'],
            'kelas': 'TINGGI',
            'persen_sesuai': round(r['persen_sesuai']),
            'luas_ha': round(r['luas_ha'], 1),
            'karakter': atur('KARAKTER_LOKASI').get(r['jenis'][0], {}).get('uraian') if len(r['jenis']) == 1 else None,
        }


def oseanografi_keterangan(request):
    return JsonResponse(keterangan_peta())


def oseanografi_peta(request, kode):
    isi = gambar_peta(kode) if kode in PALET else None
    if isi is None:
        raise Http404('Lapisan oseanografi tidak tersedia.')
    resp = HttpResponse(isi, content_type='image/png')
    resp['Cache-Control'] = 'public, max-age=3600'
    return resp
