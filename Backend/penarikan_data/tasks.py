import contextlib
import json
import logging
import os
import time
from datetime import timedelta

from celery import shared_task
from django.core.cache import cache
from django.core.management import CommandError, call_command
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

TARIK_MANUAL = [
    ('KKP-MANGROVE', 'ekosistem', 'Sebaran dan kondisi mangrove, Portal Satu Data KKP', 'tarik_ekosistem_wfs', True),
    ('SIDAKO', 'ekosistem', 'Padang lamun dan terumbu karang, Sidako KKP', 'tarik_ekosistem_sidako', True),
    ('KKP-UNSUR-RUANG', 'adat', 'Unsur ruang laut dan wilayah kelola masyarakat hukum adat, Portal Satu Data KKP',
     'tarik_unsur_ruang_wfs', True),
]


def daftar_unggah():
    from analitik.models import RasterOseanografi, RasterRisikoBencana
    from analitik.services.asal_data import kelompok_raster

    return [
        *((f'UNGGAH-{k}', 'bencana', f'Risiko {n.lower()}', 'muat_berkas_raster', True)
          for k, n in RasterRisikoBencana.JENIS_CHOICES),
        *((f'UNGGAH-{k}', 'kondisi_tetap', n, 'muat_berkas_raster', True)
          for k, n in RasterOseanografi.PARAMETER_CHOICES
          if kelompok_raster(k) == 'kondisi_tetap' and k != 'PRODUKSI_KABUPATEN'),
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


def tarik_sumber(kode, nama, perintah, paksa=False, argumen=()):
    from penarikan_data.models import LogPenarikan

    cfg = konfigurasi(kode, nama)
    log = LogPenarikan.objects.create(api_config=cfg, endpoint=perintah, result='', request_params={'paksa': paksa})
    mulai = time.time()
    try:
        hasil = call_command(perintah, *argumen)
        galat = ''
    except CommandError as e:
        hasil, galat = None, str(e)
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
    log.completed_at = timezone.now()
    log.result = 'FAILED' if galat else 'SUCCESS'
    log.response_time_ms = int((time.time() - mulai) * 1000)
    log.error_message = galat[:2000]
    log.response_summary = ringkasan
    log.save()
    return not galat, not galat and ringkasan.get('dimuat', True)


@shared_task
def perbarui_sumber_data(paksa=False):
    from analitik.tasks import jadwalkan_hitung_ulang

    diperbarui, berubah, hitung_ulang = [], False, False
    for kode, _, nama, perintah, memicu in JADWAL:
        tempo = jatuh_tempo(konfigurasi(kode, nama))
        if not paksa and tempo and timezone.now() < tempo:
            continue
        berhasil, dimuat = tarik_sumber(kode, nama, perintah, paksa)
        if berhasil:
            diperbarui.append(kode)
        if dimuat:
            berubah = True
            hitung_ulang = hitung_ulang or memicu
    if berubah:
        cache.clear()
    if hitung_ulang:
        jadwalkan_hitung_ulang(lokasi=[], skor=True)
    return f"Diperbarui: {', '.join(diperbarui) or 'tidak ada'}."


@shared_task
def perbarui_satu_sumber(kode):
    from analitik.tasks import jadwalkan_hitung_ulang

    _, _, nama, perintah, memicu = next(j for j in (*JADWAL, *TARIK_MANUAL) if j[0] == kode)
    if tarik_sumber(kode, nama, perintah, paksa=True)[1]:
        cache.clear()
        if memicu:
            jadwalkan_hitung_ulang(lokasi=[], skor=True)


@shared_task
def muat_unggahan(kode, berkas, keterangan):
    from analitik.tasks import jadwalkan_hitung_ulang

    _, kelompok, nama, perintah, _ = next(j for j in daftar_unggah() if j[0] == kode)
    try:
        dimuat = tarik_sumber(kode, nama, perintah, argumen=[
            '--kelompok', kelompok, '--kode', kode.removeprefix('UNGGAH-'), '--berkas', berkas, '--keterangan', keterangan,
        ])[1]
    finally:
        with contextlib.suppress(OSError):
            os.remove(berkas)
    if dimuat:
        cache.clear()
        jadwalkan_hitung_ulang(lokasi=dimuat if isinstance(dimuat, list) else [], skor=True)
