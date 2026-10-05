from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnalisisKelayakanViewSet,
    BahayaBencanaView,
    LaporanSpasialView,
    SebaranTenagaKerjaView,
    PetaRisikoViewSet,
    RunAnalysisView,
    ScreeningRuangView,
    SkorZonaViewSet,
    StatistikBPSView,
    ZonaRisikoBencanaViewSet,
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
    path('sebaran-tenaga-kerja/', SebaranTenagaKerjaView.as_view(), name='sebaran-tenaga-kerja'),
    path('statistik-bps/', StatistikBPSView.as_view(), name='statistik-bps'),
    path('bahaya-bencana/', BahayaBencanaView.as_view(), name='bahaya-bencana'),
    path('', include(router.urls)),
]
