from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnalisisKelayakanViewSet,
    BahayaBencanaView,
    LaporanSpasialView,
    PetaRisikoViewSet,
    RunAnalysisView,
    ScreeningRuangView,
    SkorZonaViewSet,
    StatistikBPSView,
    ZonaRisikoBencanaViewSet,
    oseanografi_keterangan,
    oseanografi_peta,
)

router = DefaultRouter()
router.register(r'kelayakan', AnalisisKelayakanViewSet)
router.register(r'peta-risiko', PetaRisikoViewSet)
router.register(r'zona-risiko', ZonaRisikoBencanaViewSet)
router.register(r'skor-zona', SkorZonaViewSet, basename='skor-zona')

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
