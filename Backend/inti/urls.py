from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views_admin import (
    AdminDataSourceViewSet,
    AdminLogAktivitasViewSet,
    AdminParameterTambahanViewSet,
    AdminPengaturanAnalisisViewSet,
    AdminProyekViewSet,
    AdminSektorViewSet,
    AdminUserViewSet,
    status_sistem,
)
from .asisten import daftar_alat, obrolan, pakai_alat
from .pencarian import cari_lokasi
from .views import (
    KabupatenKotaViewSet,
    ProvinsiViewSet,
    SektorInvestasiViewSet,
    SumberDataViewSet,
    aktivitas_saya_api,
    auth_config,
    dashboard_stats,
    denyut_api,
    ganti_sandi_api,
    login_api,
    logout_api,
    me_api,
    register_api,
    ringkasan_publik,
)

router = DefaultRouter()
router.register(r'provinsi', ProvinsiViewSet)
router.register(r'kabupaten-kota', KabupatenKotaViewSet)
router.register(r'sektor', SektorInvestasiViewSet)
router.register(r'data-sources', SumberDataViewSet)

admin_router = DefaultRouter()
admin_router.register(r'users', AdminUserViewSet, basename='admin-users')
admin_router.register(r'proyek', AdminProyekViewSet, basename='admin-proyek')
admin_router.register(r'sektor', AdminSektorViewSet, basename='admin-sektor')
admin_router.register(r'data-sources', AdminDataSourceViewSet, basename='admin-datasources')
admin_router.register(r'log-aktivitas', AdminLogAktivitasViewSet, basename='admin-log-aktivitas')
admin_router.register(r'pengaturan-analisis', AdminPengaturanAnalisisViewSet, basename='admin-pengaturan-analisis')
admin_router.register(r'parameter-tambahan', AdminParameterTambahanViewSet, basename='admin-parameter-tambahan')

urlpatterns = [
    path('cari/', cari_lokasi, name='cari-lokasi'),
    path('asisten/alat/', daftar_alat, name='asisten-alat'),
    path('asisten/alat/<str:nama>/', pakai_alat, name='asisten-pakai-alat'),
    path('asisten/obrolan/', obrolan, name='asisten-obrolan'),
    path('dashboard/', dashboard_stats, name='dashboard-stats'),
    path('ringkasan-publik/', ringkasan_publik, name='ringkasan-publik'),
    path('auth/login/', login_api, name='auth-login'),
    path('auth/register/', register_api, name='auth-register'),
    path('auth/me/', me_api, name='auth-me'),
    path('auth/ganti-sandi/', ganti_sandi_api, name='auth-ganti-sandi'),
    path('auth/aktivitas/', aktivitas_saya_api, name='auth-aktivitas'),
    path('auth/config/', auth_config, name='auth-config'),
    path('auth/logout/', logout_api, name='auth-logout'),
    path('auth/denyut/', denyut_api, name='auth-denyut'),
    path('admin/status-sistem/', status_sistem, name='admin-status-sistem'),
    path('admin/', include(admin_router.urls)),
    path('', include(router.urls)),
]
