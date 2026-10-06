import json
from datetime import date

from django.db import connection
from django.db.models import Count, Q, Sum
from django.utils import timezone

from analitik.models import KetentuanRuang, SkorKelayakanZona
from analitik.services.konstanta import LABEL_SUMBER_ZONASI, PRIORITAS_SUMBER_ZONASI
from analitik.services.oseanografi import statistik as statistik_oseanografi
from inti.models import KabupatenKota, Provinsi, SektorInvestasi
from inventarisasi.models import RegulasiTataRuang, ZonasiRuangLaut
from penarikan_data.models import ProduksiPerikananBPS

LABEL_SUB_ZONA = dict(ZonasiRuangLaut.SUB_ZONA_CHOICES)
LABEL_KELOMPOK = dict(ProduksiPerikananBPS.KELOMPOK_CHOICES)
SEKTOR_KELOMPOK = {'BUDIDAYA': 'PERIKANAN_BUDIDAYA', 'TANGKAP_LAUT': 'PERIKANAN_TANGKAP'}
KOMODITAS_LAUT = {'BUDIDAYA': {'Rumput Laut', 'Kerapu', 'Kakap'}, 'TANGKAP_LAUT': {'Tuna', 'Cakalang', 'Tongkol', 'Udang'}}
BATAS_ZONA_PETA = 600
BATAS_ZONA_PETA_SEKTOR = 120
JUMLAH_LOKASI_PRIORITAS = 6
JUMLAH_UNGGULAN = 4
JUMLAH_JENIS_UNGGULAN = 3
JUMLAH_KEAHLIAN = 8


def _toleransi(cakupan):
    x0, y0, x1, y1 = cakupan
    return max(x1 - x0, y1 - y0) / 1500.0


def _geojson(teks):
    return json.loads(teks) if teks else None


def _sumber_utama_semua():
    ada = {}
    for prov_id, sumber in (
        ZonasiRuangLaut.objects.filter(tingkat_acuan='RTRW_PROVINSI')
        .values_list('provinsi_id', 'sumber_data').distinct()
    ):
        ada.setdefault(prov_id, set()).add(sumber)
    urutan = {s: i for i, s in enumerate(PRIORITAS_SUMBER_ZONASI)}
    return {
        prov_id: min(sumber, key=lambda s: (urutan.get(s, len(urutan)), s))
        for prov_id, sumber in ada.items()
    }


def _sumber_utama(provinsi):
    return _sumber_utama_semua().get(provinsi.id)


def _wilayah(c, provinsi):
    c.execute(
        'SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(COALESCE(geometry_tampilan, geometry), %s), 5), '
        'ST_XMin(g), ST_YMin(g), ST_XMax(g), ST_YMax(g) '
        'FROM (SELECT *, COALESCE(geometry_tampilan, geometry) AS g FROM inti_provinsi WHERE id = %s) p',
        [0.002, provinsi.id],
    )
    batas, x0, y0, x1, y1 = c.fetchone()
    kab = KabupatenKota.objects.filter(provinsi=provinsi)
    ringkas = kab.aggregate(
        pesisir=Count('id', filter=Q(pesisir=True)),
        penduduk=Sum('jumlah_penduduk'),
        nelayan=Sum('jumlah_nelayan'),
        dtks=Sum('penduduk_dtks'),
    )
    return {
        'id': provinsi.id,
        'nama': provinsi.nama,
        'kode_bps': provinsi.kode_bps,
        'luas_laut_km2': provinsi.luas_laut_km2,
        'jumlah_kabkota': kab.count(),
        'jumlah_kabkota_pesisir': ringkas['pesisir'] or 0,
        'penduduk': ringkas['penduduk'] or 0,
        'nelayan': ringkas['nelayan'] or 0,
        'penduduk_dtks': ringkas['dtks'] or 0,
        'cakupan': [x0, y0, x1, y1] if x0 is not None else None,
        'batas': _geojson(batas),
    }


def _kabupaten(provinsi):
    return [
        {
            'nama': k.nama,
            'pesisir': k.pesisir,
            'penduduk': k.jumlah_penduduk,
            'nelayan': k.jumlah_nelayan,
            'rtp_tangkap': k.jumlah_rtp_tangkap,
            'rasio_dtks': round(k.penduduk_dtks / k.jumlah_penduduk * 100, 1)
            if k.penduduk_dtks and k.jumlah_penduduk else None,
            'tahun': k.tahun_data_sosial,
        }
        for k in KabupatenKota.objects.filter(provinsi=provinsi).order_by('-jumlah_nelayan', 'nama')
    ]


def _zona(c, provinsi, sumber, tol, sektor=None):
    if not sumber:
        return {'sumber_label': None, 'label_data': None, 'regulasi': None, 'baris': [], 'total_ha': 0, 'peta': []}
    qs = ZonasiRuangLaut.objects.filter(provinsi=provinsi, sumber_data=sumber, tingkat_acuan='RTRW_PROVINSI')
    if sektor:
        qs = qs.filter(id__in=skor_sesuai(sektor, provinsi).values('zona_id'))
    baris = list(qs.values('sub_zona').annotate(luas=Sum('luas_ha'), n=Count('id')).order_by('-luas'))
    total = sum(b['luas'] or 0 for b in baris)
    ids = list(qs.order_by('-luas_ha').values_list('id', flat=True)[:BATAS_ZONA_PETA])
    c.execute(
        'SELECT sub_zona, ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, %s), 4) '
        'FROM inventarisasi_zonasi_ruang_laut WHERE id = ANY(%s)',
        [tol, ids],
    )
    regulasi = RegulasiTataRuang.objects.filter(provinsi=provinsi, sumber_data=sumber).first()
    label_data = (
        ZonasiRuangLaut.objects.filter(provinsi=provinsi, sumber_data=sumber).exclude(nomor_regulasi='')
        .values('nomor_regulasi').annotate(n=Count('id')).order_by('-n')
        .values_list('nomor_regulasi', flat=True).first()
    )
    return {
        'sumber_label': LABEL_SUMBER_ZONASI.get(sumber, sumber),
        'label_data': label_data,
        'regulasi': regulasi and {'judul': regulasi.judul, 'tentang': regulasi.tentang, 'tautan': regulasi.tautan},
        'total_ha': total,
        'baris': [
            {
                'sub_zona': b['sub_zona'],
                'label': LABEL_SUB_ZONA.get(b['sub_zona'], b['sub_zona']),
                'luas_ha': b['luas'] or 0,
                'persen': round((b['luas'] or 0) / total * 100, 1) if total else 0,
                'jumlah': b['n'],
            }
            for b in baris
        ],
        'peta': [{'sub_zona': s, 'geometry': _geojson(g)} for s, g in c.fetchall() if g],
    }


def _kabupaten_terdekat(c, provinsi_id, x, y):
    c.execute(
        'SELECT nama FROM inti_kabupaten_kota WHERE provinsi_id = %s AND geometry IS NOT NULL '
        'ORDER BY geometry <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326) LIMIT 1',
        [provinsi_id, x, y],
    )
    r = c.fetchone()
    return r[0] if r else ''


def _catatan_lokasi(s):
    unggul, batas = [], []
    if s['jarak_infra_km'] is not None:
        teks = f"infrastruktur terdekat {s['jarak_infra_km']:.1f} km"
        (unggul if s['aksesibilitas'] >= 0.6 else batas).append(
            f'Aksesibilitas baik ({teks})' if s['aksesibilitas'] >= 0.6 else f'Aksesibilitas terbatas ({teks})'
        )
    if s['potensi_sda'] >= 0.7:
        unggul.append('Potensi sumber daya tinggi')
    if s['risiko_bencana'] <= 0.3:
        unggul.append('Risiko bencana rendah')
    elif s['risiko_bencana'] >= 0.6:
        batas.append('Risiko bencana tinggi')
    if s['sensitivitas_ekosistem'] is not None and s['sensitivitas_ekosistem'] >= 0.5:
        batas.append(f"Beririsan dengan ekosistem sensitif ({s['ekosistem_rincian'] or 'ekosistem pesisir'})")
    if s['risiko_sosial'] >= 0.6:
        batas.append('Kerentanan sosial tinggi di wilayah sekitar')
    elif s['risiko_sosial'] <= 0.3:
        unggul.append('Kerentanan sosial rendah')
    if s['wilayah_adat']:
        batas.append('Berada di atau dekat wilayah masyarakat hukum adat')
    if s['jumlah_kkprl']:
        batas.append(f"Terdapat {s['jumlah_kkprl']} KKPRL terbit di dalam zona; lokasi investasi harus di luar area KKPRL")
    return unggul, batas


def _luas_jenis(provinsi):
    return {
        r['sektor__kode']: {
            'sesuai_ha': r['sesuai'] or 0,
            'tinggi_ha': r['tinggi'] or 0,
            'sedang_ha': r['sedang'] or 0,
            'jumlah_zona_tinggi': r['n_tinggi'] or 0,
        }
        for r in skor_sesuai(provinsi=provinsi).values('sektor__kode').annotate(
            sesuai=Sum('zona__luas_ha'),
            tinggi=Sum('zona__luas_ha', filter=Q(kelas='TINGGI')),
            sedang=Sum('zona__luas_ha', filter=Q(kelas='SEDANG')),
            n_tinggi=Count('id', filter=Q(kelas='TINGGI')),
        )
    }


PARAMETER_OSEANOGRAFI_LOKASI = ('KEDALAMAN', 'SUHU', 'GELOMBANG', 'KLOROFIL')
PARAMETER_OSEANOGRAFI_PROVINSI = ('SUHU', 'ANOMALI_SUHU', 'KLOROFIL', 'GELOMBANG')
JARAK_PERAIRAN_DERAJAT = 0.2
PENYEDERHANAAN_PANTAI_DERAJAT = 0.02


def _oseanografi(geom, parameter):
    hasil = {}
    for kode, s in statistik_oseanografi(geom, parameter).items():
        if s.get('rata2') is None:
            continue
        arah = -1 if kode == 'KEDALAMAN' else 1
        hasil[kode] = {
            'rata2': round(arah * s['rata2'], 2),
            'min': round(min(arah * s['min'], arah * s['max']), 2),
            'max': round(max(arah * s['min'], arah * s['max']), 2),
            'satuan': s['satuan'],
            'periode': s['periode'],
            'sumber': s['sumber'],
        }
    return hasil


def _oseanografi_provinsi(provinsi):
    geom = provinsi.geometry_tampilan or provinsi.geometry
    if not geom:
        return {}
    perairan = geom.simplify(PENYEDERHANAAN_PANTAI_DERAJAT).buffer(JARAK_PERAIRAN_DERAJAT)
    return _oseanografi(perairan, PARAMETER_OSEANOGRAFI_PROVINSI)


def _rinci_jenis(c, provinsi, sektor, tol, luas):
    from ketenagakerjaan.proyeksi import _matriks

    status = {}
    for k in KetentuanRuang.objects.filter(Q(provinsi__isnull=True) | Q(provinsi=provinsi), sektor=sektor):
        if k.provinsi_id or k.sub_zona not in status:
            status[k.sub_zona] = k.status

    skor = skor_sesuai(sektor, provinsi).filter(kelas__in=['TINGGI', 'SEDANG'])
    lokasi = []
    for s in skor.order_by('-kelas', '-zona__luas_ha', '-skor_total').values(
        'zona_id', 'zona__nama_zona', 'zona__sub_zona', 'zona__luas_ha', 'skor_total', 'kelas', 'jarak_infra_km',
        'potensi_sda', 'aksesibilitas', 'risiko_bencana', 'sensitivitas_ekosistem', 'ekosistem_rincian',
        'risiko_sosial', 'wilayah_adat', 'jumlah_kkprl',
    )[:JUMLAH_LOKASI_PRIORITAS]:
        c.execute(
            'SELECT ST_X(p), ST_Y(p) FROM (SELECT ST_PointOnSurface(geometry) p '
            'FROM inventarisasi_zonasi_ruang_laut WHERE id = %s) q',
            [s['zona_id']],
        )
        x, y = c.fetchone()
        unggul, batas = _catatan_lokasi(s)
        zona_geom = ZonasiRuangLaut.objects.only('geometry').get(pk=s['zona_id']).geometry
        lokasi.append({
            'nama': s['zona__nama_zona'],
            'sub_zona_label': LABEL_SUB_ZONA.get(s['zona__sub_zona'], s['zona__sub_zona']),
            'kabupaten': _kabupaten_terdekat(c, provinsi.id, x, y),
            'luas_ha': s['zona__luas_ha'] or 0,
            'skor': round(s['skor_total'], 3),
            'kelas': s['kelas'],
            'jarak_infra_km': s['jarak_infra_km'],
            'keunggulan': unggul,
            'pembatas': batas,
            'titik': [round(x, 5), round(y, 5)],
            'oseanografi': {k: v['rata2'] for k, v in _oseanografi(zona_geom, PARAMETER_OSEANOGRAFI_LOKASI).items()},
        })

    kelas_zona = dict(skor.order_by('-zona__luas_ha').values_list('zona_id', 'kelas')[:BATAS_ZONA_PETA_SEKTOR])
    c.execute(
        'SELECT id, ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, %s), 4) '
        'FROM inventarisasi_zonasi_ruang_laut WHERE id = ANY(%s)',
        [tol, list(kelas_zona)],
    )
    return {
        'kode': sektor.kode,
        'nama': sektor.nama,
        'deskripsi': sektor.deskripsi,
        'rasio_tk_per_miliar': sektor.rasio_tk_per_miliar,
        **luas.get(sektor.kode, {'sesuai_ha': 0, 'tinggi_ha': 0, 'sedang_ha': 0, 'jumlah_zona_tinggi': 0}),
        'sub_zona_diizinkan': sorted(LABEL_SUB_ZONA.get(s, s) for s, v in status.items() if v == 'DIIZINKAN'),
        'sub_zona_bersyarat': sorted(LABEL_SUB_ZONA.get(s, s) for s, v in status.items() if v == 'BERSYARAT'),
        'lokasi': lokasi,
        'peta': [{'kelas': kelas_zona[i], 'geometry': _geojson(g)} for i, g in c.fetchall() if g],
        'keahlian': _matriks(sektor.kode)[:JUMLAH_KEAHLIAN],
    }


def _harga(b):
    return b['nilai_ribu_rp'] / b['produksi_ton'] if b['nilai_ribu_rp'] and b['produksi_ton'] else None


def _juta(ribu):
    return None if ribu is None else ribu / 1000


def _baris_produksi():
    return ProduksiPerikananBPS.objects.filter(produksi_ton__gt=0).values(
        'provinsi_id', 'provinsi__nama', 'kelompok', 'komoditas', 'tahun', 'produksi_ton', 'nilai_ribu_rp',
    )


def _produksi_komoditas(provinsi, baris=None):
    per_komoditas = {}
    for b in _baris_produksi() if baris is None else baris:
        if b['komoditas'] in KOMODITAS_LAUT[b['kelompok']]:
            per_komoditas.setdefault((b['kelompok'], b['komoditas']), []).append(b)

    hasil = []
    for (kelompok, nama), daftar in per_komoditas.items():
        milik = sorted((b for b in daftar if b['provinsi_id'] == provinsi.id), key=lambda b: b['tahun'])
        if not milik:
            continue
        awal, akhir = milik[0], milik[-1]
        setahun = sorted((b for b in daftar if b['tahun'] == akhir['tahun']), key=lambda b: -b['produksi_ton'])
        total_ton = sum(b['produksi_ton'] for b in setahun)
        bernilai = [b for b in setahun if b['nilai_ribu_rp']]
        rentang = akhir['tahun'] - awal['tahun']
        hasil.append({
            'kode': f'{kelompok}:{nama}',
            'nama': nama,
            'kelompok': kelompok,
            'kelompok_label': LABEL_KELOMPOK[kelompok],
            'sektor': SEKTOR_KELOMPOK[kelompok],
            'tahun': akhir['tahun'],
            'produksi_ton': akhir['produksi_ton'],
            'nilai_juta_rp': _juta(akhir['nilai_ribu_rp']),
            'harga_rp_kg': _harga(akhir),
            'harga_nasional_rp_kg': sum(b['nilai_ribu_rp'] for b in bernilai) / sum(b['produksi_ton'] for b in bernilai)
            if bernilai else None,
            'pangsa_nasional_persen': akhir['produksi_ton'] / total_ton * 100,
            'peringkat_nasional': next(i for i, b in enumerate(setahun, 1) if b['provinsi_id'] == provinsi.id),
            'jumlah_provinsi': len(setahun),
            'pertumbuhan_persen': ((akhir['produksi_ton'] / awal['produksi_ton']) ** (1 / rentang) - 1) * 100
            if rentang else None,
            'tahun_awal': awal['tahun'],
            'seri': [
                {'tahun': b['tahun'], 'produksi_ton': b['produksi_ton'],
                 'nilai_juta_rp': _juta(b['nilai_ribu_rp']), 'harga_rp_kg': _harga(b)}
                for b in milik
            ],
            'provinsi_teratas': [
                {'provinsi': b['provinsi__nama'], 'produksi_ton': b['produksi_ton'],
                 'pangsa_persen': b['produksi_ton'] / total_ton * 100}
                for b in setahun[:5]
            ],
        })
    return hasil


def peringkat_unggulan(komoditas, luas_sektor):
    maks_nilai = max((k['nilai_juta_rp'] or 0 for k in komoditas), default=0) or 1
    maks_luas = max((luas_sektor.get(k['sektor'], 0) for k in komoditas), default=0) or 1
    for k in komoditas:
        k['luas_sesuai_ha'] = luas_sektor.get(k['sektor'], 0)
        k['skor_unggulan'] = round(0.5 * (k['nilai_juta_rp'] or 0) / maks_nilai + 0.5 * k['luas_sesuai_ha'] / maks_luas, 3)
    komoditas.sort(key=lambda k: -k['skor_unggulan'])
    for i, k in enumerate(komoditas):
        k['unggulan'] = i < JUMLAH_UNGGULAN
    return komoditas


def komoditas_unggulan_semua():
    baris = list(_baris_produksi())
    luas = {}
    for r in skor_sesuai().values('zona__provinsi_id', 'sektor__kode').annotate(sesuai=Sum('zona__luas_ha')):
        luas.setdefault(r['zona__provinsi_id'], {})[r['sektor__kode']] = r['sesuai'] or 0
    hasil = {}
    for provinsi in Provinsi.objects.filter(id__in={b['provinsi_id'] for b in baris}).only('id'):
        komoditas = peringkat_unggulan(_produksi_komoditas(provinsi, baris), luas.get(provinsi.id, {}))
        hasil[provinsi.id] = [
            {
                'nama': k['nama'],
                'kelompok_label': k['kelompok_label'],
                'tahun': k['tahun'],
                'produksi_ton': k['produksi_ton'],
                'peringkat_nasional': k['peringkat_nasional'],
            }
            for k in komoditas if k['unggulan']
        ]
    return hasil


def _ketenagakerjaan(provinsi):
    from penarikan_data.bps import statistik_ketenagakerjaan

    try:
        return statistik_ketenagakerjaan(provinsi.kode_bps, date.today().year)
    except Exception:
        return None


def profil_provinsi(provinsi, sektor=None):
    luas = _luas_jenis(provinsi)
    komoditas = peringkat_unggulan(
        _produksi_komoditas(provinsi), {kode: v['sesuai_ha'] for kode, v in luas.items()}
    )
    berkomoditas = {k['sektor'] for k in komoditas}
    aktif = {s.kode: s for s in SektorInvestasi.objects.filter(aktif=True).order_by('urutan', 'nama')}
    jenis_lain = sorted(
        (s for s in aktif.values() if s.kode not in berkomoditas and luas.get(s.kode, {}).get('tinggi_ha')),
        key=lambda s: -luas[s.kode]['tinggi_ha'],
    )
    if sektor is None:
        bab = [k for k in komoditas if k['unggulan']] + [{'kode': s.kode, 'nama': s.nama, 'sektor': s.kode}
                                                          for s in jenis_lain[:JUMLAH_JENIS_UNGGULAN]]
    elif sektor.kode in berkomoditas:
        bab = [k for k in komoditas if k['sektor'] == sektor.kode][:JUMLAH_UNGGULAN]
    else:
        bab = [{'kode': sektor.kode, 'nama': sektor.nama, 'sektor': sektor.kode}]
    sektor_bab = {aktif.get(b['sektor']) or sektor for b in bab}

    with connection.cursor() as c:
        wilayah = _wilayah(c, provinsi)
        tol = _toleransi(wilayah['cakupan']) if wilayah['cakupan'] else 0.003
        jenis = {s.kode: _rinci_jenis(c, provinsi, s, tol, luas) for s in sektor_bab}
        zona = _zona(c, provinsi, _sumber_utama(provinsi), tol, sektor)

    return {
        'wilayah': wilayah,
        'jenis_dipilih': sektor and {'kode': sektor.kode, 'nama': sektor.nama},
        'zona': zona,
        'oseanografi': _oseanografi_provinsi(provinsi),
        'komoditas': komoditas,
        'jenis_lain': [{'kode': s.kode, 'nama': s.nama, **luas[s.kode]} for s in jenis_lain],
        'bab': [{'kode': b['kode'], 'nama': b['nama'], 'sektor': b['sektor'],
                 'komoditas': 'kelompok' in b} for b in bab],
        'jenis': jenis,
        'sosial': {
            'kabupaten': [k for k in _kabupaten(provinsi) if k['pesisir']],
            'ketenagakerjaan': _ketenagakerjaan(provinsi),
        },
        'disusun': timezone.now().isoformat(),
    }


def _saring_sumber_utama(qs, prefiks='zona__'):
    kondisi = Q(pk__in=[])
    for prov_id, sumber in _sumber_utama_semua().items():
        kondisi |= Q(**{f'{prefiks}provinsi_id': prov_id, f'{prefiks}sumber_data': sumber})
    return qs.filter(kondisi, **{f'{prefiks}tingkat_acuan': 'RTRW_PROVINSI'})


def skor_sesuai(sektor=None, provinsi=None):
    qs = SkorKelayakanZona.objects.filter(kesesuaian_tr=True)
    skor = _saring_sumber_utama(qs.filter(sektor=sektor) if sektor else qs)
    return skor.filter(zona__provinsi=provinsi) if provinsi else skor
