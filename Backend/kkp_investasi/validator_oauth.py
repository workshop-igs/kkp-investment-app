import logging

from django.contrib.auth import authenticate, get_user_model
from oauth2_provider.oauth2_validators import OAuth2Validator

logger = logging.getLogger('inti')


class EmailOrUsernameOAuth2Validator(OAuth2Validator):
    def validate_user(self, username, password, client, request, *args, **kwargs):
        identifier = (username or '').strip()
        password = password or ''

        if not identifier or not password:
            return False

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
