import logging
import threading
from datetime import timedelta

from celery import shared_task
from celery.signals import worker_ready
from django.core.cache import cache
from django.core.management import call_command
from django.db import connection, transaction
from django.utils import timezone

from analitik.models import StatusHitungUlang

logger = logging.getLogger('analitik')

BATAS_TANPA_KABAR = timedelta(minutes=15)


def _macet(s):
    return s.berjalan and (s.diperbarui or s.mulai or timezone.now()) < timezone.now() - BATAS_TANPA_KABAR


def jadwalkan_hitung_ulang(lokasi=None, skor=False):
    with transaction.atomic():
        s, _ = StatusHitungUlang.objects.select_for_update().get_or_create(pk=1)
        if lokasi is not None:
            s.perlu_lokasi = [] if not lokasi or s.perlu_lokasi == [] else sorted({*(s.perlu_lokasi or []), *lokasi})
        s.perlu_skor = s.perlu_skor or skor
        if lokasi is not None or skor:
            s.versi += 1
        if _macet(s):
            s.berjalan = False
        s.save()
        perlu = not s.berjalan and (s.perlu_lokasi is not None or s.perlu_skor)
    if perlu:
        try:
            hitung_ulang.delay()
        except Exception as e:
            logger.error(f'[HITUNG ULANG] Antrean tugas tidak tersedia: {e}')


def _progres(tahap):
    def catat(ke, dari, provinsi):
        StatusHitungUlang.objects.filter(pk=1).update(
            tahap=f'{tahap}: {provinsi}', ke=ke, dari=dari, diperbarui=timezone.now(),
        )
    return catat


def _sisa(versi):
    def catat(sisa):
        if sisa:
            StatusHitungUlang.objects.filter(pk=1, versi=versi).update(perlu_lokasi=sisa)
    return catat


def _detak(berhenti):
    while not berhenti.wait(BATAS_TANPA_KABAR.total_seconds() / 3):
        StatusHitungUlang.objects.filter(pk=1).update(diperbarui=timezone.now())
    connection.close()


@shared_task
def hitung_ulang():
    sekarang = timezone.now()
    if not StatusHitungUlang.objects.filter(pk=1, berjalan=False).update(
        berjalan=True, mulai=sekarang, diperbarui=sekarang, selesai=None, galat='', tahap='Menyiapkan', ke=0, dari=0,
    ):
        return
    berhenti = threading.Event()
    threading.Thread(target=_detak, args=(berhenti,), daemon=True).start()
    try:
        while True:
            s = StatusHitungUlang.objects.get(pk=1)
            versi, lokasi, skor = s.versi, s.perlu_lokasi, s.perlu_skor
            if lokasi is None and not skor:
                break
            if lokasi is not None:
                call_command('hitung_lokasi_potensial', provinsi=','.join(lokasi) or None,
                             progres=_progres('Lokasi potensial'), selesai=_sisa(versi))
                cache.clear()
            if skor:
                call_command('hitung_skor_zona', progres=_progres('Skor kelayakan zona'))
                cache.clear()
            StatusHitungUlang.objects.filter(pk=1, versi=versi).update(perlu_lokasi=None, perlu_skor=False)
    except Exception as e:
        logger.exception('[HITUNG ULANG] gagal')
        connection.close()
        StatusHitungUlang.objects.filter(pk=1).update(galat=f'{type(e).__name__}: {e}'[:2000])
    finally:
        berhenti.set()
        StatusHitungUlang.objects.filter(pk=1).update(
            berjalan=False, selesai=timezone.now(), tahap='', ke=0, dari=0,
        )


@worker_ready.connect
def lanjutkan_hitung_ulang(**_):
    try:
        if StatusHitungUlang.objects.filter(pk=1, berjalan=True).update(berjalan=False, tahap='', ke=0, dari=0):
            logger.warning('[HITUNG ULANG] Proses sebelumnya terputus saat pekerja dimulai ulang; dijadwalkan ulang.')
        jadwalkan_hitung_ulang()
    except Exception:
        logger.exception('[HITUNG ULANG] Gagal memeriksa hitung ulang yang terputus')
    finally:
        connection.close()
