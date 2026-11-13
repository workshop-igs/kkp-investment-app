import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kkp_investasi.settings')

app = Celery('kkp_investasi')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks()

app.conf.beat_schedule = {
    'perbarui-sumber-data': {
        'task': 'penarikan_data.tasks.perbarui_sumber_data',
        'schedule': crontab(minute=0, hour=1, day_of_week='sun'),
    },
    'isi-cache-profil': {
        'task': 'analitik.tasks.isi_cache_profil',
        'schedule': crontab(minute=0, hour=4),
    },
    'hapus-log-kedaluwarsa': {
        'task': 'inti.tasks.hapus_log_kedaluwarsa',
        'schedule': crontab(minute=30, hour=3),
    },
}
