import logging
from typing import Any, Dict, List

logger = logging.getLogger('ketenagakerjaan')

RADIUS_ASAL_KM = 100.0

MINIMUM_TK_DISEBUT = 1

SEKTOR_BERBASIS_NELAYAN = {
    'PERIKANAN_TANGKAP',
    'PERIKANAN_BUDIDAYA',
    'PENGOLAHAN_HASIL_LAUT',
}


def _kolam(kab, sektor_kode):
    if sektor_kode in SEKTOR_BERBASIS_NELAYAN and kab.jumlah_nelayan:
        return kab.jumlah_nelayan, 'nelayan'
    return kab.jumlah_penduduk, 'penduduk'


def sebaran_tk_kabupaten(
    geometry: Dict[str, Any],
    total_tk: int,
    sektor_kode: str = 'DEFAULT',
    radius_km: float = RADIUS_ASAL_KM,
) -> List[Dict[str, Any]]:
    from django.contrib.gis.db.models.functions import Distance
    from django.contrib.gis.geos import GEOSGeometry
    from django.contrib.gis.measure import D

    from inti.models import KabupatenKota

    if not total_tk or total_tk <= 0:
        return []

    try:
        mentah = geometry.get('geometry', geometry) if isinstance(geometry, dict) else geometry
        import json as _json

        geom = GEOSGeometry(_json.dumps(mentah), srid=4326)
    except Exception as e:
        logger.warning(f'[Sebaran TK] Geometry tidak dapat diproses: {e}')
        return []

    try:
        titik = geom.point_on_surface
        terdekat = (
            KabupatenKota.objects.filter(
                pesisir=True,
                geometry__isnull=False,
                jumlah_penduduk__gt=0,
                geometry__distance_lte=(titik, D(km=radius_km)),
            )
            .annotate(jarak=Distance('geometry', titik))
            .select_related('provinsi')
            .order_by('jarak')[:30]
        )
        daftar = list(terdekat)
    except Exception as e:
        logger.warning(f'[Sebaran TK] Kueri kabupaten gagal: {e}')
        return []

    if not daftar:
        return []

    try:
        id_di_area = set(
            KabupatenKota.objects.filter(
                id__in=[k.id for k in daftar], geometry__intersects=geom
            ).values_list('id', flat=True)
        )
    except Exception as e:
        logger.warning(f'[Sebaran TK] Irisan kabupaten gagal: {e}')
        id_di_area = set()
    if not id_di_area:
        id_di_area = {daftar[0].id}

    berbobot = []
    for kab in daftar:
        jarak_km = (kab.jarak.m or 0) / 1000.0
        kolam, nama_kolam = _kolam(kab, sektor_kode)
        if not kolam:
            continue
        peluruhan = max(0.0, 1.0 - jarak_km / radius_km)
        bobot = kolam * peluruhan
        if bobot <= 0:
            continue
        berbobot.append((kab, jarak_km, kolam, nama_kolam, bobot))

    total_bobot = sum(b for *_, b in berbobot)
    if not total_bobot:
        return []

    hasil = []
    for kab, jarak_km, kolam, nama_kolam, bobot in berbobot:
        orang = int(round(total_tk * bobot / total_bobot))
        if orang < MINIMUM_TK_DISEBUT:
            continue
        hasil.append(
            {
                'kabupaten_kota': kab.nama,
                'provinsi': kab.provinsi.nama if kab.provinsi_id else None,
                'kode_bps': kab.kode_bps,
                'jarak_km': round(jarak_km, 1),
                'kolam_tenaga_kerja': kolam,
                'jenis_kolam': nama_kolam,
                'perkiraan_asal_tk': orang,
                'persen': round(bobot / total_bobot * 100, 1),
                'di_area': kab.id in id_di_area,
            }
        )

    hasil.sort(key=lambda x: -x['perkiraan_asal_tk'])

    if hasil:
        selisih = total_tk - sum(x['perkiraan_asal_tk'] for x in hasil)
        hasil[0]['perkiraan_asal_tk'] += selisih
        hasil[0]['perkiraan_asal_tk'] = max(0, hasil[0]['perkiraan_asal_tk'])

    logger.info(
        f'[Sebaran TK] {sektor_kode}: {total_tk} TK dibagi ke {len(hasil)} kab/kota '
        f"dalam radius {radius_km:.0f} km ({sum(1 for x in hasil if x['di_area'])} di area proyek)"
    )
    return hasil
