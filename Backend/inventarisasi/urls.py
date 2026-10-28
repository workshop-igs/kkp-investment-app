from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    InfrastrukturPendukungViewSet,
    IzinTambangViewSet,
    KKPRLViewSet,
    PotensiInvestasiViewSet,
    ProgramKKPViewSet,
    SumberDayaAlamViewSet,
    UnsurRuangLautViewSet,
    ZonasiRuangLautViewSet,
)

router = DefaultRouter()
router.register(r'potensi', PotensiInvestasiViewSet)
router.register(r'zonasi', ZonasiRuangLautViewSet)
router.register(r'kkprl', KKPRLViewSet)
router.register(r'izin-tambang', IzinTambangViewSet)
router.register(r'unsur-ruang', UnsurRuangLautViewSet)
router.register(r'infrastruktur', InfrastrukturPendukungViewSet)
router.register(r'program-kkp', ProgramKKPViewSet)
router.register(r'sumber-daya', SumberDayaAlamViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
