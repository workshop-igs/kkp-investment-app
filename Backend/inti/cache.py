import logging
import time

from django.core.cache.backends.redis import RedisCache

logger = logging.getLogger('inti')

JEDA_PUTUS_DETIK = 30


class RedisTahanGagal(RedisCache):
    _dicatat = False
    _putus_sampai = 0.0

    def _lunak(self, bawaan, fungsi, *args, **kwargs):
        if time.monotonic() < RedisTahanGagal._putus_sampai:
            return bawaan
        try:
            hasil = fungsi(*args, **kwargs)
        except Exception as e:
            RedisTahanGagal._putus_sampai = time.monotonic() + JEDA_PUTUS_DETIK
            if not RedisTahanGagal._dicatat:
                RedisTahanGagal._dicatat = True
                logger.warning(
                    'Simpanan Redis tidak terjangkau (%s: %s). Aplikasi '
                    'berjalan tanpa simpanan — lebih lambat, tetap benar; '
                    'Redis dicoba lagi setiap %s detik. Pesan ini muncul '
                    'sekali per proses.',
                    type(e).__name__,
                    e,
                    JEDA_PUTUS_DETIK,
                )
            return bawaan
        else:
            RedisTahanGagal._putus_sampai = 0.0
            RedisTahanGagal._dicatat = False
            return hasil

    def get(self, key, default=None, version=None):
        return self._lunak(
            default, super().get, key, default=default, version=version
        )

    def get_many(self, keys, version=None):
        return self._lunak({}, super().get_many, keys, version=version)

    def set(self, *args, **kwargs):
        return self._lunak(None, super().set, *args, **kwargs)

    def set_many(self, data, timeout=None, version=None):
        return self._lunak(
            list(data), super().set_many, data, timeout=timeout, version=version
        )

    def add(self, *args, **kwargs):
        return self._lunak(False, super().add, *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self._lunak(False, super().delete, *args, **kwargs)

    def delete_many(self, *args, **kwargs):
        return self._lunak(None, super().delete_many, *args, **kwargs)

    def touch(self, *args, **kwargs):
        return self._lunak(False, super().touch, *args, **kwargs)

    def incr(self, *args, **kwargs):
        try:
            return super().incr(*args, **kwargs)
        except ValueError:
            raise
        except Exception:
            return self._lunak(None, super().incr, *args, **kwargs)

    def clear(self):
        return self._lunak(None, super().clear)
