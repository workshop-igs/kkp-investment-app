from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProyekInvestasiViewSet, RekapRealisasiViewSet

router = DefaultRouter()
router.register(r'proyek', ProyekInvestasiViewSet)
router.register(r'rekap-realisasi', RekapRealisasiViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
