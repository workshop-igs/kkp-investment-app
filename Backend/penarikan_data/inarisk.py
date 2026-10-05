import hashlib
import logging
from typing import Any, Dict, Optional

from django.core.cache import cache
from django.db import connection

logger = logging.getLogger(__name__)

CACHE_DETIK = 60 * 60 * 24

AMBANG_KELAS = ((0.334, 'RENDAH'), (0.667, 'SEDANG'), (1.01, 'TINGGI'))

JENIS_BENCANA: Dict[str, Dict[str, Any]] = {
    'TSUNAMI': {
        'label': 'Risiko Tsunami',
        'catatan': '',
    },
    'ABRASI': {
        'label': 'Risiko Gelombang Ekstrem & Abrasi',
        'catatan': (
            'BNPB menerbitkan gelombang ekstrem dan abrasi sebagai satu indeks '
            'gabungan; keduanya tidak dipisahkan di sumbernya.'
        ),
    },
    'BANJIR': {
        'label': 'Risiko Banjir',
        'catatan': (
            'InaRISK tidak menerbitkan indeks banjir rob tersendiri; indeks ini mencakup '
            'banjir sungai maupun genangan pesisir tanpa memisahkannya.'
        ),
    },
}

VARIAN_JENIS = {'TSUNAMI': 'RISIKO', 'ABRASI': 'RISIKO', 'BANJIR': 'RISIKO'}

SUMBER = 'BNPB InaRISK — raster 100 m, disimpan lokal'


def kelas_dari_indeks(nilai: Optional[float]) -> Optional[str]:
    if nilai is None:
        return None
    for batas, kelas in AMBANG_KELAS:
        if nilai < batas:
            return kelas
    return 'TINGGI'


def _statistik_lokal(jenis: str, geom) -> Optional[Dict[str, float]]:
    sql = """
        WITH petak AS (
            SELECT ST_Clip(rast, ST_GeomFromEWKT(%s), true) AS potong
            FROM analitik_raster_risiko_bencana
            WHERE jenis = %s
              AND varian = %s
              AND rast IS NOT NULL
              AND ST_Intersects(rast, ST_GeomFromEWKT(%s))
        ),
        dalam AS (
            SELECT ST_MapAlgebra(
                     potong, 1, '32BF',
                     'CASE WHEN [rast] >= 0 AND [rast] <= 1 THEN [rast] ELSE NULL END'
                   ) AS r
            FROM petak WHERE potong IS NOT NULL
        ),
        terpapar AS (
            SELECT ST_MapAlgebra(
                     potong, 1, '32BF',
                     'CASE WHEN [rast] > 0 AND [rast] <= 1 THEN [rast] ELSE NULL END'
                   ) AS r
            FROM petak WHERE potong IS NOT NULL
        ),
        nilai AS (
            SELECT
                (SELECT SUM((ST_SummaryStats(r, 1, true)).count) FROM dalam)    AS n_semua,
                (SELECT SUM((ST_SummaryStats(r, 1, true)).count) FROM terpapar) AS n_papar,
                (SELECT SUM((ST_SummaryStats(r, 1, true)).sum)   FROM terpapar) AS jml_papar,
                (SELECT MAX((ST_SummaryStats(r, 1, true)).max)   FROM dalam)    AS maks
        )
        SELECT n_semua, n_papar, jml_papar, maks FROM nilai
    """
    with connection.cursor() as c:
        c.execute(sql, [geom.ewkt, jenis, VARIAN_JENIS[jenis], geom.ewkt])
        baris = c.fetchone()

    if not baris or not baris[0]:
        return None

    n_semua, n_papar, jml_papar, maks = baris
    n_semua = int(n_semua or 0)
    n_papar = int(n_papar or 0)

    return {
        'rata2': (float(jml_papar) / n_papar) if n_papar else None,
        'maks': float(maks or 0),
        'jumlah_piksel': n_semua,
        'piksel_terpapar': n_papar,
        'cakupan_persen': (n_papar / n_semua * 100) if n_semua else 0.0,
    }


def _ada_data(jenis: str) -> bool:
    from analitik.models import RasterRisikoBencana

    kunci = f'risiko-bencana:ada:{jenis}:{VARIAN_JENIS[jenis]}'
    jawab = cache.get(kunci)
    if jawab is None:
        jawab = RasterRisikoBencana.objects.filter(
            jenis=jenis, varian=VARIAN_JENIS[jenis], rast__isnull=False
        ).exists()
        cache.set(kunci, jawab, 3600 if jawab else 60)
    return jawab


def indeks_risiko(geom) -> Dict[str, Any]:
    sidik = hashlib.md5(geom.wkb, usedforsecurity=False).hexdigest()
    kunci = f'risiko-bencana:{sidik}'
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan

    hasil: Dict[str, Any] = {
        'tersedia': False,
        'sumber': SUMBER,
        'bahaya': {},
        'catatan': '',
    }

    belum_ditarik = []
    for kode, meta in JENIS_BENCANA.items():
        try:
            if not _ada_data(kode):
                belum_ditarik.append(kode)
                hasil['bahaya'][kode] = {
                    'label': meta['label'],
                    'indeks': None,
                    'maks': None,
                    'kelas': None,
                    'cakupan_persen': None,
                    'catatan': (
                        'Peta risiko ini belum ditarik ke basis data, sehingga '
                        'area ini belum dinilai terhadapnya.'
                    ),
                }
                continue
            stat = _statistik_lokal(kode, geom)
        except Exception as e:
            logger.warning(f'[RISIKO] {kode} gagal dibaca: {e}')
            continue

        if stat is None or stat['rata2'] is None:
            hasil['bahaya'][kode] = {
                'label': meta['label'],
                'indeks': None,
                'maks': None,
                'kelas': None,
                'cakupan_persen': 0.0 if stat else None,
                'catatan': (
                    'Tidak ada risiko yang terpetakan di dalam area ini.'
                    if stat
                    else 'Area berada di luar cakupan peta risiko yang tersimpan.'
                ),
            }
            continue

        hasil['bahaya'][kode] = {
            'label': meta['label'],
            'varian': VARIAN_JENIS[kode],
            'indeks': round(stat['rata2'], 4),
            'maks': round(stat['maks'], 4),
            'kelas': kelas_dari_indeks(stat['rata2']),
            'cakupan_persen': round(stat['cakupan_persen'], 1),
            'jumlah_piksel': stat['jumlah_piksel'],
            'catatan': meta['catatan'],
        }

    berangka = [b for b in hasil['bahaya'].values() if b['indeks'] is not None]
    hasil['tersedia'] = bool(berangka)

    if belum_ditarik:
        hasil['catatan'] = (
            f'Peta risiko {", ".join(belum_ditarik)} belum tersedia di basis data. '
            f'Jalankan: python manage.py tarik_risiko_bencana'
        )
    elif not hasil['tersedia'] and hasil['bahaya']:
        hasil['catatan'] = (
            'Area berada di luar cakupan seluruh peta risiko InaRISK yang tersimpan.'
        )
    elif not hasil['bahaya']:
        hasil['catatan'] = (
            'Peta risiko bencana belum tersedia. '
            'Jalankan: python manage.py tarik_risiko_bencana'
        )

    if hasil['tersedia']:
        cache.set(kunci, hasil, CACHE_DETIK)
    return hasil
