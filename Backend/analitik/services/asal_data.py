"""Asal data, kelengkapan parameter, dan catatan skala untuk setiap hasil screening/analisis.

Tujuannya agar pengguna tahu seberapa kuat dasar sebuah hasil: data apa yang dipakai beserta tanggalnya,
berapa parameter yang benar-benar terukur di lokasi, dan batas ketelitian peta acuannya.
"""
from django.core.cache import cache
from django.db.models import Max

from analitik.models import RasterOseanografi, ZonaRisikoBencana
from analitik.services.konstanta import AMBANG_KELENGKAPAN_DATA, BULAN, LABEL_SUMBER_ZONASI
from analitik.services.pengaturan import atur
from inventarisasi.models import KKPRL, InfrastrukturPendukung, SumberDayaAlam, UnsurRuangLaut

LABEL_OSEANOGRAFI = {
    'KEDALAMAN': 'Kedalaman perairan',
    'GELOMBANG': 'Tinggi gelombang',
    'SUHU': 'Suhu permukaan laut',
    'ANOMALI_SUHU': 'Anomali suhu permukaan laut',
    'KLOROFIL': 'Klorofil-a',
    'KD490': 'Kekeruhan perairan (Kd490)',
    'PERIODE_GLB': 'Periode puncak gelombang',
    'CURAH_HUJAN': 'Curah hujan bulanan',
    'BULAN_KERING': 'Jumlah bulan kering',
}

# Peta tata ruang berskala provinsi/nasional: ketelitian posisinya kasar untuk keputusan tapak.
SUMBER_SKALA_KASAR = {
    LABEL_SUMBER_ZONASI['KKP-RZWP3K'],
    LABEL_SUMBER_ZONASI['KKP-RTRW'],
    LABEL_SUMBER_ZONASI['KKP-WFS'],
}

CATATAN_DASAR = (
    'Hasil ini adalah penyaringan awal berbasis data spasial, bukan pengganti Persetujuan KKPRL. Kesesuaian '
    'akhir ditetapkan KKP melalui penilaian dokumen permohonan dan verifikasi lapangan.'
)


def _bulan(t):
    return f'{BULAN[t.month - 1]} {t.year}' if t else None


def _tanggal(t):
    return f'{t.day} {BULAN[t.month - 1]} {t.year}' if t else None


def _terbaru():
    """Tanggal pembaruan terakhir tiap set data di basis data (disimpan 10 menit)."""
    hasil = cache.get('asal-data:terbaru')
    if hasil is not None:
        return hasil
    hasil = {
        'kkprl': _tanggal(KKPRL.objects.aggregate(t=Max('updated_at'))['t']),
        'ekosistem': _bulan(SumberDayaAlam.objects.aggregate(t=Max('updated_at'))['t']),
        'bencana': _bulan(ZonaRisikoBencana.objects.aggregate(t=Max('dibuat_pada'))['t']),
        'infrastruktur': _bulan(InfrastrukturPendukung.objects.aggregate(t=Max('updated_at'))['t']),
        'adat': _bulan(UnsurRuangLaut.objects.filter(kelompok='MHA').aggregate(t=Max('updated_at'))['t']),
        'oseanografi': {
            r['parameter']: _tanggal(r['t'])
            for r in RasterOseanografi.objects.values('parameter').annotate(t=Max('ditarik_pada'))
        },
    }
    cache.set('asal-data:terbaru', hasil, 600)
    return hasil


def _baris(data, sumber, keterangan=''):
    return {'data': data, 'sumber': sumber, 'keterangan': keterangan}


def asal_data(zona, karakter, tambahan):
    """Daftar set data yang dipakai screening ini, dengan sumber dan tanggalnya."""
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
        baris.append(_baris(f'Tata ruang — {provinsi}', sumber, '; '.join(rincian)))
    if not zona:
        baris.append(_baris('Tata ruang', 'Tidak ada acuan tata ruang yang mencakup area ini', ''))

    baris.append(_baris(
        'Izin KKPRL terbit', 'Portal Satu Data KKP',
        f"ditarik {terbaru['kkprl']}; permohonan yang masih diproses tidak terlihat" if terbaru['kkprl']
        else 'belum pernah ditarik',
    ))

    for kode, info in (karakter.get('oseanografi') or {}).items():
        rincian = [info.get('periode') or '']
        if terbaru['oseanografi'].get(kode):
            rincian.append(f"ditarik {terbaru['oseanografi'][kode]}")
        baris.append(_baris(LABEL_OSEANOGRAFI.get(kode, kode), info.get('sumber') or '-', '; '.join(filter(None, rincian))))

    baris.append(_baris(
        'Ekosistem pesisir (mangrove, lamun, terumbu karang)',
        'Portal Satu Data KKP, Sidako Ekosistem KKP, Global Mangrove Watch',
        f"data per {terbaru['ekosistem']}" if terbaru['ekosistem'] else 'belum tersedia',
    ))
    baris.append(_baris(
        'Risiko bencana (tsunami, abrasi, banjir)', 'BNPB InaRISK',
        f"data per {terbaru['bencana']}" if terbaru['bencana'] else 'belum tersedia',
    ))
    baris.append(_baris(
        'Infrastruktur pendukung', 'Portal Satu Data KKP',
        f"data per {terbaru['infrastruktur']}" if terbaru['infrastruktur'] else 'belum tersedia',
    ))
    baris.append(_baris(
        'Wilayah kelola masyarakat hukum adat', 'Portal Satu Data KKP, Sidako KKP',
        f"data per {terbaru['adat']}" if terbaru['adat'] else 'belum tersedia',
    ))
    for t in tambahan or ():
        baris.append(_baris(t['nama'], t.get('sumber') or 'Ditetapkan administrator', t.get('peran_label') or ''))
    return baris


def kelengkapan(parameter, dasar=None):
    """Berapa parameter dinilai yang datanya tersedia; "indikatif" bila kurang atau ada syarat dasar tak terukur."""
    if not parameter:
        return None
    dasar_kosong = [label for label, nilai in (dasar or {}).items() if nilai is None]
    total = len(parameter)
    tidak_terukur = [label for label, nilai in parameter.items() if nilai is None]
    terukur = total - len(tidak_terukur)
    minimal = atur('MINIMAL_PARAMETER_TERUKUR')
    alasan = []
    if terukur < minimal:
        alasan.append(f'hanya {terukur} parameter terukur, kurang dari batas minimal {minimal}')
    if terukur < AMBANG_KELENGKAPAN_DATA * total:
        alasan.append(f'{len(tidak_terukur)} dari {total} parameter tidak memiliki data di lokasi ini')
    if dasar_kosong:
        alasan.append('syarat dasar belum terukur: ' + ', '.join(t[0].lower() + t[1:] for t in dasar_kosong))
    return {
        'terukur': terukur,
        'total': total,
        'tidak_terukur': tidak_terukur,
        'dasar_tidak_terukur': dasar_kosong,
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
