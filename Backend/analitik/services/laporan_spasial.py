import logging
from typing import Any, Dict, List, Optional

from django.contrib.gis.db.models.functions import GeometryDistance
from django.contrib.gis.geos import GEOSGeometry
from django.db import transaction
from django.db.models import Max
from django.db.models.expressions import RawSQL

from analitik.models import RasterRisikoBencana
from analitik.services.konstanta import (
    BATAS_PESISIR_M,
    BULAN,
    FAKTOR_KARBON_KE_CO2,
    GMW_TAHUN_AKHIR,
    STOK_KARBON_BIRU,
    SUMBER_EKOSISTEM_UTAMA,
    SUMBER_LAMUN,
    SUMBER_MANGROVE_GMW,
)
from inti.models import KabupatenKota, Provinsi
from inventarisasi.klasifikasi import jenis_unsur
from inventarisasi.models import (
    KKPRL,
    InfrastrukturPendukung,
    UnsurRuangLaut,
    ZonasiRuangLaut,
)

logger = logging.getLogger(__name__)


def _per(model, kolom='updated_at'):
    t = model.objects.aggregate(t=Max(kolom))['t']
    return f', data per {BULAN[t.month - 1]} {t.year}' if t else ''


M2_KE_HA = 1e-4

BATAS_BARIS = 12

LUAS_AOI_MAKS_KM2 = 50_000.0
SIMPUL_AOI_MAKS = 10_000

BATAS_WAKTU_SQL_MS = 25_000

RADIUS_BERTAHAP_KM = [40.0, 120.0, 300.0]

LABEL_UNSUR = {
    'ALUR_PELAYARAN': 'Alur Pelayaran & ALKI',
    'KABEL': 'Kabel Bawah Laut',
    'PIPA': 'Pipa Bawah Laut',
    'MIGRASI_BIOTA': 'Koridor Migrasi Biota',
    'KSNT': 'Kawasan Strategis Nasional Tertentu',
    'LAINNYA': 'Unsur Lain',
}


def _kolom(model):
    return f'"{model._meta.db_table}"."geometry"'


def _luas_irisan(geom, model):
    return RawSQL(
        f'ST_Area(ST_Intersection(ST_MakeValid({_kolom(model)}), ST_GeomFromEWKT(%s))::geography)',
        (geom.ewkt,),
    )


def _jarak_ke_aoi(geom, model):
    return RawSQL(
        f'ST_Distance({_kolom(model)}::geography, ST_GeomFromEWKT(%s)::geography)',
        (geom.ewkt,),
    )


def _kotak_derajat(geom, radius_km):
    d = radius_km / 111.0
    x1, y1, x2, y2 = geom.extent
    return (x1 - d, y1 - d, x2 + d, y2 + d)


def _fakta_area(geom) -> Dict[str, Any]:
    from django.db import connection

    with connection.cursor() as c:
        c.execute('SELECT ST_Area(ST_GeomFromEWKT(%s)::geography)', (geom.ewkt,))
        luas_m2 = float(c.fetchone()[0] or 0)

    poligon = [geom] if geom.geom_type == 'Polygon' else list(geom)
    titik_sudut = [
        {'bagian': i, 'titik': [[round(x, 7), round(y, 7)] for x, y in p.exterior_ring.coords[:-1]]}
        for i, p in enumerate(poligon, 1)
        if p.geom_type == 'Polygon'
    ]
    return {
        'luas_m2': luas_m2,
        'luas_ha': luas_m2 * M2_KE_HA,
        'titik_sudut': titik_sudut,
        'cakupan': [round(v, 6) for v in geom.extent],
    }


def bagian_bencana(geom) -> Dict[str, Any]:
    from penarikan_data.inarisk import indeks_risiko

    try:
        ina = indeks_risiko(geom)
    except Exception as e:
        logger.warning(f'[LAPORAN] InaRISK gagal: {e}')
        ina = {'tersedia': False, 'bahaya': {}, 'catatan': 'Layanan BNPB tidak dapat dihubungi.',
               'sumber': 'BNPB InaRISK'}

    baris = []
    for kode, b in (ina.get('bahaya') or {}).items():
        baris.append(
            {
                'nama': b['label'],
                'kategori': b['kelas'] or 'Tidak terpetakan',
                'indeks': b['indeks'],
                'maks': b.get('maks'),
                'cakupan_persen': b.get('cakupan_persen'),
                'keterangan': b.get('catatan', ''),
                'varian': b.get('varian'),
                'kunci': kode,
            }
        )

    berangka = [b for b in baris if b['indeks'] is not None]
    sorotan = None
    ringkas = ''
    if berangka:
        tertinggi = max(berangka, key=lambda b: b['indeks'])
        sorotan = {
            'nilai': f"{tertinggi['indeks']:.2f}",
            'label': f"indeks {tertinggi['nama'].lower()} (tertinggi)",
        }
        kelas_tinggi = [b['nama'] for b in berangka if b['kategori'] == 'TINGGI']
        papar = tertinggi.get('cakupan_persen')
        keterangan_papar = (
            f' Bagian area yang terpapar {tertinggi["nama"].lower()}: {papar:.0f}%.'
            if papar is not None
            else ''
        )
        if kelas_tinggi:
            ringkas = (
                f'{len(kelas_tinggi)} dari {len(berangka)} risiko yang terpetakan berada '
                f'pada kelas TINGGI: {", ".join(kelas_tinggi)}. Indeks tinggi tidak '
                f'menggugurkan rencana investasi, tetapi menuntut rancangan bangunan dan '
                f'rencana tanggap darurat yang menyesuaikan.' + keterangan_papar
            )
        else:
            ringkas = (
                f'Seluruh risiko yang terpetakan berada di kelas menengah ke bawah. '
                f'Indeks tertinggi {tertinggi["indeks"]:.2f} pada '
                f'{tertinggi["nama"].lower()}.' + keterangan_papar
            )
        belum = [b['nama'] for b in baris if b['indeks'] is None]
        if belum:
            ringkas += f' Tidak terpetakan untuk area ini: {", ".join(belum)}.'

    batimetri = _batimetri(geom)
    return {**_bagian(
        kunci='bencana',
        judul='Risiko Bencana Pesisir',
        ukuran='indeks',
        sumber='; '.join(filter(None, [
            (ina.get('sumber') or 'BNPB InaRISK') + _per(RasterRisikoBencana, 'ditarik_pada'),
            batimetri and batimetri['sumber'],
        ])),
        diperiksa=len(ina.get('bahaya') or {}),
        baris=baris,
        sorotan=sorotan,
        ringkas=ringkas,
        catatan_kosong=(
            ina.get('catatan')
            or 'Indeks risiko bencana tidak tersedia untuk area ini.'
        ),
        grafik=[{'label': b['nama'], 'nilai': b['indeks']} for b in berangka],
    ), 'batimetri': batimetri}


def _bagian(
    kunci: str,
    judul: str,
    ukuran: str,
    sumber: str,
    diperiksa: int,
    baris: List[Dict[str, Any]],
    sorotan: Optional[Dict[str, Any]] = None,
    ringkas: str = '',
    catatan_kosong: str = '',
    grafik: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    return {
        'kunci': kunci,
        'judul': judul,
        'ukuran': ukuran,
        'sorotan': sorotan,
        'ringkas': ringkas,
        'baris': baris[:BATAS_BARIS],
        'jumlah_baris': len(baris),
        'dipangkas': len(baris) > BATAS_BARIS,
        'grafik': grafik or [],
        'sumber': sumber,
        'objek_diperiksa': diperiksa,
        'kosong': not baris or all(
            b.get('indeks') is None for b in baris
        ) if ukuran == 'indeks' else not baris,
        'catatan_kosong': catatan_kosong,
    }


ARAH_MATA_ANGIN = (
    'utara', 'timur laut', 'timur', 'tenggara',
    'selatan', 'barat daya', 'barat', 'barat laut',
)


def _arah(azimut_derajat: float) -> str:
    return ARAH_MATA_ANGIN[int((azimut_derajat % 360) / 45.0 + 0.5) % 8]


def _provinsi_terdekat(geom, batas: int = 3):
    from django.db import connection

    sql = f"""
        WITH kandidat AS (
            SELECT nama, kode_bps, COALESCE(geometry_tampilan, geometry) AS g
            FROM {Provinsi._meta.db_table}
            WHERE geometry IS NOT NULL
            ORDER BY geometry <-> ST_GeomFromEWKT(%s)
            LIMIT 8
        )
        SELECT nama, kode_bps,
               ST_Distance(g::geography, ST_GeomFromEWKT(%s)::geography) AS m,
               degrees(ST_Azimuth(
                   ST_Centroid(ST_GeomFromEWKT(%s)),
                   ST_ClosestPoint(g, ST_Centroid(ST_GeomFromEWKT(%s)))
               )) AS azimut
        FROM kandidat
        ORDER BY m
        LIMIT %s
    """
    with connection.cursor() as c:
        c.execute(sql, [geom.ewkt, geom.ewkt, geom.ewkt, geom.ewkt, batas])
        return c.fetchall()


def _bagian_wilayah(geom, luas_aoi_m2) -> Dict[str, Any]:
    qs = (
        Provinsi.objects.filter(geometry__intersects=geom)
        .annotate(irisan_m2=_luas_irisan(geom, Provinsi))
        .defer('geometry')
        .order_by('-irisan_m2')
    )
    baris = []
    for p in qs:
        m2 = float(p.irisan_m2 or 0)
        if m2 <= 0:
            continue
        baris.append(
            {
                'nama': p.nama,
                'kode_bps': p.kode_bps,
                'kategori': f'Kode BPS {p.kode_bps}',
                'luas_ha': m2 * M2_KE_HA,
                'persen': (m2 / luas_aoi_m2 * 100) if luas_aoi_m2 else 0,
            }
        )

    sorotan = None
    ringkas = ''
    ukuran = 'irisan'
    catatan_kosong = (
        'Area tidak beririsan dengan batas provinsi mana pun, dan jarak ke '
        'daratan terdekat tidak dapat dihitung.'
    )

    if baris:
        utama = baris[0]
        sorotan = {'nilai': f"{utama['persen']:.1f}%", 'label': f"berada di {utama['nama']}"}
        if len(baris) > 1:
            ringkas = (
                f'Area melintasi {len(baris)} provinsi. Perizinan lintas provinsi '
                f'memerlukan koordinasi lebih dari satu pemerintah daerah.'
            )
        else:
            ringkas = f'Seluruh area berada dalam kewenangan Provinsi {utama["nama"]}.'
    else:
        ukuran = 'jarak'
        terdekat = _provinsi_terdekat(geom)
        for nama, kode, meter, azimut in terdekat:
            km = float(meter or 0) / 1000.0
            baris.append(
                {
                    'nama': f'Provinsi {nama}',
                    'kode_bps': kode,
                    'kategori': f'Kode BPS {kode}',
                    'jarak_km': round(km, 1),
                    'keterangan': (
                        f'{km:.1f} km ke arah {_arah(float(azimut or 0))}'
                        if azimut is not None
                        else f'{km:.1f} km'
                    ),
                }
            )
        if baris:
            u = baris[0]
            sorotan = {'nilai': f"{u['jarak_km']:.1f} km", 'label': f"dari {u['nama']}"}
            ringkas = (
                f'Area tidak berada di dalam wilayah administratif provinsi mana pun. '
                f'Daratan terdekat adalah {u["nama"]}, {u["keterangan"]} dari titik '
                f'pusat area. Perairan di luar 12 mil laut berada di bawah kewenangan '
                f'Pemerintah Pusat, bukan pemerintah provinsi — perizinannya menempuh '
                f'jalur yang berbeda.'
            )

    return {**_bagian(
        kunci='wilayah',
        judul='Wilayah Administratif',
        ukuran=ukuran,
        sumber='Batas provinsi Portal Satu Data KKP' + _per(Provinsi),
        diperiksa=Provinsi.objects.count(),
        baris=baris,
        sorotan=sorotan,
        ringkas=ringkas,
        catatan_kosong=catatan_kosong,
        grafik=[{'label': b['nama'], 'nilai': b['persen']} for b in baris[:6]]
        if ukuran == 'irisan'
        else [],
    ), 'kabupaten_terdekat': (
        KabupatenKota.objects.filter(provinsi__kode_bps=baris[0]['kode_bps'], geometry__isnull=False)
        .order_by(GeometryDistance('geometry', geom.point_on_surface))
        .values('kode_bps', 'nama').first()
    ) if baris else None}


def _irisan_berkelompok(tabel, kolom_kelompok, geom, syarat_tambahan=''):
    from django.db import connection

    sql = f"""
        SELECT {kolom_kelompok} AS kelompok,
               -- Urutannya menentukan kecepatan: MEMOTONG dulu, baru
               -- MENYATUKAN. ST_Union atas poligon utuh (sebagian berukuran
               -- provinsi) lalu dipotong memakan 4 detik; menyatukan
               -- kepingan-kepingan kecil hasil pemotongan jauh lebih murah,
               -- dan hasilnya identik.
               ST_Area(ST_Union(
                   ST_Intersection(ST_MakeValid(geometry), ST_GeomFromEWKT(%s))
               )::geography) AS m2,
               COUNT(*) AS jumlah
        FROM {tabel}
        WHERE ST_Intersects(geometry, ST_GeomFromEWKT(%s)) {syarat_tambahan}
        GROUP BY {kolom_kelompok}
        ORDER BY m2 DESC
    """
    with connection.cursor() as c:
        c.execute(sql, (geom.ewkt, geom.ewkt))
        return c.fetchall()


def _bagian_tata_ruang(geom, luas_aoi_m2) -> Dict[str, Any]:
    label = dict(ZonasiRuangLaut.SUB_ZONA_CHOICES)
    baris = []
    total = 0.0
    for sub, m2, jumlah in _irisan_berkelompok(
        ZonasiRuangLaut._meta.db_table, 'sub_zona', geom
    ):
        m2 = float(m2 or 0)
        if m2 <= 0:
            continue
        total += m2
        baris.append(
            {
                'nama': label.get(sub, sub or 'Lainnya'),
                'kategori': 'Rencana zonasi',
                'keterangan': f'{jumlah} poligon',
                'luas_ha': m2 * M2_KE_HA,
                'persen': (m2 / luas_aoi_m2 * 100) if luas_aoi_m2 else 0,
            }
        )

    persen_total = (total / luas_aoi_m2 * 100) if luas_aoi_m2 else 0
    sorotan = None
    ringkas = ''
    if baris:
        utama = baris[0]
        sorotan = {'nilai': f"{utama['persen']:.1f}%", 'label': f"area berada di {utama['nama']}"}
        ringkas = (
            f'{min(persen_total, 100):.1f}% area tercakup rencana zonasi, terbagi ke '
            f'dalam {len(baris)} peruntukan. Peruntukan dengan porsi terbesar '
            f'menentukan jenis kegiatan yang dapat diizinkan.'
        )
        if persen_total > 100.5:
            ringkas += (
                f' Jumlah seluruh peruntukan mencapai {persen_total:.0f}% karena '
                f'sebagian zona saling bertindih pada data sumber.'
            )

    return _bagian(
        kunci='tata_ruang',
        judul='Kesesuaian Rencana Tata Ruang Laut',
        ukuran='irisan',
        sumber='Portal Satu Data KKP · inventarisasi.ZonasiRuangLaut' + _per(ZonasiRuangLaut),
        diperiksa=ZonasiRuangLaut.objects.count(),
        baris=baris,
        sorotan=sorotan,
        ringkas=ringkas,
        catatan_kosong=(
            'Tidak ada zona rencana yang beririsan dengan area ini. Itu TIDAK '
            'berarti area bebas dari aturan tata ruang — kemungkinan besar '
            'rencana zonasi wilayah tersebut belum termuat dalam basis data. '
            'Kesesuaian tata ruang harus diperiksa manual ke dinas terkait.'
        ),
        grafik=[{'label': b['nama'], 'nilai': b['persen']} for b in baris[:6]],
    )


def _bagian_kkprl(geom, luas_aoi_m2) -> Dict[str, Any]:
    qs = (
        KKPRL.objects.filter(geometry__intersects=geom, status='AKTIF')
        .annotate(irisan_m2=_luas_irisan(geom, KKPRL))
        .select_related('provinsi')
        .defer('geometry', 'provinsi__geometry')
        .order_by('-irisan_m2')
    )
    baris = []
    total = 0.0
    for k in qs:
        m2 = float(k.irisan_m2 or 0)
        if m2 <= 0:
            continue
        total += m2
        baris.append(
            {
                'nama': k.nama_pemohon,
                'kategori': k.get_jenis_dokumen_display(),
                'keterangan': f'{k.jenis_kegiatan} · {k.nomor_izin}',
                'luas_ha': m2 * M2_KE_HA,
                'persen': (m2 / luas_aoi_m2 * 100) if luas_aoi_m2 else 0,
            }
        )

    persen = (total / luas_aoi_m2 * 100) if luas_aoi_m2 else 0
    sorotan = None
    ringkas = ''
    if baris:
        teks_persen = (
            f'{min(persen, 100):.1f}%' if persen >= 0.05 else 'kurang dari 0.1%'
        )
        sorotan = {
            'nilai': teks_persen,
            'label': 'luas area analisis tertumpang izin aktif',
        }
        ringkas = (
            f'{len(baris)} izin KKPRL aktif beririsan dengan area ini, menutup '
            f'{teks_persen} dari luas area analisis. Tumpang tindih tidak otomatis '
            f'menggugurkan permohonan, tetapi memerlukan penilaian keserasian '
            f'kegiatan dan kemungkinan persetujuan pemegang izin.'
        )
        if persen > 100.5:
            ringkas += (
                f' Penjumlahan per izin mencapai {persen:.0f}% karena beberapa izin '
                f'menempati ruang yang sama dengan kedalaman atau kegiatan berbeda.'
            )

    return _bagian(
        kunci='kkprl',
        judul='Perizinan Ruang Laut yang Berlaku',
        ukuran='irisan',
        sumber='Portal Satu Data KKP · inventarisasi.KKPRL (status aktif)' + _per(KKPRL),
        diperiksa=KKPRL.objects.filter(status='AKTIF').count(),
        baris=baris,
        sorotan=sorotan,
        ringkas=ringkas,
        catatan_kosong=(
            'Tidak ada izin KKPRL aktif yang beririsan dengan area ini menurut '
            'data yang tersimpan. Basis data memuat izin yang sudah dipublikasikan; '
            'permohonan yang sedang diproses tidak terlihat di sini.'
        ),
        grafik=[{'label': b['nama'][:28], 'nilai': b['persen']} for b in baris[:6]],
    )


def _bagian_unsur(geom) -> Dict[str, Any]:
    baris = []
    for radius in RADIUS_BERTAHAP_KM:
        x1, y1, x2, y2 = _kotak_derajat(geom, radius)
        qs = (
            UnsurRuangLaut.objects.filter(
                geometry__bboverlaps=GEOSGeometry(
                    f'POLYGON(({x1} {y1},{x2} {y1},{x2} {y2},{x1} {y2},{x1} {y1}))', srid=4326
                )
            )
            .annotate(jarak_m=_jarak_ke_aoi(geom, UnsurRuangLaut))
            .defer('geometry')
            .order_by('jarak_m')[:120]
        )
        terdekat: Dict[str, Dict[str, Any]] = {}
        for u in qs:
            jarak = float(u.jarak_m or 0)
            if jarak > radius * 1000:
                continue
            kode = jenis_unsur(u.nama, u.jenis, u.keterangan, u.kode_lapisan)
            if kode not in terdekat:
                terdekat[kode] = {
                    'nama': LABEL_UNSUR.get(kode, kode.replace('_', ' ').title()),
                    'kategori': LABEL_UNSUR.get(kode, kode),
                    'keterangan': (u.nama or '')[:70],
                    'jarak_km': jarak / 1000.0,
                    'beririsan': jarak <= 0.5,
                }
        if terdekat:
            baris = sorted(terdekat.values(), key=lambda b: b['jarak_km'])
            break

    sorotan = None
    ringkas = ''
    if baris:
        paling = baris[0]
        sorotan = (
            {'nilai': 'Beririsan', 'label': f"dengan {paling['nama']}"}
            if paling['beririsan']
            else {'nilai': f"{paling['jarak_km']:.1f} km", 'label': f"ke {paling['nama']} terdekat"}
        )
        n_iris = sum(1 for b in baris if b['beririsan'])
        ringkas = (
            f'{len(baris)} jenis unsur ruang laut berada dalam jangkauan analisis'
            + (f', {n_iris} di antaranya memotong area.' if n_iris else '.')
            + ' Kabel dan pipa bawah laut menuntut zona aman berjangkar; '
            'alur pelayaran membatasi penempatan bangunan laut.'
        )

    return _bagian(
        kunci='unsur',
        judul='Alur Pelayaran & Unsur Ruang Laut',
        ukuran='jarak',
        sumber='Portal Satu Data KKP · inventarisasi.UnsurRuangLaut' + _per(UnsurRuangLaut),
        diperiksa=UnsurRuangLaut.objects.count(),
        baris=baris,
        sorotan=sorotan,
        ringkas=ringkas,
        catatan_kosong=(
            f'Tidak ditemukan unsur ruang laut dalam radius '
            f'{int(RADIUS_BERTAHAP_KM[-1])} km dari area ini.'
        ),
    )


def _bagian_infrastruktur(geom) -> Dict[str, Any]:
    baris = []
    for radius in RADIUS_BERTAHAP_KM:
        x1, y1, x2, y2 = _kotak_derajat(geom, radius)
        qs = (
            InfrastrukturPendukung.objects.filter(
                geometry__bboverlaps=GEOSGeometry(
                    f'POLYGON(({x1} {y1},{x2} {y1},{x2} {y2},{x1} {y2},{x1} {y1}))', srid=4326
                )
            )
            .annotate(jarak_m=_jarak_ke_aoi(geom, InfrastrukturPendukung))
            .select_related('provinsi')
            .defer('geometry', 'provinsi__geometry')
            .order_by('jarak_m')[:200]
        )
        terdekat: Dict[str, Dict[str, Any]] = {}
        for o in qs:
            jarak = float(o.jarak_m or 0)
            if jarak > radius * 1000:
                continue
            if o.kategori not in terdekat:
                terdekat[o.kategori] = {
                    'nama': o.nama,
                    'kategori': o.get_kategori_display(),
                    'keterangan': ' · '.join([v for v in [o.kelas, o.pengelola] if v])[:70],
                    'jarak_km': jarak / 1000.0,
                    'beririsan': jarak <= 0.5,
                }
        if terdekat:
            baris = sorted(terdekat.values(), key=lambda b: b['jarak_km'])
            break

    sorotan = None
    ringkas = ''
    if baris:
        paling = baris[0]
        sorotan = (
            {'nilai': 'Di dalam area', 'label': f"terdapat {paling['kategori']}"}
            if paling['beririsan']
            else {'nilai': f"{paling['jarak_km']:.1f} km", 'label': f"ke {paling['kategori']} terdekat"}
        )
        ringkas = (
            (f'Terdapat {paling["kategori"]} di dalam area ({paling["nama"]}). '
             if paling['beririsan']
             else f'Infrastruktur terdekat berjarak {paling["jarak_km"]:.1f} km ({paling["nama"]}). ')
            + 'Jarak ke pelabuhan dan jaringan listrik menentukan biaya logistik dan '
            'penyambungan daya, dan ikut menjadi masukan skor aksesibilitas.'
        )

    return _bagian(
        kunci='infrastruktur',
        judul='Aksesibilitas & Infrastruktur Pendukung',
        ukuran='jarak',
        sumber='Portal Satu Data KKP · inventarisasi.InfrastrukturPendukung' + _per(InfrastrukturPendukung),
        diperiksa=InfrastrukturPendukung.objects.count(),
        baris=baris,
        sorotan=sorotan,
        ringkas=ringkas,
        catatan_kosong=(
            f'Tidak ada infrastruktur pendukung dalam radius '
            f'{int(RADIUS_BERTAHAP_KM[-1])} km. Lokasi seterpencil ini menanggung '
            f'biaya logistik dan penyediaan daya yang jauh lebih besar.'
        ),
    )


def _desimal(v, d=1) -> str:
    return f'{v:,.{d}f}'.replace(',', '_').replace('.', ',').replace('_', '.')


KETERANGAN_OSEANOGRAFI = {
    'KLOROFIL': lambda v: (
        'perairan subur (eutrofik)' if v >= 1 else 'kesuburan sedang (mesotrofik)' if v >= 0.2
        else 'perairan kurang subur (oligotrofik)'
    ),
    'GELOMBANG': lambda v: (
        'gelombang tinggi' if v >= 2.5 else 'gelombang agak tinggi' if v >= 1.25
        else 'gelombang sedang' if v >= 0.5 else 'perairan tenang'
    ),
}


LABEL_OSEANOGRAFI = {
    'SUHU': 'Suhu permukaan laut',
    'KLOROFIL': 'Klorofil-a',
    'GELOMBANG': 'Tinggi gelombang signifikan',
}


def _rentang(bawah, atas, d, satuan):
    if _desimal(bawah, d) == _desimal(atas, d):
        return f'{_desimal(bawah, d)} {satuan}'
    return f'{_desimal(bawah, d)} - {_desimal(atas, d)} {satuan}'


def _statistik_oseanografi(geom, parameter):
    from django.db import connection

    sql = """
        SELECT o.parameter, o.satuan, o.periode, o.sumber, ST_NumBands(o.rast),
               (ST_SummaryStats(c.r, 1, true)).count, (ST_SummaryStats(c.r, 1, true)).sum,
               (ST_SummaryStats(c.r, 1, true)).min, (ST_SummaryStats(c.r, 1, true)).max,
               (ST_SummaryStats(c.r, LEAST(2, ST_NumBands(o.rast)), true)).min,
               (ST_SummaryStats(c.r, ST_NumBands(o.rast), true)).max,
               ST_Value(o.rast, 1, t.titik), ST_Value(o.rast, LEAST(2, ST_NumBands(o.rast)), t.titik),
               ST_Value(o.rast, ST_NumBands(o.rast), t.titik)
        FROM analitik_raster_oseanografi o
        CROSS JOIN (SELECT ST_GeomFromEWKT(%s) AS g, ST_PointOnSurface(ST_GeomFromEWKT(%s)) AS titik) t
        CROSS JOIN LATERAL (SELECT ST_Clip(o.rast, t.g, true) AS r) c
        WHERE o.cakupan && t.g AND o.parameter = ANY(%s)
    """
    hasil = {}
    with connection.cursor() as c:
        c.execute(sql, [geom.ewkt, geom.ewkt, list(parameter)])
        for kode, satuan, periode, sumber, pita, n, jml, mn, mx, mn_waktu, mx_waktu, t1, t_mn, t_mx in c.fetchall():
            h = hasil.setdefault(kode, {'satuan': satuan, 'periode': periode, 'sumber': sumber, 'pita': pita,
                                        'n': 0, 'jumlah': 0.0, 'min': [], 'max': [], 'titik': None})
            if n:
                h['n'] += n
                h['jumlah'] += jml
                h['min'].append(mn if pita == 1 else mn_waktu)
                h['max'].append(mx if pita == 1 else mx_waktu)
            elif t1 is not None:
                h['titik'] = (t1, t_mn, t_mx)
    for h in hasil.values():
        if h['n']:
            h['rata2'], h['min'], h['max'] = h['jumlah'] / h['n'], min(h['min']), max(h['max'])
        elif h['titik']:
            h['rata2'], h['min'], h['max'] = h['titik'] if h['pita'] > 1 else (h['titik'][0],) * 3
        else:
            h['rata2'] = None
    return hasil


def _batimetri(geom):
    k = _statistik_oseanografi(geom, ['KEDALAMAN']).get('KEDALAMAN') or {}
    if k.get('rata2') is None:
        return None
    terdekat = _provinsi_terdekat(geom, 1)
    jarak_m = float(terdekat[0][2]) if terdekat else None
    return {
        'rata2': f"{_desimal(-k['rata2'], 0)} m",
        'rentang': _rentang(-k['max'], -k['min'], 0, 'm'),
        'sumber': k['sumber'],
        'catatan': (
            f'Area berjarak {_desimal(jarak_m / 1000, 1)} km dari daratan terdekat dan tidak bersentuhan dengan '
            'pesisir; paparan fisiknya dibaca dari kedalaman laut, bukan dari indeks bencana pesisir.'
        ) if jarak_m is not None and jarak_m > BATAS_PESISIR_M else '',
    }


def bagian_oseanografi(geom) -> Dict[str, Any]:
    stat = _statistik_oseanografi(geom, LABEL_OSEANOGRAFI)
    baris = []
    for kode, label in LABEL_OSEANOGRAFI.items():
        s = stat.get(kode) or {}
        if s.get('rata2') is None:
            continue
        d = 2 if kode == 'KLOROFIL' else 1
        tafsir = KETERANGAN_OSEANOGRAFI.get(kode, lambda v: '')(s['rata2'])
        baris.append({'sel': [
            label, f"{_desimal(s['rata2'], d)} {s['satuan']}", _rentang(s['min'], s['max'], d, s['satuan']),
            '; '.join(filter(None, [tafsir, f"rentang antarwaktu, {s['periode']}" if s['periode'] else ''])),
        ], 'sumber': s['sumber']})

    kosong = [label for kode, label in LABEL_OSEANOGRAFI.items() if (stat.get(kode) or {}).get('rata2') is None]
    ringkas = (
        f"Tidak terpetakan: {', '.join(kosong).lower()} - grid global NOAA terlalu kasar untuk perairan "
        'yang sangat dekat pantai.'
    ) if baris and kosong else ''
    suhu = stat.get('SUHU') or {}
    return {
        **_bagian(
            kunci='oseanografi',
            judul='Kondisi Oseanografi',
            ukuran='tabel',
            sumber='; '.join(dict.fromkeys(b['sumber'] for b in baris)) or 'NOAA ERDDAP',
            diperiksa=len(stat),
            baris=baris,
            sorotan=({'nilai': f"{_desimal(suhu['rata2'], 1)} {suhu['satuan']}", 'label': 'suhu permukaan rata-rata'}
                     if suhu.get('rata2') is not None else None),
            ringkas=ringkas,
            catatan_kosong=(
                'Data oseanografi belum tersedia untuk area ini. Jalankan manage.py tarik_oseanografi '
                'untuk menarik suhu permukaan, klorofil-a, dan gelombang dari NOAA.'
            ),
        ),
        'kolom': ['Parameter', 'Rata-rata', 'Rentang', 'Keterangan'],
    }


def bagian_karbon_biru(geom) -> Dict[str, Any]:
    from django.db import connection

    sql = """
        SELECT s.jenis, s.sumber_data, SUM(ST_Area(ST_Intersection(ST_MakeValid(s.geometry), t.g)::geography)) / 10000,
               MIN(s.tahun_data), MAX(s.tahun_data)
        FROM inventarisasi_sumber_daya_alam s
        CROSS JOIN (SELECT ST_GeomFromEWKT(%s) AS g) t
        WHERE s.geometry && t.g AND ST_Intersects(s.geometry, t.g) AND (
            (s.sumber_data = %s AND s.jenis = 'MANGROVE')
            OR (s.sumber_data = %s AND s.tahun_data = %s)
            OR s.sumber_data = %s
        )
        GROUP BY 1, 2
    """
    with connection.cursor() as c:
        c.execute(sql, [geom.ewkt, SUMBER_EKOSISTEM_UTAMA, SUMBER_MANGROVE_GMW, GMW_TAHUN_AKHIR, SUMBER_LAMUN])
        baris_sql = c.fetchall()
    luas = {(jenis, sumber): float(ha or 0) for jenis, sumber, ha, _, _ in baris_sql}
    tahun = {(jenis, sumber): '-'.join(dict.fromkeys(str(t) for t in (awal, akhir) if t)) for jenis, sumber, _, awal, akhir in baris_sql}
    mangrove = luas.get(('MANGROVE', SUMBER_EKOSISTEM_UTAMA)) or luas.get(('MANGROVE', SUMBER_MANGROVE_GMW)) or 0
    sumber_mangrove = (
        f"KKP {tahun[('MANGROVE', SUMBER_EKOSISTEM_UTAMA)]}".strip() if luas.get(('MANGROVE', SUMBER_EKOSISTEM_UTAMA))
        else f'Global Mangrove Watch {GMW_TAHUN_AKHIR}'
    )
    ekosistem = [('MANGROVE', 'Mangrove', mangrove, sumber_mangrove), ('LAMUN', 'Padang lamun', luas.get(('LAMUN', SUMBER_LAMUN), 0), 'Sidako KKP 2025')]
    baris, total_c = [], 0.0
    for kode, label, ha, sumber in ekosistem:
        if ha < 0.01:
            continue
        stok, rujukan = STOK_KARBON_BIRU[kode]
        c_ton = ha * stok
        total_c += c_ton
        baris.append({'sel': [label, _desimal(ha, 2), _desimal(stok, 1), _desimal(c_ton, 0),
                              _desimal(c_ton * FAKTOR_KARBON_KE_CO2, 0)],
                      'sumber': f'sebaran {sumber}; stok karbon {rujukan}'})
    co2 = total_c * FAKTOR_KARBON_KE_CO2
    return {
        **_bagian(
            kunci='karbon_biru',
            judul='Karbon Biru',
            ukuran='tabel',
            sumber='; '.join(b['sumber'] for b in baris) or 'KKP, Global Mangrove Watch, Sidako KKP',
            diperiksa=len(ekosistem),
            baris=baris,
            sorotan={'nilai': f'{_desimal(co2, 0)} t', 'label': 'setara CO2 tersimpan'} if baris else None,
            ringkas=(
                f'Area memuat ekosistem karbon biru dengan stok sekitar {_desimal(total_c, 0)} ton karbon '
                f'(setara {_desimal(co2, 0)} ton CO2). Konversi atau kerusakan ekosistem ini melepaskan sebagian besar '
                'stok tersebut, sehingga rencana kegiatan perlu menghindari, meminimalkan, atau memulihkannya.'
            ) if baris else '',
            catatan_kosong='Tidak ada mangrove maupun padang lamun terdata di dalam area ini.',
        ),
        'kolom': ['Ekosistem', 'Luas di area (ha)', 'Stok karbon (tC/ha)', 'Stok karbon (tC)', 'Setara CO2 (t)'],
    }


def _ribuan(n) -> str:
    return f'{n:,.0f}'.replace(',', '.')


def _pasang_batas_waktu() -> None:
    from django.db import connection

    if not transaction.get_connection().in_atomic_block:
        return
    try:
        with connection.cursor() as c:
            c.execute(f'SET LOCAL statement_timeout = {BATAS_WAKTU_SQL_MS}')
    except Exception as e:
        logger.warning(f'[LAPORAN] Batas waktu SQL tidak dapat dipasang: {e}')


def bangun_laporan(geometry: Dict[str, Any]) -> Dict[str, Any]:
    import json

    try:
        raw = geometry.get('geometry', geometry) if isinstance(geometry, dict) else geometry
        geom = GEOSGeometry(json.dumps(raw), srid=4326)
    except Exception as e:
        logger.error(f'[LAPORAN] Geometry tidak dapat diproses: {e}')
        return {'galat': 'Geometry tidak dapat diproses.', 'area': None, 'bagian': []}

    if geom.num_coords > SIMPUL_AOI_MAKS:
        return {
            'galat': (
                f'Area terlalu rumit: {_ribuan(geom.num_coords)} simpul, batasnya '
                f'{_ribuan(SIMPUL_AOI_MAKS)}. Sederhanakan poligonnya lebih dulu.'
            ),
            'area': None,
            'bagian': [],
        }

    try:
        area = _fakta_area(geom)
    except Exception as e:
        logger.error(f'[LAPORAN] Gagal menghitung fakta area: {e}')
        return {'galat': 'Luas area tidak dapat dihitung.', 'area': None, 'bagian': []}

    if area['luas_m2'] / 1e6 > LUAS_AOI_MAKS_KM2:
        return {
            'galat': (
                f'Area terlalu luas: {_ribuan(area["luas_m2"] / 1e6)} km², batasnya '
                f'{_ribuan(LUAS_AOI_MAKS_KM2)} km². Laporan ini dirancang untuk satu '
                f'area proyek, bukan untuk seluruh wilayah perairan sekaligus.'
            ),
            'area': area,
            'bagian': [],
        }

    luas = area['luas_m2']

    _pasang_batas_waktu()

    penyusun = [
        ('wilayah', lambda: _bagian_wilayah(geom, luas)),
        ('tata_ruang', lambda: _bagian_tata_ruang(geom, luas)),
        ('kkprl', lambda: _bagian_kkprl(geom, luas)),
        ('bencana', lambda: bagian_bencana(geom)),
        ('unsur', lambda: _bagian_unsur(geom)),
        ('infrastruktur', lambda: _bagian_infrastruktur(geom)),
        ('oseanografi', lambda: bagian_oseanografi(geom)),
        ('karbon_biru', lambda: bagian_karbon_biru(geom)),
    ]

    bagian = []
    bagian_gagal = []
    for kunci, fn in penyusun:
        try:
            with transaction.atomic():
                bagian.append(fn())
        except Exception as e:
            logger.exception(f'[LAPORAN] Bagian {kunci} gagal: {e}')
            bagian_gagal.append(kunci)
            bagian.append(
                _bagian(
                    kunci=kunci,
                    judul=kunci.replace('_', ' ').title(),
                    ukuran='irisan',
                    sumber='—',
                    diperiksa=0,
                    baris=[],
                    catatan_kosong='Bagian ini gagal dihitung. Angka pada bagian lain tetap sahih.',
                )
            )

    risiko_ruang = {}
    try:
        from analitik.services.skor_spasial import ambil_risiko_ruang

        risiko_ruang = ambil_risiko_ruang(geometry)
    except Exception as e:
        logger.exception(f'[LAPORAN] Risiko lingkungan & sosial gagal: {e}')

    return {'area': area, 'bagian': bagian, 'risiko_ruang': risiko_ruang, 'bagian_gagal': bagian_gagal}
