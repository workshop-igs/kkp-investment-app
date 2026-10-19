import logging
import os
import shutil
import time
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.utils import timezone

logger = logging.getLogger('inti')

HIJAU, KUNING, MERAH = 'hijau', 'kuning', 'merah'
BOBOT = {HIJAU: 0, KUNING: 1, MERAH: 2}


def _hasil(nama, status, nilai, keterangan=''):
    return {'nama': nama, 'status': status, 'nilai': nilai, 'keterangan': keterangan}


def cek_basis_data():
    mulai = time.perf_counter()
    try:
        with connection.cursor() as c:
            c.execute('SELECT 1')
    except Exception as e:
        return _hasil('Basis data', MERAH, 'tidak terhubung',
                      f'PostgreSQL tidak dapat diakses ({type(e).__name__}); aplikasi tidak bisa membaca atau menyimpan data.')
    ms = (time.perf_counter() - mulai) * 1000
    if ms > 500:
        return _hasil('Basis data', KUNING, f'{ms:.0f} ms',
                      'Basis data lambat merespons; halaman dan analisis akan terasa lambat.')
    return _hasil('Basis data', HIJAU, f'{ms:.0f} ms')


def cek_redis():
    try:
        import redis

        klien = redis.Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=0.5, socket_timeout=1.0)
        mulai = time.perf_counter()
        klien.ping()
        ms = (time.perf_counter() - mulai) * 1000
    except Exception as e:
        return _hasil('Redis', MERAH, 'tidak merespons',
                      f'Redis tidak terjangkau ({type(e).__name__}); antrean tugas latar berhenti dan simpanan '
                      'cache tidak dipakai sehingga aplikasi lebih lambat.')
    return _hasil('Redis', HIJAU, f'{ms:.0f} ms')


def cek_celery(redis_hidup):
    if not redis_hidup:
        return _hasil('Worker Celery', MERAH, 'tidak dapat diperiksa',
                      'Worker Celery tidak bisa menerima tugas karena Redis mati.')
    try:
        from kkp_investasi.celery import app

        balasan = app.control.ping(timeout=1.0) or []
    except Exception as e:
        logger.warning(f'[KESEHATAN] Ping Celery gagal: {type(e).__name__}: {e}')
        balasan = []
    if not balasan:
        return _hasil('Worker Celery', MERAH, 'tidak berjalan',
                      'Tidak ada worker Celery yang merespons; hitung ulang skor dan tugas terjadwal tidak diproses. '
                      'Layanan kkp-celery perlu dijalankan ulang.')
    return _hasil('Worker Celery', HIJAU, f'{len(balasan)} worker aktif')


def cek_cpu():
    if not hasattr(os, 'getloadavg'):
        return None
    inti = os.cpu_count() or 1
    satu, lima, _ = os.getloadavg()
    persen = satu / inti * 100
    nilai = f'{persen:.0f}% ({inti} inti)'
    if satu / inti >= 1.5 and lima / inti >= 1.2:
        return _hasil('Beban CPU', MERAH, nilai,
                      f'VPS overload: beban CPU {persen:.0f}% dari kapasitas {inti} inti selama beberapa menit; '
                      'aplikasi lambat atau tidak merespons.')
    if satu / inti >= 0.9:
        return _hasil('Beban CPU', KUNING, nilai,
                      f'Beban CPU tinggi ({persen:.0f}% dari kapasitas); bila berlanjut VPS akan kewalahan.')
    return _hasil('Beban CPU', HIJAU, nilai)


def cek_memori():
    try:
        with open('/proc/meminfo') as f:
            info = {b.split(':')[0]: int(b.split()[1]) for b in f if ':' in b}
        total, tersedia = info['MemTotal'], info['MemAvailable']
    except (OSError, KeyError, ValueError, IndexError):
        return None
    persen = (1 - tersedia / total) * 100
    nilai = f'{persen:.0f}% dari {total / 1024 / 1024:.1f} GB'
    if persen >= 95:
        return _hasil('Memori', MERAH, nilai,
                      f'Memori VPS hampir habis ({persen:.0f}%); sistem bisa menghentikan proses aplikasi secara paksa.')
    if persen >= 85:
        return _hasil('Memori', KUNING, nilai, f'Pemakaian memori tinggi ({persen:.0f}%).')
    return _hasil('Memori', HIJAU, nilai)


def cek_disk():
    try:
        d = shutil.disk_usage(settings.BASE_DIR)
    except OSError:
        return None
    persen = d.used / d.total * 100
    nilai = f'{persen:.0f}% dari {d.total / 1024 ** 3:.0f} GB'
    if persen >= 95:
        return _hasil('Ruang disk', MERAH, nilai,
                      f'Disk hampir penuh ({persen:.0f}%); unggahan berkas dan penulisan basis data bisa gagal.')
    if persen >= 85:
        return _hasil('Ruang disk', KUNING, nilai, f'Disk mulai penuh ({persen:.0f}%); kosongkan ruang sebelum habis.')
    return _hasil('Ruang disk', HIJAU, nilai)


def cek_akses_ditolak():
    from inti.models import LogAktivitas

    batas = timezone.now() - timedelta(minutes=15)
    jumlah = LogAktivitas.objects.filter(aksi='DITOLAK', waktu__gte=batas).count()
    gagal_masuk = LogAktivitas.objects.filter(
        aksi='DITOLAK', waktu__gte=batas, ringkasan='Percobaan masuk gagal'
    ).count()
    nilai = f'{jumlah} dalam 15 menit'
    if gagal_masuk >= 50:
        return _hasil('Akses ditolak', MERAH, nilai,
                      f'{gagal_masuk} percobaan masuk gagal dalam 15 menit; kemungkinan serangan tebak kata sandi. '
                      'Periksa Log Aktivitas.')
    if jumlah >= 50:
        return _hasil('Akses ditolak', KUNING, nilai,
                      f'{jumlah} upaya akses ditolak dalam 15 menit, di atas kewajaran. Periksa Log Aktivitas.')
    return _hasil('Akses ditolak', HIJAU, nilai)


def cek_hitung_ulang():
    from analitik.models import StatusHitungUlang

    s = StatusHitungUlang.objects.filter(pk=1).first()
    if s is None:
        return None
    if s.berjalan:
        return _hasil('Hitung ulang skor', HIJAU, f'berjalan {s.ke}/{s.dari}')
    if s.galat:
        return _hasil('Hitung ulang skor', KUNING, 'gagal',
                      f'Hitung ulang skor terakhir gagal: {s.galat.strip().splitlines()[-1][:200]}')
    return _hasil('Hitung ulang skor', HIJAU, 'selesai' if s.selesai else 'siaga')


def periksa_semua():
    redis_ = cek_redis()
    hasil = [
        cek_basis_data(),
        redis_,
        cek_celery(redis_['status'] == HIJAU),
        cek_cpu(),
        cek_memori(),
        cek_disk(),
        cek_akses_ditolak(),
        cek_hitung_ulang(),
    ]
    hasil = [h for h in hasil if h]
    status = max((h['status'] for h in hasil), key=BOBOT.get, default=HIJAU)
    return {'status': status, 'pemeriksaan': hasil}
