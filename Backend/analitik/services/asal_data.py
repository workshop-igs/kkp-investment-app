import re

from django.core.cache import cache
from django.db.models import Max, Min
from django.utils import timezone

from analitik.models import RasterOseanografi, ZonaRisikoBencana
from analitik.services.konstanta import BULAN, LABEL_SUMBER_ZONASI
from analitik.services.pengaturan import atur
from inventarisasi.models import (
    KKPRL,
    InfrastrukturPendukung,
    IzinTambang,
    SumberDayaAlam,
    UnsurRuangLaut,
    ZonasiRuangLaut,
)
from penarikan_data.models import ProduksiPerikananBPS, StatistikKetenagakerjaanBPS

LABEL_OSEANOGRAFI = {
    'KEDALAMAN': 'Kedalaman perairan',
    'GELOMBANG': 'Tinggi gelombang',
    'SUHU': 'Suhu permukaan laut',
    'ANOMALI_SUHU': 'Anomali suhu permukaan laut',
    'KLOROFIL': 'Klorofil-a',
    'KD490': 'Kekeruhan perairan (Kd490)',
    'PERIODE_GLB': 'Periode puncak gelombang',
    'CURAH_HUJAN': 'Curah hujan bulanan',
    'BULAN_KERING': 'Bulan kering berturut-turut',
    'ARUS': 'Kecepatan arus permukaan',
    'ARUS_DASAR': 'Kecepatan arus dasar',
    'SALINITAS': 'Salinitas permukaan laut',
    'TSS': 'Padatan tersuspensi (TSS)',
    'KEMIRINGAN': 'Kemiringan lahan',
    'KEMIRINGAN_DASAR': 'Kemiringan dasar laut',
    'PASUT': 'Tunggang pasang surut',
    'PGA': 'Percepatan tanah puncak gempa (PGA)',
    'GELOMBANG_EKSTREM': 'Gelombang ekstrem periode ulang 50 tahun',
    'ANGIN_100M': 'Kecepatan angin 100 m',
    'GHI': 'Iradiasi surya global (GHI)',
    'BEDA_SUHU_1000M': 'Beda suhu permukaan dan kedalaman 1.000 m',
    'TANAH_LIAT': 'Kandungan tanah liat',
    'SHANNON': 'Indeks keanekaragaman hayati Shannon-Wiener',
    'ABRASI_PANTAI': 'Laju abrasi garis pantai',
    'EKS_MANGROVE': 'Eks-mangrove 1996-2020',
    'LUAS_EKS_MANGROVE': 'Luas hamparan eks-mangrove',
    'PRODUKSI_KABUPATEN': 'Perkiraan produksi ikan kabupaten/kota',
    'TANGKAP_SIANG': 'Aktivitas penangkapan ikan siang hari',
    'TANGKAP_MALAM': 'Aktivitas penangkapan ikan malam hari',
}

OSEANOGRAFI_DINAMIS = {
    'SUHU', 'ANOMALI_SUHU', 'KLOROFIL', 'GELOMBANG', 'PERIODE_GLB', 'KD490', 'ARUS', 'ARUS_DASAR', 'SALINITAS', 'TSS',
}
AKTIVITAS_TANGKAP = {'TANGKAP_SIANG', 'TANGKAP_MALAM'}

KELOMPOK_DATA = {
    'tata_ruang': ('Tata ruang (RTRW Provinsi, PKKPRL, RZWP-3-K)', 'Portal Satu Data KKP dan folder data KKP'),
    'kkprl': ('Izin KKPRL terbit', 'Portal Satu Data KKP'),
    'izin_tambang': ('Izin usaha pertambangan (IUP/IUPK) 5 tahun terakhir', 'Geoportal ESDM (Ditjen Minerba)'),
    'infrastruktur': ('Infrastruktur pendukung', 'Portal Satu Data KKP dan OpenStreetMap'),
    'oseanografi': ('Oseanografi (suhu, klorofil, gelombang, arus, salinitas)', 'NOAA, NASA, HYCOM'),
    'aktivitas_tangkap': ('Aktivitas penangkapan ikan kapal berpelacak AIS', 'Global Fishing Watch'),
    'kondisi_tetap': ('Kondisi fisik dan iklim jangka panjang', 'SRTM15+, EOT20, CHIRPS, GEM, Global Wind Atlas, dan lainnya'),
    'ekosistem': ('Ekosistem pesisir', 'Sidako KKP dan Global Mangrove Watch'),
    'bencana': ('Risiko bencana', 'BNPB InaRISK'),
    'adat': ('Wilayah kelola masyarakat hukum adat', 'Portal Satu Data KKP dan Sidako KKP'),
    'bps_produksi': ('Produksi perikanan', 'BPS'),
    'bps_kerja': ('Ketenagakerjaan', 'BPS'),
}

SUMBER_SKALA_KASAR = {
    LABEL_SUMBER_ZONASI['KKP-RZWP3K'],
    LABEL_SUMBER_ZONASI['KKP-RTRW'],
    LABEL_SUMBER_ZONASI['KKP-WFS'],
}

CATATAN_DASAR = (
    'Hasil ini adalah penyaringan awal berbasis data spasial, bukan pengganti Persetujuan KKPRL. Kesesuaian '
    'akhir ditetapkan KKP melalui penilaian dokumen permohonan dan verifikasi lapangan.'
)


def tahun_teks(teks):
    tahun = [int(t) for t in re.findall(r'(?<!\d)(?:19|20)\d{2}(?!\d)', teks or '')]
    return max(tahun) if tahun else None


def kelompok_raster(kode):
    if kode in AKTIVITAS_TANGKAP:
        return 'aktivitas_tangkap'
    return 'oseanografi' if kode in OSEANOGRAFI_DINAMIS else 'kondisi_tetap'


def lewat_masa(kelompok, tahun=None, waktu=None):
    batas = atur('MASA_BERLAKU_DATA').get(kelompok) or 0
    hari_ini = timezone.localdate()
    if waktu:
        umur = (hari_ini - timezone.localtime(waktu).date()).days / 365.25
    elif tahun:
        umur = hari_ini.year - tahun
    else:
        return None
    return batas if batas and umur > batas else None


def _bulan(t):
    return f'{BULAN[t.month - 1]} {t.year}' if t else None


def _tanggal(t):
    return f'{t.day} {BULAN[t.month - 1]} {t.year}' if t else None


def _terbaru():
    hasil = cache.get('asal-data:terbaru')
    if hasil is not None:
        return hasil
    hasil = {
        'kkprl': KKPRL.objects.aggregate(t=Max('updated_at'))['t'],
        'izin_tambang': IzinTambang.objects.aggregate(t=Max('updated_at'))['t'],
        'ekosistem': SumberDayaAlam.objects.aggregate(t=Max('updated_at'))['t'],
        'bencana': ZonaRisikoBencana.objects.aggregate(t=Max('dibuat_pada'))['t'],
        'infrastruktur': InfrastrukturPendukung.objects.aggregate(t=Max('updated_at'))['t'],
        'adat': UnsurRuangLaut.objects.filter(kelompok='MHA').aggregate(t=Max('updated_at'))['t'],
        'oseanografi': {
            r['parameter']: r['t']
            for r in RasterOseanografi.objects.values('parameter').annotate(t=Max('ditarik_pada'))
        },
    }
    cache.set('asal-data:terbaru', hasil, 600)
    return hasil


def _baris(data, sumber, keterangan='', kedaluwarsa=None):
    return {'data': data, 'sumber': sumber, 'keterangan': keterangan, 'kedaluwarsa': kedaluwarsa}


def asal_data(zona, karakter, tambahan):
    terbaru = _terbaru()
    baris = []

    acuan = {}
    for z in zona:
        kunci = (z['sumber_label'], z.get('regulasi') or '', z['provinsi'])
        acuan.setdefault(kunci, z)
    for (sumber, regulasi, provinsi), z in acuan.items():
        rincian = [regulasi or 'nomor regulasi tidak tercantum']
        if z.get('tahun_penetapan'):
            rincian.append(f"ditetapkan {z['tahun_penetapan']}")
        if z.get('diperbarui'):
            rincian.append(f"data per {z['diperbarui']}")
        baris.append(_baris(f'Tata ruang — {provinsi}', sumber, '; '.join(rincian),
                            lewat_masa('tata_ruang', tahun=z.get('tahun_penetapan'))))
    if not zona:
        baris.append(_baris('Tata ruang', 'Tidak ada acuan tata ruang yang mencakup area ini', ''))

    baris.append(_baris(
        'Izin KKPRL terbit', 'Portal Satu Data KKP',
        f"ditarik {_tanggal(terbaru['kkprl'])}; permohonan yang masih diproses tidak terlihat" if terbaru['kkprl']
        else 'belum pernah ditarik',
        lewat_masa('kkprl', waktu=terbaru['kkprl']),
    ))

    for kode, info in (karakter.get('oseanografi') or {}).items():
        rincian = [info.get('periode') or '']
        if terbaru['oseanografi'].get(kode):
            rincian.append(f"ditarik {_tanggal(terbaru['oseanografi'][kode])}")
        tahun = tahun_teks(info.get('periode')) or tahun_teks(info.get('sumber'))
        baris.append(_baris(LABEL_OSEANOGRAFI.get(kode, kode), info.get('sumber') or '-',
                            '; '.join(filter(None, rincian)), lewat_masa(kelompok_raster(kode), tahun=tahun)))

    for kunci, data, sumber in (
        ('ekosistem', 'Ekosistem pesisir (mangrove, lamun, terumbu karang)',
         'Portal Satu Data KKP, Sidako Ekosistem KKP, Global Mangrove Watch'),
        ('bencana', 'Risiko bencana (tsunami, abrasi, banjir)', 'BNPB InaRISK'),
        ('infrastruktur', 'Infrastruktur pendukung', 'Portal Satu Data KKP'),
        ('adat', 'Wilayah kelola masyarakat hukum adat', 'Portal Satu Data KKP, Sidako KKP'),
    ):
        baris.append(_baris(data, sumber, f'data per {_bulan(terbaru[kunci])}' if terbaru[kunci] else 'belum tersedia',
                            lewat_masa(kunci, waktu=terbaru[kunci])))
    for t in tambahan or ():
        baris.append(_baris(t['nama'], t.get('sumber') or 'Ditetapkan administrator', t.get('peran_label') or ''))
    return baris


def kelengkapan(sub):
    if not sub:
        return None
    tidak_terukur = [k['label'] for k in sub['kriteria'] if k['lulus'] is None]
    belum_ada = [k['label'][0].lower() + k['label'][1:] for k in sub['kriteria'] if not k['data_ada']]
    alasan = []
    if not sub['cukup_data']:
        alasan.append(f"baru {sub['terukur']} dari {sub['total']} kriteria {sub['nama']} yang terukur di lokasi ini")
    if belum_ada:
        alasan.append('data belum tersedia di aplikasi: ' + ', '.join(belum_ada))
    return {
        'terukur': sub['terukur'],
        'total': sub['total'],
        'tidak_terukur': tidak_terukur,
        'dasar_tidak_terukur': [],
        'indikatif': bool(alasan),
        'alasan_indikatif': alasan,
    }


def catatan_skala(zona, karakter):
    catatan = [CATATAN_DASAR]
    kasar = sorted({z['sumber_label'] for z in zona} & SUMBER_SKALA_KASAR)
    if kasar:
        catatan.append(
            f"Peta {', '.join(kasar)} berskala provinsi/nasional (umumnya 1:250.000): batas zonanya dapat bergeser "
            'puluhan hingga ratusan meter di lapangan, sehingga hanya cocok untuk penyaringan awal, bukan '
            'penentuan batas tapak.'
        )
    if karakter.get('oseanografi'):
        catatan.append(
            'Kedalaman, gelombang, dan suhu berasal dari grid global beresolusi kasar (sekitar 2–55 km per sel) '
            'sehingga bersifat indikatif; survei batimetri dan oseanografi lapangan tetap diperlukan.'
        )
    return catatan


def _rentang(a, b):
    return str(a) if a == b else f'{a}–{b}'


def _status(batas, lewat, total):
    if not batas:
        return 'TANPA_BATAS'
    if total == 0:
        return 'TIDAK_DIKETAHUI'
    return 'BERLAKU' if not lewat else 'LEWAT' if lewat == total else 'SEBAGIAN'


def ringkasan_sumber():
    from penarikan_data.models import KonfigurasiAPI, LogPenarikan
    from penarikan_data.tasks import JADWAL, jatuh_tempo

    masa = atur('MASA_BERLAKU_DATA')
    terbaru = _terbaru()
    hasil = {}

    zona = list(ZonasiRuangLaut.objects.filter(tahun_penetapan__isnull=False).values('provinsi')
                .annotate(t=Max('tahun_penetapan')).values_list('t', flat=True))
    lewat = [t for t in zona if lewat_masa('tata_ruang', tahun=t)]
    rentang = ZonasiRuangLaut.objects.aggregate(a=Min('tahun_penetapan'), b=Max('tahun_penetapan'))
    hasil['tata_ruang'] = (f"ditetapkan {_rentang(rentang['a'], rentang['b'])}" if rentang['a'] else 'tahun tidak tercantum',
                           _status(masa.get('tata_ruang'), len(lewat), len(zona)),
                           f'{len(lewat)} dari {len(zona)} provinsi melewati masa berlaku' if lewat else '')

    for kunci in ('kkprl', 'izin_tambang', 'infrastruktur', 'ekosistem', 'bencana', 'adat'):
        t = terbaru[kunci]
        hasil[kunci] = (f'data per {_tanggal(t)}' if t else 'belum tersedia',
                        _status(masa.get(kunci), int(bool(lewat_masa(kunci, waktu=t))), int(bool(t))), '')

    raster = {}
    for r in RasterOseanografi.objects.values('parameter', 'periode', 'sumber').order_by('parameter').distinct():
        t = tahun_teks(r['periode']) or tahun_teks(r['sumber'])
        if t:
            raster[r['parameter']] = max(raster.get(r['parameter'], t), t)
    for kunci in ('oseanografi', 'aktivitas_tangkap', 'kondisi_tetap'):
        tahun = {k: t for k, t in raster.items() if kelompok_raster(k) == kunci}
        lewat = [LABEL_OSEANOGRAFI.get(k, k) for k, t in tahun.items() if lewat_masa(kunci, tahun=t)]
        hasil[kunci] = (f'tahun data {_rentang(min(tahun.values()), max(tahun.values()))}' if tahun else 'tahun tidak tercantum',
                        _status(masa.get(kunci), len(lewat), len(tahun)), ', '.join(lewat))

    kerja = max(filter(None, map(tahun_teks, StatistikKetenagakerjaanBPS.objects.values_list('tahun', flat=True)
                                 .distinct())), default=None)
    for kunci, tahun in (('bps_produksi', ProduksiPerikananBPS.objects.aggregate(t=Max('tahun'))['t']),
                         ('bps_kerja', kerja)):
        hasil[kunci] = (f'tahun {tahun}' if tahun else 'belum tersedia',
                        _status(masa.get(kunci), int(bool(lewat_masa(kunci, tahun=tahun))), int(bool(tahun))), '')

    konfigurasi = {c.kode: c for c in KonfigurasiAPI.objects.filter(kode__in=[j[0] for j in JADWAL])}
    log = {}
    for g in (LogPenarikan.objects.filter(api_config__kode__in=konfigurasi).select_related('api_config')
              .order_by('api_config__kode', '-started_at')):
        log.setdefault(g.api_config.kode, g)
    baris = []
    for kunci, (label, sumber) in KELOMPOK_DATA.items():
        data, status, catatan = hasil[kunci]
        jadwal = []
        for kode, kelompok, nama, _, _ in JADWAL:
            if kelompok != kunci:
                continue
            cfg, g = konfigurasi.get(kode), log.get(kode)
            jadwal.append({
                'nama': nama, 'terakhir': cfg and cfg.last_successful_fetch, 'berikutnya': cfg and jatuh_tempo(cfg),
                'gagal': (g.error_message[:300] or 'gagal') if g and g.result == 'FAILED' else '',
            })
        baris.append({'kode': kunci, 'label': label, 'sumber': sumber, 'data': data, 'status': status,
                      'catatan': catatan, 'jadwal': jadwal})
    return baris
