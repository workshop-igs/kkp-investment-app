from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .asisten import daftar_alat, obrolan, pakai_alat
from .pencarian import cari_kbli, cari_lokasi
from .views import (
    DesaKelurahanViewSet,
    KabupatenKotaViewSet,
    KecamatanViewSet,
    ProvinsiViewSet,
    SektorInvestasiViewSet,
    SumberDataViewSet,
    aktivitas_saya_api,
    auth_config,
    dashboard_stats,
    denyut_api,
    ganti_sandi_api,
    logout_api,
    me_api,
    register_api,
    ringkasan_publik,
    wpp_peta,
)
from .views_admin import (
    AdminLogAktivitasViewSet,
    AdminParameterTambahanViewSet,
    AdminPembaruanDataViewSet,
    AdminPengaturanAnalisisViewSet,
    AdminProyekViewSet,
    AdminSektorViewSet,
    AdminUserViewSet,
    status_sistem,
)

router = DefaultRouter()
router.register(r'provinsi', ProvinsiViewSet)
router.register(r'kabupaten-kota', KabupatenKotaViewSet)
router.register(r'kecamatan', KecamatanViewSet)
router.register(r'desa-kelurahan', DesaKelurahanViewSet)
router.register(r'sektor', SektorInvestasiViewSet)
router.register(r'data-sources', SumberDataViewSet)

admin_router = DefaultRouter()
admin_router.register(r'users', AdminUserViewSet, basename='admin-users')
admin_router.register(r'proyek', AdminProyekViewSet, basename='admin-proyek')
admin_router.register(r'sektor', AdminSektorViewSet, basename='admin-sektor')
admin_router.register(r'log-aktivitas', AdminLogAktivitasViewSet, basename='admin-log-aktivitas')
admin_router.register(r'pengaturan-analisis', AdminPengaturanAnalisisViewSet, basename='admin-pengaturan-analisis')
admin_router.register(r'parameter-tambahan', AdminParameterTambahanViewSet, basename='admin-parameter-tambahan')
admin_router.register(r'pembaruan-data', AdminPembaruanDataViewSet, basename='admin-pembaruan-data')

urlpatterns = [
    path('cari/', cari_lokasi, name='cari-lokasi'),
    path('kbli/', cari_kbli, name='cari-kbli'),
    path('wpp/', wpp_peta, name='wpp-peta'),
    path('asisten/alat/', daftar_alat, name='asisten-alat'),
    path('asisten/alat/<str:nama>/', pakai_alat, name='asisten-pakai-alat'),
    path('asisten/obrolan/', obrolan, name='asisten-obrolan'),
    path('dashboard/', dashboard_stats, name='dashboard-stats'),
    path('ringkasan-publik/', ringkasan_publik, name='ringkasan-publik'),
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
