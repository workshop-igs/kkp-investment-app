from django.db.models import Count, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from inti.geospasial import kabupaten_dari_geometri, provinsi_dari_geometri

from .models import ProyekInvestasi, RekapRealisasi
from .serializers import (
    ProyekInvestasiListSerializer,
    ProyekInvestasiSerializer,
    RekapRealisasiSerializer,
)


class ProyekInvestasiViewSet(viewsets.ModelViewSet):
    queryset = ProyekInvestasi.objects.select_related('provinsi', 'sektor').all()
    serializer_class = ProyekInvestasiSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'sektor', 'provinsi']
    search_fields = ['nama', 'investor', 'kode_proyek', 'lokasi_detail']
    ordering_fields = ['created_at', 'nilai_investasi_miliar', 'status']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProyekInvestasiListSerializer
        return ProyekInvestasiSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == 'list':
            return qs.defer(
                'geometry', 'provinsi__geometry', 'provinsi__geometry_tampilan'
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user if self.request.user.is_authenticated else None)

    def perform_update(self, serializer):
        instance = serializer.instance
        catatan_request = self.request.data.get('catatan', '').strip() if isinstance(self.request.data, dict) else ''
        if catatan_request:
            instance._history_catatan = catatan_request
        if self.request.user and self.request.user.is_authenticated:
            instance._history_user = self.request.user
        serializer.save()

    def create(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else request.data

        if 'nama_proyek' in data:
            data['nama'] = data.pop('nama_proyek')
        if 'lokasi' in data:
            data['lokasi_detail'] = data.pop('lokasi')
        if 'area_ha' in data:
            data['luas_ha'] = data.pop('area_ha')

        analisis = data.get('analisis_json')
        if isinstance(analisis, dict):
            if not data.get('skor_kelayakan'):
                data['skor_kelayakan'] = analisis.get('ahp_score') or analisis.get('kelayakan', {}).get('skor_ahp_total') or 0
            if not data.get('proyeksi_tenaga_kerja'):
                data['proyeksi_tenaga_kerja'] = (
                    analisis.get('ketenagakerjaan', {}).get('total_tenaga_kerja')
                    or analisis.get('ketenagakerjaan', {}).get('total_lapangan_kerja')
                    or 0
                )
            if not data.get('luas_ha'):
                data['luas_ha'] = analisis.get('area_hectares') or analisis.get('area_ha') or 0
            if not data.get('nilai_investasi_miliar') and analisis.get('finansial', {}).get('capex_idr'):
                data['nilai_investasi_miliar'] = float(analisis['finansial']['capex_idr']) / 1e9
            if not data.get('geometry') and analisis.get('geometry'):
                data['geometry'] = analisis['geometry']

        geom_obj = None
        geom_input = data.get('geometry') or data.get('geometry_geojson')
        if geom_input:
            try:
                geom_obj = self._urai_geometri(geom_input)
            except ValueError as e:
                return Response(
                    {
                        'geometry': [str(e)],
                        'detail': (
                            'Area proyek tidak dapat dibaca sehingga proyek tidak '
                            'disimpan. Perbaiki geometrinya lalu coba lagi.'
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            data['geometry'] = geom_obj

        sektor_val = data.get('sektor')
        if isinstance(sektor_val, str) and not sektor_val.isdigit():
            from inti.models import SektorInvestasi

            sektor_obj = (
                SektorInvestasi.objects.filter(kode__iexact=sektor_val).first()
                or SektorInvestasi.objects.filter(
                    nama__iexact=sektor_val.replace('_', ' ')
                ).first()
                or SektorInvestasi.objects.filter(
                    nama__icontains=sektor_val.replace('_', ' ')
                ).first()
            )
            if not sektor_obj:
                tersedia = list(SektorInvestasi.objects.values_list('kode', flat=True))
                return Response(
                    {
                        'sektor': [f'Sektor "{sektor_val}" tidak dikenali.'],
                        'sektor_tersedia': tersedia,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            data['sektor'] = sektor_obj.id

        catatan_wilayah = ''
        if not data.get('provinsi'):
            if geom_obj is None:
                return Response(
                    {
                        'provinsi': [
                            'Provinsi wajib diisi bila proyek tidak menyertakan '
                            'geometri area, karena tidak ada dasar untuk '
                            'menentukannya sendiri.'
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            wilayah = provinsi_dari_geometri(geom_obj)
            catatan_wilayah = wilayah['catatan']
            if wilayah['provinsi'] is not None:
                data['provinsi'] = wilayah['provinsi'].id
                kabkota = kabupaten_dari_geometri(geom_obj, wilayah['provinsi'])
                if kabkota is not None and not data.get('kabupaten_kota'):
                    data['kabupaten_kota'] = kabkota.id

        if not data.get('status'):
            data['status'] = 'LOI'

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        muatan = dict(serializer.data)
        if catatan_wilayah:
            muatan['catatan_wilayah'] = catatan_wilayah

        headers = self.get_success_headers(serializer.data)
        return Response(muatan, status=status.HTTP_201_CREATED, headers=headers)

    @staticmethod
    def _urai_geometri(masukan):
        import json

        from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
        from django.contrib.gis.geos.error import GEOSException

        try:
            if isinstance(masukan, str):
                geom = GEOSGeometry(masukan)
            elif isinstance(masukan, dict):
                if masukan.get('type') == 'Feature' and 'geometry' in masukan:
                    masukan = masukan['geometry']
                geom = GEOSGeometry(json.dumps(masukan))
            else:
                geom = masukan
        except (GEOSException, ValueError, TypeError) as e:
            raise ValueError(f'Geometri tidak dapat diurai: {e}') from e

        if geom is None:
            raise ValueError('Geometri kosong.')
        if geom.geom_type == 'Polygon':
            geom = MultiPolygon(geom)
        if geom.geom_type != 'MultiPolygon':
            raise ValueError(
                f'Area proyek harus berupa Polygon atau MultiPolygon, '
                f'bukan {geom.geom_type}.'
            )
        if not geom.valid:
            raise ValueError(f'Geometri tidak sah: {geom.valid_reason}.')
        if geom.srid is None:
            geom.srid = 4326
        return geom

    @action(detail=True, methods=['post', 'patch'], url_path='update-status')
    def update_status(self, request, pk=None):
        proyek = self.get_object()
        new_status = request.data.get('status_baru') or request.data.get('status')
        catatan = (request.data.get('catatan') or '').strip()

        valid_statuses = [c[0] for c in ProyekInvestasi.STATUS_CHOICES]
        if new_status not in valid_statuses:
            return Response(
                {'detail': f'Status tidak valid. Pilihan: {valid_statuses}'}, status=status.HTTP_400_BAD_REQUEST
            )

        if catatan:
            proyek._history_catatan = catatan
        if request.user and request.user.is_authenticated:
            proyek._history_user = request.user

        proyek.status = new_status
        proyek.save()

        return Response(
            ProyekInvestasiSerializer(proyek).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'], url_path='rekap')
    def rekap(self, request):
        per_sektor = list(
            ProyekInvestasi.objects.values('sektor__nama', 'sektor__warna')
            .annotate(
                count=Count('id'),
                total_rencana=Sum('nilai_investasi_miliar'),
                total_realisasi=Sum('nilai_realisasi_miliar'),
                total_tk=Sum('proyeksi_tenaga_kerja'),
            )
            .order_by('-total_rencana')
        )

        per_provinsi = list(
            ProyekInvestasi.objects.values('provinsi__nama')
            .annotate(
                count=Count('id'),
                total_rencana=Sum('nilai_investasi_miliar'),
                total_realisasi=Sum('nilai_realisasi_miliar'),
            )
            .order_by('-total_rencana')
        )

        per_status = list(ProyekInvestasi.objects.values('status').annotate(count=Count('id')).order_by('status'))

        return Response(
            {
                'per_sektor': per_sektor,
                'per_provinsi': per_provinsi,
                'per_status': per_status,
            }
        )


class RekapRealisasiViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RekapRealisasi.objects.select_related('provinsi', 'sektor').all()
    serializer_class = RekapRealisasiSerializer
    filterset_fields = ['provinsi', 'sektor', 'tahun']
