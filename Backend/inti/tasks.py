from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import LogAktivitas


@shared_task
def hapus_log_kedaluwarsa():
    batas = timezone.now() - timedelta(days=settings.LOG_AKTIVITAS_SIMPAN_HARI)
    return LogAktivitas.objects.filter(waktu__lt=batas).delete()[0]
