import json
import logging
import re
import time
from pathlib import Path

import httpx
from django.conf import settings
from django.test import RequestFactory
from django.urls import resolve
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from analitik.services.ahp import _rupiah

from .models import SektorInvestasi

logger = logging.getLogger('inti')

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


def _pangkas(data, maks=MAKS_DAFTAR):
    if isinstance(data, dict):
        return {k: _pangkas(v, maks) for k, v in data.items() if k not in BUANG}
    if isinstance(data, list):
        isi = [_pangkas(v, maks) for v in data[:maks]]
        if len(data) > maks:
            isi.append(f'{len(data) - maks} butir lain tidak ditampilkan')
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
        _skema({'kata_kunci': _teks(
            'Satu nama tempat atau objek saja, misalnya "Lombok" atau "Tanjung Luar"; jangan digabung dengan jenis '
            'objeknya.'
        )}, ['kata_kunci']),
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
        'tidaknya kegiatan di suatu lokasi dari alat lain. Jelaskan hasilnya memakai status_label dan kalimat pada '
        'alasan apa adanya.',
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


def _lengkapi(skema):
    sifat = skema['properties']
    if 'jenis_investasi' not in sifat:
        return skema
    jenis = list(SektorInvestasi.objects.filter(aktif=True).order_by('urutan', 'nama').values_list('kode', 'nama'))
    daftar = ', '.join(f'{kode} = {nama}' for kode, nama in jenis)
    return {
        **skema,
        'properties': {
            **sifat,
            'jenis_investasi': {
                **sifat['jenis_investasi'], 'enum': [kode for kode, _ in jenis], 'description': f'Kode jenis investasi: {daftar}.',
            },
        },
    }


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
            {'type': 'function', 'function': {'name': nama, 'description': keterangan, 'parameters': _lengkapi(skema)}}
            for nama, (keterangan, skema, _) in ALAT.items()
        ]
    })


def _eksekusi(request, nama, argumen):
    if nama not in ALAT:
        return status.HTTP_404_NOT_FOUND, {'detail': f'Alat "{nama}" tidak dikenal.'}
    _, skema, jalankan = ALAT[nama]
    salah = _periksa(_lengkapi(skema), argumen)
    if salah:
        return status.HTTP_400_BAD_REQUEST, {'detail': salah}
    kode, data = jalankan(request, argumen)
    if kode >= 400:
        return kode, {'alat': nama, 'detail': data.get('detail', data) if isinstance(data, dict) else data}
    return kode, {'alat': nama, 'hasil': _pangkas(data)}


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def pakai_alat(request, nama):
    argumen = request.data.get('argumen', {}) if isinstance(request.data, dict) else None
    kode, isi = _eksekusi(request, nama, argumen)
    return Response(isi, status=kode)


BUTUH_AREA = frozenset({'screening_ruang', 'informasi_area'})
MAKS_PUTARAN = 5
MAKS_RIWAYAT = 8
MAKS_TEKS = 2000
MAKS_TOKEN_JAWABAN = 1500
JUMLAH_PANDUAN_KONTEKS = 2
LABEL_ALAT = {
    'panduan_aplikasi': 'panduan aplikasi',
    'cari_lokasi': 'pencarian lokasi',
    'daftar_jenis_investasi': 'daftar jenis investasi',
    'daftar_provinsi': 'daftar provinsi',
    'profil_investasi_provinsi': 'profil investasi provinsi',
    'statistik_ketenagakerjaan': 'statistik BPS',
    'screening_ruang': 'pemeriksaan kesesuaian ruang',
    'informasi_area': 'informasi area',
    'ringkasan_portofolio': 'ringkasan portofolio',
    'daftar_proyek': 'pipeline investasi',
    'detail_proyek': 'detail proyek',
    'cari_kkprl': 'data KKPRL',
}
SISTEM = (
    'Anda adalah Asisten KKP, asisten aplikasi internal Kementerian Kelautan dan Perikanan untuk penilaian investasi '
    'ruang laut; sebut aplikasi ini sebagai "aplikasi ini". Penggunanya pegawai KKP. Aturan:\n'
    '1. Jawab dalam bahasa Indonesia yang baku, singkat, dan jelas, tanpa format Markdown (tanpa tanda bintang atau '
    'pagar); pakai daftar bernomor bila perlu.\n'
    '2. Untuk pertanyaan cara memakai aplikasi atau cara kerja perhitungannya, panggil panduan_aplikasi dan jawab '
    'hanya berdasarkan hasilnya.\n'
    '3. Untuk pertanyaan data seperti lokasi, provinsi, proyek, izin, atau statistik, panggil alat yang sesuai. '
    'Jangan mengarang angka, nama, maupun status.\n'
    '4. Status kesesuaian ruang, yaitu boleh tidaknya suatu kegiatan di suatu lokasi, hanya boleh diambil dari '
    'screening_ruang. Jangan menyimpulkan kesesuaian, potensi, atau kelayakan lokasi dari alat lain. Bila '
    'screening_ruang gagal atau tidak dipanggil, katakan bahwa status kesesuaiannya belum dapat ditentukan. {area}\n'
    '5. Bila alat tidak memberikan jawaban atau datanya tidak ada, katakan terus terang bahwa datanya tidak '
    'tersedia.\n'
    '6. Nilai uang dari alat sudah ditulis lengkap dengan satuannya; salin apa adanya tanpa menghitung ulang.\n'
    '7. Jangan menyebut nama alat atau fungsi kepada pengguna dan jangan meminta pengguna menjalankannya; '
    'panggil sendiri alat yang diperlukan.\n'
    'Halaman yang sedang dibuka pengguna: {halaman}.'
)
PENGANTAR_PANDUAN = (
    '\nBagian panduan aplikasi yang mungkin relevan; pakai sebagai dasar jawaban bila pertanyaan menyangkut cara '
    'memakai atau cara kerja aplikasi:'
)
KALIMAT_AREA = {
    True: 'Pengguna sudah memiliki area di Peta Spasial. Bila pengguna menanyakan kesesuaian area itu untuk suatu '
          'kegiatan, langsung panggil screening_ruang dengan jenis investasi yang paling sesuai; screening_ruang dan '
          'informasi_area otomatis memakai area itu.',
    False: 'Pengguna belum menggambar area; bila pertanyaannya menyangkut lokasi tertentu, minta pengguna menggambar '
           'atau mengunggah area di Peta Spasial terlebih dahulu.',
}


class ThrottleAsisten(SimpleRateThrottle):
    scope = 'asisten'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': request.user.pk}


def _alat_obrolan(ada_area):
    hasil = []
    for nama, (keterangan, skema, _) in ALAT.items():
        skema = _lengkapi(skema)
        if nama in BUTUH_AREA:
            if not ada_area:
                continue
            skema = {
                **skema,
                'properties': {k: v for k, v in skema['properties'].items() if k != 'geometri'},
                'required': [k for k in skema['required'] if k != 'geometri'],
            }
        hasil.append({'type': 'function', 'function': {'name': nama, 'description': keterangan, 'parameters': skema}})
    return hasil


SATUAN_RUPIAH = (('_miliar', 1e9), ('_juta_rp', 1e6), ('_ribu_rp', 1e3), ('_idr', 1))


def _rupiah_terbaca(data):
    if isinstance(data, list):
        return [_rupiah_terbaca(v) for v in data]
    if not isinstance(data, dict):
        return data
    hasil = {}
    for k, v in data.items():
        kali = next((x for akhiran, x in SATUAN_RUPIAH if k.endswith(akhiran) and 'per_miliar' not in k), None)
        if kali and isinstance(v, (int, float)) and not isinstance(v, bool):
            hasil[k] = _rupiah(v * kali)
        else:
            hasil[k] = _rupiah_terbaca(v)
    return hasil


DIDAHULUKAN = ('status', 'status_label', 'alasan', 'rekomendasi')


def _untuk_model(isi):
    teks = ''
    isi = _rupiah_terbaca(isi)
    if isinstance(isi.get('hasil'), dict):
        hasil = isi['hasil']
        isi = {**isi, 'hasil': {**{k: hasil[k] for k in DIDAHULUKAN if k in hasil}, **hasil}}
    for maks in (MAKS_DAFTAR, 8, 3):
        teks = json.dumps(_pangkas(isi, maks), ensure_ascii=False, default=str)
        if len(teks) <= settings.ASISTEN_BATAS_HASIL:
            return teks
    return teks[:settings.ASISTEN_BATAS_HASIL] + ' ...(hasil dipangkas)'


def _tanya_model(riwayat, alat, sisa_detik):
    kepala = {'Authorization': f'Bearer {settings.ASISTEN_LLM_KUNCI}'} if settings.ASISTEN_LLM_KUNCI else {}
    jawab = httpx.post(
        settings.ASISTEN_LLM_URL.rstrip('/') + '/chat/completions',
        json={
            'model': settings.ASISTEN_LLM_MODEL, 'messages': riwayat, 'tools': alat, 'temperature': 0.2,
            'max_tokens': MAKS_TOKEN_JAWABAN,
            **settings.ASISTEN_LLM_EKSTRA,
        },
        headers=kepala,
        timeout=max(5.0, sisa_detik),
    )
    jawab.raise_for_status()
    return jawab.json()['choices'][0]['message']


def _bersihkan(teks):
    teks = re.sub(r'<think>.*?</think>', '', teks or '', flags=re.S)
    teks = re.sub(r'\*\*|__|`', '', teks)
    teks = re.sub(r'^[ \t]*#+[ \t]*', '', teks, flags=re.M)
    teks = re.sub(r'^([ \t]*)[*-][ \t]+', r'\1• ', teks, flags=re.M)
    return teks.strip()


def _riwayat_sah(pesan):
    if not isinstance(pesan, list) or not pesan:
        return None
    hasil = []
    for m in pesan[-MAKS_RIWAYAT:]:
        if not isinstance(m, dict) or m.get('peran') not in ('pengguna', 'asisten') or not isinstance(m.get('teks'), str):
            return None
        hasil.append({'role': 'user' if m['peran'] == 'pengguna' else 'assistant', 'content': m['teks'][:MAKS_TEKS]})
    return hasil if hasil[-1]['role'] == 'user' and hasil[-1]['content'].strip() else None


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([ThrottleAsisten])
def obrolan(request):
    if not settings.ASISTEN_LLM_URL:
        return Response({'detail': 'Model asisten belum terhubung.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    data = request.data if isinstance(request.data, dict) else {}
    riwayat = _riwayat_sah(data.get('pesan'))
    if riwayat is None:
        return Response({'detail': 'Pesan tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)
    halaman = str(data.get('halaman') or '/')[:200]
    geometri = data.get('geometri')
    ada_area = isinstance(geometri, dict) and geometri.get('type') in ('Polygon', 'MultiPolygon')
    alat = _alat_obrolan(ada_area)
    sistem = SISTEM.format(area=KALIMAT_AREA[ada_area], halaman=halaman)
    bagian = cari_panduan(riwayat[-1]['content'], halaman)['bagian'][:JUMLAH_PANDUAN_KONTEKS]
    if bagian:
        sistem += PENGANTAR_PANDUAN + ''.join(f"\n- {b['judul']}: {b['isi']}" for b in bagian)
    riwayat = [{'role': 'system', 'content': sistem}, *riwayat]
    dipakai = []
    batas = time.monotonic() + settings.ASISTEN_LLM_TIMEOUT
    try:
        for _ in range(MAKS_PUTARAN):
            pesan = _tanya_model(riwayat, alat, batas - time.monotonic())
            panggilan = pesan.get('tool_calls') or []
            if not panggilan:
                teks = _bersihkan(pesan.get('content'))
                return Response({'jawaban': teks or 'Maaf, asisten belum dapat menyusun jawaban.', 'alat': dipakai})
            riwayat.append({'role': 'assistant', 'content': pesan.get('content') or '', 'tool_calls': panggilan})
            for p in panggilan:
                nama = (p.get('function') or {}).get('name', '')
                try:
                    argumen = json.loads(p['function'].get('arguments') or '{}')
                except (TypeError, ValueError):
                    argumen = None
                if isinstance(argumen, dict):
                    if nama in BUTUH_AREA and ada_area:
                        argumen['geometri'] = geometri
                    if nama == 'panduan_aplikasi':
                        argumen.setdefault('halaman', halaman)
                _, isi = _eksekusi(request, nama, argumen)
                if nama in LABEL_ALAT and LABEL_ALAT[nama] not in dipakai:
                    dipakai.append(LABEL_ALAT[nama])
                riwayat.append({'role': 'tool', 'tool_call_id': p.get('id', ''), 'content': _untuk_model(isi)})
            if time.monotonic() >= batas:
                break
    except (httpx.HTTPError, KeyError, ValueError) as e:
        logger.warning(f'[ASISTEN] Model tidak dapat dihubungi: {type(e).__name__}: {e}')
        return Response({'detail': 'Model asisten tidak dapat dihubungi.'}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({
        'jawaban': 'Maaf, pertanyaan ini membutuhkan terlalu banyak langkah. Coba persempit pertanyaannya.',
        'alat': dipakai,
    })
