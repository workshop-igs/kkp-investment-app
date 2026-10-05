from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import SinkronisasiDJPRL


@api_view(['GET'])
@permission_classes([AllowAny])
def status_integrasi(request):
    sinkron = SinkronisasiDJPRL.objects.all()
    data = [
        {
            'nama_dataset': s.nama_dataset,
            'direction': s.get_direction_display(),
            'status': s.get_status_display(),
            'last_sync': s.last_sync,
        }
        for s in sinkron
    ]
    return Response(
        {
            'djprl_integration': data
            if data
            else [
                {
                    'status': 'MOCK',
                    'message': 'Integrasi DJPRL dalam mode kerangka kerja — implementasi saat API tersedia',
                }
            ]
        }
    )
