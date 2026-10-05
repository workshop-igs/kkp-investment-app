from django.contrib.gis.geos import GEOSGeometry, MultiPolygon, Polygon


def buang_z(koordinat):
    if not isinstance(koordinat, list):
        return koordinat
    if koordinat and isinstance(koordinat[0], (int, float)):
        return koordinat[:2]
    return [buang_z(k) for k in koordinat]


def _kumpulkan_poligon(geom):
    if geom is None or geom.empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if geom.geom_type == 'MultiPolygon':
        return list(geom)
    if geom.geom_type == 'GeometryCollection':
        hasil = []
        for bagian in geom:
            hasil.extend(_kumpulkan_poligon(bagian))
        return hasil
    return []


def perbaiki_geometri(geojson_geometry):
    if not geojson_geometry:
        return None, 'tanpa geometri'

    import json

    try:
        bersih = {
            'type': geojson_geometry.get('type'),
            'coordinates': buang_z(geojson_geometry.get('coordinates')),
        }
        geom = GEOSGeometry(json.dumps(bersih), srid=4326)
    except Exception:
        return None, 'gagal dibaca'

    if not geom.valid:
        diperbaiki = None
        try:
            diperbaiki = geom.make_valid()
        except Exception:
            diperbaiki = None
        if diperbaiki is None or diperbaiki.empty:
            try:
                diperbaiki = geom.buffer(0)
            except Exception:
                diperbaiki = None
        geom = diperbaiki

    bagian = _kumpulkan_poligon(geom)
    if not bagian:
        return None, 'berluas nol di sumber'

    gabungan = MultiPolygon(bagian, srid=4326)
    if gabungan.empty:
        return None, 'berluas nol di sumber'
    return gabungan, 'ok'


def jadikan_multipolygon(geojson_geometry):
    return perbaiki_geometri(geojson_geometry)[0]
