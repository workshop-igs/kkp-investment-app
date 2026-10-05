import logging

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .proyeksi import hitung_proyeksi_tk
from .serializers import HitungTenagaKerjaSerializer

logger = logging.getLogger('ketenagakerjaan')


class HitungTenagaKerjaAPIView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def post(self, request):
        serializer = HitungTenagaKerjaSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'detail': 'Validasi input gagal.', 'errors': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated = serializer.validated_data

        try:
            from inti.models import SektorInvestasi

            kode = SektorInvestasi.objects.values_list('kode', flat=True).get(
                pk=validated['sector_id']
            )
        except Exception:
            return Response(
                {'detail': f"Sektor id={validated['sector_id']} tidak ditemukan."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            hasil = hitung_proyeksi_tk(
                sektor_kode=kode,
                serapan_dimasukkan=validated.get('total_tenaga_kerja'),
            )
            return Response(hasil, status=status.HTTP_200_OK)
        except ValueError as e:
            logger.warning(f'[HitungTK] Validasi gagal: {e}')
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception(f'[HitungTK] Galat tidak terduga: {e}')
            return Response(
                {'detail': 'Terjadi kesalahan internal saat menghitung proyeksi.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
