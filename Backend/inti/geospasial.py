import logging
from typing import Any, Dict, Optional

from django.db.models.expressions import RawSQL
from pyproj import Geod
from shapely.geometry import shape

logger = logging.getLogger(__name__)

_geod = Geod(ellps='WGS84')

MIL_LAUT_M = 1852.0
BATAS_KEWENANGAN_PROVINSI_M = 12 * MIL_LAUT_M

RADIUS_PRASARING_DERAJAT = 1.0


def _jarak_geodesik(geom, model):
    return RawSQL(
        f'ST_Distance("{model._meta.db_table}"."geometry"::geography, '
        f'ST_GeomFromEWKT(%s)::geography)',
        (geom.ewkt,),
    )


def provinsi_dari_geometri(
    geom,
    batas_m: Optional[float] = BATAS_KEWENANGAN_PROVINSI_M,
) -> Dict[str, Any]:
    from inti.models import Provinsi

    hasil: Dict[str, Any] = {
        'provinsi': None,
        'metode': None,
        'jarak_km': None,
        'catatan': '',
    }

    if geom is None:
        hasil['catatan'] = 'Geometri tidak tersedia, provinsi tidak dapat ditentukan.'
        return hasil

    beririsan = (
        Provinsi.objects.filter(geometry__intersects=geom).defer('geometry').first()
    )
    if beririsan:
        hasil.update(
            provinsi=beririsan,
            metode='irisan',
            jarak_km=0.0,
            catatan=f'Area beririsan langsung dengan wilayah {beririsan.nama}.',
        )
        return hasil

    kotak = geom.envelope.buffer(RADIUS_PRASARING_DERAJAT)
    terdekat = (
        Provinsi.objects.exclude(geometry=None)
        .filter(geometry__bboverlaps=kotak)
        .annotate(jarak_m=_jarak_geodesik(geom, Provinsi))
        .defer('geometry')
        .order_by('jarak_m')
        .first()
    )
    if terdekat is None:
        terdekat = (
            Provinsi.objects.exclude(geometry=None)
            .annotate(jarak_m=_jarak_geodesik(geom, Provinsi))
            .defer('geometry')
            .order_by('jarak_m')
            .first()
        )

    if terdekat is None:
        hasil['catatan'] = 'Tidak ada batas provinsi yang termuat di basis data.'
        return hasil

    jarak_m = float(terdekat.jarak_m or 0)
    hasil['jarak_km'] = round(jarak_m / 1000.0, 2)

    if batas_m is not None and jarak_m > batas_m:
        hasil.update(
            provinsi=None,
            metode='di luar kewenangan provinsi',
            catatan=(
                f'Area berjarak {hasil["jarak_km"]:.1f} km dari daratan terdekat '
                f'({terdekat.nama}) — melewati batas 12 mil laut kewenangan '
                f'provinsi, sehingga dicatat sebagai perairan nasional. '
                f'Isi kolom provinsi secara manual bila memang ada kewenangan '
                f'daerah yang berlaku.'
            ),
        )
        return hasil

    hasil.update(
        provinsi=terdekat,
        metode='terdekat',
        catatan=(
            f'Area tidak beririsan dengan batas darat mana pun; ditetapkan ke '
            f'{terdekat.nama} sebagai daratan terdekat ({hasil["jarak_km"]:.1f} km). '
            f'Perkiraan, bukan hasil verifikasi batas wilayah.'
        ),
    )
    return hasil


def kabupaten_dari_geometri(geom, provinsi=None):
    from inti.models import KabupatenKota

    if geom is None:
        return None

    kabkota = (
        KabupatenKota.objects.filter(geometry__intersects=geom).defer('geometry').first()
    )
    if kabkota is not None:
        return kabkota
    if provinsi is None:
        return None

    return (
        KabupatenKota.objects.filter(provinsi=provinsi)
        .exclude(geometry=None)
        .annotate(jarak_m=_jarak_geodesik(geom, KabupatenKota))
        .defer('geometry')
        .order_by('jarak_m')
        .first()
    )


def hitung_luas_geodesik_ha(geometry):
    if not geometry:
        raise ValueError('Geometry tidak boleh kosong.')

    geom_type = geometry.get('type', '')

    if geom_type == 'Feature':
        geometry = geometry.get('geometry', {})
        geom_type = geometry.get('type', '')

    if geom_type not in ('Polygon', 'MultiPolygon'):
        raise ValueError(f"Tipe geometry '{geom_type}' tidak didukung. Hanya Polygon atau MultiPolygon yang diterima.")

    try:
        geom = shape(geometry)

        if not geom.is_valid:
            logger.warning('Geometry tidak valid, mencoba perbaikan otomatis...')
            geom = geom.buffer(0)

        if geom.is_empty:
            raise ValueError('Geometry kosong setelah validasi.')

        area_m2, _ = _geod.geometry_area_perimeter(geom)

        area_m2 = abs(area_m2)

        area_ha = area_m2 / 10_000.0

        area_ha = max(area_ha, 0.0001)

        logger.info(f'Geodesic area calculated: {area_m2:,.2f} m² = {area_ha:,.4f} ha (geometry type: {geom_type})')

        return round(area_ha, 4)

    except Exception as e:
        logger.error(f'Gagal menghitung luas geodesic: {e}', exc_info=True)
        raise ValueError(f'Gagal menghitung luas area dari geometry: {e}')
