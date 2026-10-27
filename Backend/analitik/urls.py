from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnalisisKelayakanViewSet,
    BahayaBencanaView,
    LaporanSpasialView,
    LokasiPotensialViewSet,
    ParameterTambahanPetaViewSet,
    PetaRisikoViewSet,
    RunAnalysisView,
    ScreeningRuangView,
    StatistikBPSView,
    ZonaRisikoBencanaViewSet,
    oseanografi_keterangan,
    oseanografi_peta,
)

router = DefaultRouter()
router.register(r'kelayakan', AnalisisKelayakanViewSet)
router.register(r'peta-risiko', PetaRisikoViewSet)
router.register(r'zona-risiko', ZonaRisikoBencanaViewSet)
router.register(r'lokasi-potensial', LokasiPotensialViewSet, basename='lokasi-potensial')
router.register(r'parameter-tambahan', ParameterTambahanPetaViewSet, basename='parameter-tambahan')

urlpatterns = [
    path('screening/', ScreeningRuangView.as_view(), name='screening-ruang'),
    path('analisis/', RunAnalysisView.as_view(), name='run-analysis'),
    path('laporan-spasial/', LaporanSpasialView.as_view(), name='laporan-spasial'),
    path('statistik-bps/', StatistikBPSView.as_view(), name='statistik-bps'),
    path('bahaya-bencana/', BahayaBencanaView.as_view(), name='bahaya-bencana'),
    path('oseanografi/', oseanografi_keterangan, name='oseanografi'),
    path('oseanografi/<str:kode>.png', oseanografi_peta, name='oseanografi-peta'),
    path('', include(router.urls)),
]
