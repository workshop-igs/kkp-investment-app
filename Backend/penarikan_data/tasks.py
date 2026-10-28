import json
import logging
import time
from datetime import timedelta

from celery import shared_task
from django.core.cache import cache
from django.core.management import call_command
from django.utils import timezone

logger = logging.getLogger('penarikan_data')

SELANG_JAM = 24 * 90

JADWAL = [
    ('KKP-KKPRL', 'kkprl', 'Izin KKPRL, Portal Satu Data KKP', 'tarik_kkprl_wfs', True),
    ('ESDM-IUP', 'izin_tambang', 'Izin usaha pertambangan 5 tahun terakhir, Geoportal ESDM', 'tarik_iup_esdm', False),
    ('KKP-INFRA', 'infrastruktur', 'Infrastruktur, Portal Satu Data KKP', 'tarik_infrastruktur_wfs', True),
    ('OSM-INFRA', 'infrastruktur', 'Bandara, gardu induk, kampus, dan listrik 20 kV, OpenStreetMap', 'tarik_infrastruktur_osm', True),
    ('OSEANOGRAFI', 'oseanografi', 'Oseanografi 12 bulan terakhir, NOAA dan NASA', 'tarik_oseanografi', True),
    ('GFW', 'aktivitas_tangkap', 'Aktivitas penangkapan ikan 12 bulan terakhir, Global Fishing Watch',
     'tarik_aktivitas_tangkap', False),
    ('BPS-PRODUKSI', 'bps_produksi', 'Produksi dan nilai produksi perikanan, BPS', 'tarik_produksi_perikanan', False),
    ('BPS', 'bps_kerja', 'Ketenagakerjaan, BPS', 'tarik_statistik_bps', False),
    ('KKP-RTRW', 'tata_ruang', 'RTRW Provinsi beserta matriks KKPRL, folder data KKP', 'perbarui_rtrw', True),
]


def jatuh_tempo(cfg):
    if not cfg.last_successful_fetch:
        return None
    return cfg.last_successful_fetch + timedelta(hours=cfg.fetch_interval_hours or SELANG_JAM)


def konfigurasi(kode, nama):
    from penarikan_data.models import KonfigurasiAPI

    return KonfigurasiAPI.objects.get_or_create(
        kode=kode, defaults={'nama': nama[:100], 'status': 'ACTIVE', 'fetch_interval_hours': SELANG_JAM},
    )[0]


@shared_task
def perbarui_sumber_data(paksa=False):
    from analitik.tasks import jadwalkan_hitung_ulang
    from penarikan_data.models import LogPenarikan

    diperbarui, berubah, hitung_ulang = [], False, False
    for kode, _, nama, perintah, memicu in JADWAL:
        cfg = konfigurasi(kode, nama)
        tempo = jatuh_tempo(cfg)
        if not paksa and tempo and timezone.now() < tempo:
            continue
        mulai = time.time()
        try:
            hasil = call_command(perintah)
            galat = ''
        except Exception as e:
            hasil, galat = None, f'{type(e).__name__}: {e}'
            logger.warning(f'[PEMBARUAN DATA] {perintah} gagal: {galat}')
        ringkasan = json.loads(hasil) if isinstance(hasil, str) and hasil.startswith('{') else {}
        if galat:
            cfg.retry_count = (cfg.retry_count or 0) + 1
            cfg.save(update_fields=['retry_count', 'updated_at'])
        else:
            cfg.last_successful_fetch = timezone.now()
            cfg.retry_count = 0
            cfg.save(update_fields=['last_successful_fetch', 'retry_count', 'updated_at'])
            diperbarui.append(kode)
            if ringkasan.get('dimuat', True):
                berubah = True
                hitung_ulang = hitung_ulang or memicu
        LogPenarikan.objects.create(
            api_config=cfg, endpoint=perintah, completed_at=timezone.now(),
            result='FAILED' if galat else 'SUCCESS', response_time_ms=int((time.time() - mulai) * 1000),
            error_message=galat[:2000], request_params={'paksa': paksa}, response_summary=ringkasan,
        )
    if berubah:
        cache.clear()
    if hitung_ulang:
        jadwalkan_hitung_ulang(lokasi=[], skor=True)
    return f"Diperbarui: {', '.join(diperbarui) or 'tidak ada'}."
