from django.urls import path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .proyeksi import hitung_proyeksi_tk
from .views import HitungTenagaKerjaAPIView


@api_view(['POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def proyeksi_tk_view(request):
    sektor_kode = request.data.get('sektor', 'DEFAULT')
    serapan = request.data.get('total_tenaga_kerja')
    return Response(
        hitung_proyeksi_tk(sektor_kode, serapan_dimasukkan=float(serapan) if serapan else None)
    )


urlpatterns = [
    path('proyeksi/', proyeksi_tk_view, name='proyeksi-tk'),
    path('hitung-tenaga-kerja/', HitungTenagaKerjaAPIView.as_view(), name='hitung-tenaga-kerja'),
]
