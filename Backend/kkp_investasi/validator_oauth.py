import logging

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.cache import cache
from oauth2_provider.oauth2_validators import OAuth2Validator
from oauthlib.oauth2.rfc6749 import errors

logger = logging.getLogger('inti')

GAGAL_MAKS_AKUN = 10
GAGAL_MAKS_ALAMAT = 30
JEDA_GAGAL_DETIK = 900


class TerlaluBanyakPercobaan(errors.OAuth2Error):
    error = 'terlalu_banyak_percobaan'
    status_code = 429


def alamat_klien(headers):
    xff = headers.get('HTTP_X_FORWARDED_FOR')
    jumlah_proksi = settings.REST_FRAMEWORK.get('NUM_PROXIES')
    if xff and jumlah_proksi:
        alamat = xff.split(',')
        return alamat[-min(jumlah_proksi, len(alamat))].strip()
    return headers.get('REMOTE_ADDR', '')


class EmailOrUsernameOAuth2Validator(OAuth2Validator):
    def validate_user(self, username, password, client, request, *args, **kwargs):
        identifier = (username or '').strip()
        password = password or ''

        if not identifier or not password:
            return False

        kunci_akun = f'gagal-masuk:akun:{identifier.lower()}'
        kunci_alamat = f'gagal-masuk:alamat:{alamat_klien(request.headers)}'
        if cache.get(kunci_akun, 0) >= GAGAL_MAKS_AKUN or cache.get(kunci_alamat, 0) >= GAGAL_MAKS_ALAMAT:
            logger.info('[OAuth2] Masuk ditahan karena terlalu banyak percobaan gagal: %s', identifier)
            raise TerlaluBanyakPercobaan(
                description='Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam 15 menit.', request=request
            )
        if not self._periksa_kredensial(identifier, password, request):
            for kunci in (kunci_akun, kunci_alamat):
                cache.set(kunci, cache.get(kunci, 0) + 1, JEDA_GAGAL_DETIK)
            return False
        cache.delete(kunci_akun)
        return True

    def _periksa_kredensial(self, identifier, password, request):
        User = get_user_model()
        nama_pengguna = identifier

        if '@' in identifier:
            pengguna = User.objects.filter(email__iexact=identifier).first()
            if pengguna is None:
                logger.info('[OAuth2] Email tidak terdaftar: %s', identifier)
                return False
            nama_pengguna = pengguna.get_username()

        user = authenticate(username=nama_pengguna, password=password)

        if user is None:
            logger.info('[OAuth2] Kredensial tidak valid untuk: %s', identifier)
            return False

        if not user.is_active:
            logger.info('[OAuth2] Akun dinonaktifkan: %s', nama_pengguna)
            return False

        request.user = user
        return True
