import json
import re
from pathlib import Path

from django.test import RequestFactory
from django.urls import resolve
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

PANDUAN = json.loads(Path(__file__).with_name('panduan_asisten.json').read_text(encoding='utf-8'))

KATA_UMUM = frozenset({
    'apa', 'apakah', 'bagaimana', 'gimana', 'cara', 'caranya', 'saya', 'aku', 'kami', 'kita', 'anda', 'bisa',
    'dapat', 'mau', 'ingin', 'tolong', 'mohon', 'yang', 'dan', 'atau', 'di', 'ke', 'dari', 'untuk', 'dengan', 'ini',
    'itu', 'tersebut', 'ada', 'adalah', 'dalam', 'pada', 'juga', 'sudah', 'belum', 'akan', 'kalau', 'jika', 'ya',
    'tidak', 'bukan', 'lagi', 'saja', 'nya', 'kok', 'sih', 'dong', 'mana', 'kenapa', 'mengapa',
})
JUMLAH_PANDUAN = 3
BUANG = frozenset({'geometry', 'batas', 'peta', 'grafik', 'map_markers', 'next', 'previous', 'created_at', 'updated_at'})
MAKS_DAFTAR = 20
TAHAP = ['LOI', 'FS', 'DEV', 'OP']


def _kata(teks):
    return [k for k in re.findall(r'[a-z0-9]+', (teks or '').lower()) if len(k) > 1 and k not in KATA_UMUM]


def _cocok(kata, daftar):
    return any(kata == x or (min(len(kata), len(x)) >= 4 and (kata in x or x in kata)) for x in daftar)


def _di_halaman(bagian, halaman):
    return any(h == halaman or (h not in ('*', '/') and halaman.startswith(h + '/')) for h in bagian['halaman'])


def cari_panduan(pertanyaan, halaman=''):
    kata = set(_kata(pertanyaan))
    nilai = []
    for b in PANDUAN:
        kunci = [k for frasa in b['kata_kunci'] for k in _kata(frasa)]
        judul, isi = _kata(b['judul']), _kata(b['isi'])
        skor = sum(3 if _cocok(k, kunci) else 2 if _cocok(k, judul) else 1 if _cocok(k, isi) else 0 for k in kata)
        if skor and _di_halaman(b, halaman):
            skor += 2
        if skor:
            nilai.append((skor, b))
    nilai.sort(key=lambda x: -x[0])
    bagian = [{'id': b['id'], 'judul': b['judul'], 'isi': b['isi']} for _, b in nilai[:JUMLAH_PANDUAN]]
    if bagian:
        return {'bagian': bagian}
    return {'bagian': [], 'catatan': 'Tidak ada bagian panduan yang cocok.', 'judul_tersedia': [b['judul'] for b in PANDUAN]}


def _api(request, metode, path, data=None):
    pabrik = RequestFactory()
    if metode == 'GET':
        sub = pabrik.get(path, {k: v for k, v in (data or {}).items() if v not in (None, '')})
    else:
        sub = pabrik.post(path, json.dumps(data or {}), content_type='application/json')
    sub._force_auth_user = request.user
    sub._force_auth_token = request.auth
    sub.META['REMOTE_ADDR'] = request.META.get('REMOTE_ADDR', '')
    cocok = resolve(sub.path_info)
    jawaban = cocok.func(sub, *cocok.args, **cocok.kwargs)
    if hasattr(jawaban, 'render'):
        jawaban.render()
    return jawaban.status_code, json.loads(jawaban.content or b'null')


def _pangkas(data):
    if isinstance(data, dict):
        return {k: _pangkas(v) for k, v in data.items() if k not in BUANG}
    if isinstance(data, list):
        isi = [_pangkas(v) for v in data[:MAKS_DAFTAR]]
        if len(data) > MAKS_DAFTAR:
            isi.append(f'{len(data) - MAKS_DAFTAR} butir lain tidak ditampilkan')
        return isi
    if isinstance(data, float):
        return round(data, 4)
    return data


def _teks(keterangan, **lain):
    return {'type': 'string', 'description': keterangan, **lain}


def _bulat(keterangan):
    return {'type': 'integer', 'description': keterangan}


def _skema(sifat=None, wajib=()):
    return {'type': 'object', 'properties': sifat or {}, 'required': list(wajib), 'additionalProperties': False}


GEOMETRI = {
    'type': 'object',
    'description': 'Area GeoJSON bertipe Polygon atau MultiPolygon dalam WGS84, biasanya area yang sedang '
                   'digambar atau diunggah pengguna di Peta Spasial.',
}
JENIS = _teks('Kode jenis investasi dari daftar_jenis_investasi, misalnya PERIKANAN_BUDIDAYA.')

ALAT = {
    'panduan_aplikasi': (
        'Cara memakai fitur aplikasi dan cara kerja perhitungannya: menggambar area, layer peta, langkah analisis, '
        'laporan, pemeriksaan kesesuaian ruang, skor lokasi dan risiko, AHP, finansial, sumber data, dashboard, '
        'pipeline, profil investasi, dan akun. Pakai untuk setiap pertanyaan "bagaimana cara" atau "bagaimana '
        'dihitung", dan jawab hanya berdasarkan bagian panduan yang dikembalikan.',
        _skema({
            'pertanyaan': _teks('Pertanyaan pengguna apa adanya.'),
            'halaman': _teks('Alamat halaman yang sedang dibuka pengguna, misalnya /peta.'),
        }, ['pertanyaan']),
        lambda r, a: (status.HTTP_200_OK, cari_panduan(a['pertanyaan'], a.get('halaman') or '')),
    ),
    'cari_lokasi': (
        'Mencari lokasi menurut nama: provinsi, pelabuhan dan infrastruktur, izin KKPRL, zona tata ruang laut, '
        'dan unsur ruang laut. Hasilnya berisi nama, jenis, keterangan, dan titik [bujur, lintang].',
        _skema({'kata_kunci': _teks('Nama yang dicari, minimal 2 huruf.')}, ['kata_kunci']),
        lambda r, a: _api(r, 'GET', '/api/v1/inti/cari/', {'q': a['kata_kunci']}),
    ),
    'daftar_jenis_investasi': (
        'Daftar jenis investasi beserta kodenya, deskripsi, dan rasio tenaga kerja per miliar rupiah.',
        _skema(),
        lambda r, a: _api(r, 'GET', '/api/v1/inti/sektor/'),
    ),
    'daftar_provinsi': (
        'Daftar provinsi beserta id (untuk profil_investasi_provinsi), kode BPS, dan luas laut.',
        _skema(),
        lambda r, a: _api(r, 'GET', '/api/v1/inti/provinsi/'),
    ),
    'profil_investasi_provinsi': (
        'Profil investasi satu provinsi: gambaran wilayah, komoditas unggulan menurut produksi BPS, ruang laut yang '
        'sesuai per jenis investasi, lokasi prioritas, kondisi oseanografi, dan sosial-ketenagakerjaan.',
        _skema({
            'provinsi_id': _bulat('Id provinsi dari daftar_provinsi (bukan kode BPS).'),
            'jenis_investasi': JENIS,
        }, ['provinsi_id']),
        lambda r, a: _api(
            r, 'GET', f"/api/v1/inti/provinsi/{a['provinsi_id']}/profil-investasi/", {'jenis': a.get('jenis_investasi')}
        ),
    ),
    'statistik_ketenagakerjaan': (
        'Statistik ketenagakerjaan BPS: jumlah penganggur dan tingkat pengangguran terbuka provinsi, atau '
        'kabupaten/kota bila kodenya diberikan.',
        _skema({
            'kode_bps_provinsi': _teks('Kode BPS provinsi dua digit, misalnya 52.'),
            'kode_bps_kabupaten': _teks('Kode BPS kabupaten/kota empat digit, opsional.'),
        }, ['kode_bps_provinsi']),
        lambda r, a: _api(r, 'GET', '/api/v1/analitik/statistik-bps/', {
            'provinsi': a['kode_bps_provinsi'], 'kabupaten': a.get('kode_bps_kabupaten'),
        }),
    ),
    'screening_ruang': (
        'Pemeriksaan kesesuaian ruang sebuah area untuk satu jenis investasi terhadap rencana tata ruang laut dan '
        'KKPRL terbit. SATU-SATUNYA sumber status kesesuaian dan izin ruang: jangan menyimpulkan boleh atau '
        'tidaknya kegiatan di suatu lokasi dari alat lain.',
        _skema({'geometri': GEOMETRI, 'jenis_investasi': JENIS}, ['geometri', 'jenis_investasi']),
        lambda r, a: _api(r, 'POST', '/api/v1/analitik/screening/', {
            'geometry': a['geometri'], 'sektor': a['jenis_investasi'],
        }),
    ),
    'informasi_area': (
        'Informasi umum sebuah area: luas, wilayah administratif, zona tata ruang dan KKPRL yang beririsan, unsur '
        'ruang laut, infrastruktur terdekat, risiko bencana, oseanografi, dan karbon biru.',
        _skema({'geometri': GEOMETRI}, ['geometri']),
        lambda r, a: _api(r, 'POST', '/api/v1/analitik/laporan-spasial/', {'geometry': a['geometri']}),
    ),
    'ringkasan_portofolio': (
        'Ringkasan portofolio proyek nasional: jumlah proyek, nilai rencana dan realisasi (miliar rupiah), tenaga '
        'kerja, sebaran per tahapan, jenis investasi, dan provinsi, serta zona berpotensi yang belum berizin.',
        _skema(),
        lambda r, a: _api(r, 'GET', '/api/v1/inti/dashboard/'),
    ),
    'daftar_proyek': (
        'Daftar proyek di Pipeline Investasi, bisa dicari menurut nama, investor, kode, atau lokasi, dan disaring '
        'menurut tahapan.',
        _skema({
            'kata_kunci': _teks('Kata pencarian, opsional.'),
            'tahap': _teks('Tahapan pipeline, opsional.', enum=TAHAP),
        }),
        lambda r, a: _api(r, 'GET', '/api/v1/pipeline/proyek/', {'search': a.get('kata_kunci'), 'status': a.get('tahap')}),
    ),
    'detail_proyek': (
        'Detail satu proyek di Pipeline Investasi beserta hasil analisis kelayakannya dan riwayat status.',
        _skema({'proyek_id': _bulat('Id proyek dari daftar_proyek.')}, ['proyek_id']),
        lambda r, a: _api(r, 'GET', f"/api/v1/pipeline/proyek/{a['proyek_id']}/"),
    ),
    'cari_kkprl': (
        'Mencari izin KKPRL menurut nama pemohon, nomor izin, atau jenis kegiatan.',
        _skema({'kata_kunci': _teks('Kata pencarian.')}, ['kata_kunci']),
        lambda r, a: _api(r, 'GET', '/api/v1/inventarisasi/kkprl/', {'search': a['kata_kunci']}),
    ),
}

TIPE = {'string': str, 'integer': int, 'object': dict}


def _periksa(skema, argumen):
    if not isinstance(argumen, dict):
        return 'Argumen harus berupa objek JSON.'
    sifat = skema['properties']
    asing = sorted(set(argumen) - set(sifat))
    if asing:
        return f"Argumen tidak dikenal: {', '.join(asing)}."
    for kunci in skema['required']:
        if argumen.get(kunci) in (None, ''):
            return f'Argumen {kunci} wajib diisi.'
    for kunci, nilai in argumen.items():
        if nilai is None:
            continue
        aturan = sifat[kunci]
        if not isinstance(nilai, TIPE[aturan['type']]) or isinstance(nilai, bool):
            return f"Argumen {kunci} harus bertipe {aturan['type']}."
        if 'enum' in aturan and nilai not in aturan['enum']:
            return f"Argumen {kunci} harus salah satu dari: {', '.join(aturan['enum'])}."
    return None


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def daftar_alat(request):
    return Response({
        'alat': [
            {'type': 'function', 'function': {'name': nama, 'description': keterangan, 'parameters': skema}}
            for nama, (keterangan, skema, _) in ALAT.items()
        ]
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def pakai_alat(request, nama):
    if nama not in ALAT:
        return Response({'detail': f'Alat "{nama}" tidak dikenal.'}, status=status.HTTP_404_NOT_FOUND)
    _, skema, jalankan = ALAT[nama]
    argumen = request.data.get('argumen', {}) if isinstance(request.data, dict) else None
    salah = _periksa(skema, argumen)
    if salah:
        return Response({'detail': salah}, status=status.HTTP_400_BAD_REQUEST)
    kode, data = jalankan(request, argumen)
    if kode >= 400:
        rinci = data.get('detail', data) if isinstance(data, dict) else data
        return Response({'alat': nama, 'detail': rinci}, status=kode)
    return Response({'alat': nama, 'hasil': _pangkas(data)})
