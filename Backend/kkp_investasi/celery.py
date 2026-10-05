import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kkp_investasi.settings')

app = Celery('kkp_investasi')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks()

app.conf.beat_schedule = {
    'periksa-statistik-bps-bulanan': {
        'task': 'penarikan_data.tasks.periksa_statistik_bps',
        'schedule': crontab(minute=0, hour=3, day_of_month=1),
    },
}
