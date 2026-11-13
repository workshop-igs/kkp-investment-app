from oauth2_provider.contrib.rest_framework import OAuth2Authentication
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import PermissionDenied

BOLEH_SAAT_WAJIB_GANTI = (
    '/api/v1/inti/auth/me/',
    '/api/v1/inti/auth/ganti-sandi/',
    '/api/v1/inti/auth/logout/',
    '/api/v1/inti/auth/denyut/',
)


def _tolak_bila_wajib_ganti(request, hasil):
    if hasil and request.path not in BOLEH_SAAT_WAJIB_GANTI:
        profil = getattr(hasil[0], 'profil', None)
        if profil is not None and profil.wajib_ganti_sandi:
            raise PermissionDenied('Buat kata sandi baru terlebih dahulu.')
    return hasil


class AutentikasiOAuth2(OAuth2Authentication):
    def authenticate(self, request):
        return _tolak_bila_wajib_ganti(request, super().authenticate(request))


class AutentikasiSesi(SessionAuthentication):
    def authenticate(self, request):
        return _tolak_bila_wajib_ganti(request, super().authenticate(request))
