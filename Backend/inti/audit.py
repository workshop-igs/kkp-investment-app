import json
import logging
from datetime import timedelta

logger = logging.getLogger('inti')

JEDA_TANDA_AKTIF_DETIK = 60

METODE_DICATAT = frozenset({'POST', 'PUT', 'PATCH', 'DELETE'})

JALUR_KHUSUS = (
    ('/auth/login/', 'MASUK', 'Masuk ke sistem'),
    ('/auth/logout/', 'KELUAR', 'Keluar dari sistem'),
    ('/auth/register/', 'DAFTAR', 'Pendaftaran akun baru'),
    ('/analitik/analisis/', 'ANALISIS', 'Menjalankan analisis kelayakan'),
    ('/auth/ganti-sandi/', 'UBAH', 'Mengganti kata sandi'),
    ('/auth/me/', 'UBAH', 'Memperbarui data diri'),
    ('/admin/users/', 'BUAT', 'Menambahkan akun administrator'),
    ('/analitik/laporan-spasial/', 'ANALISIS', 'Menyusun laporan analisis area'),
    ('/analitik/screening/', 'ANALISIS', 'Menyaring lokasi potensial'),
    ('/analitik/sebaran-tenaga-kerja/', 'ANALISIS', 'Menghitung sebaran tenaga kerja'),
    ('/pengaturan-analisis/hitung-ulang/', 'ANALISIS', 'Menjalankan hitung ulang analisis'),
)

AKSI_METODE = {'POST': 'BUAT', 'PUT': 'UBAH', 'PATCH': 'UBAH', 'DELETE': 'HAPUS'}

NAMA_SASARAN = {
    'proyek': 'Proyek investasi',
    'users': 'Akun pengguna',
    'sektor': 'Jenis investasi',
    'potensi': 'Lokasi potensi',
    'kkprl': 'Izin KKPRL',
    'zonasi': 'Zona ruang laut',
    'pengaturan-analisis': 'Pengaturan analisis',
    'parameter-tambahan': 'Parameter analisis tambahan',
}


LABEL_MEDAN = {
    'is_active': 'Akun aktif', 'is_staff': 'Administrator', 'first_name': 'Nama depan',
    'last_name': 'Nama belakang', 'email': 'Surel',
}


def catat(request, ringkasan, objek='', rincian=()):
    asal = getattr(request, '_request', request)
    asal.jejak_audit = (ringkasan, objek, '\n'.join(rincian))


def _tampil(v):
    if v is None or v == '' or v == []:
        return '(kosong)'
    if isinstance(v, bool):
        return 'Ya' if v else 'Tidak'
    teks = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)
    return teks if len(teks) <= 240 else teks[:237] + '…'


def selisih(lama, baru, label=str, awalan=''):
    baris = []
    for k in dict.fromkeys([*lama, *baru]):
        a, b = lama.get(k), baru.get(k)
        if a == b:
            continue
        nama = f'{awalan}{label(k)}'
        if isinstance(a, dict) and isinstance(b, dict):
            baris += selisih(a, b, label, f'{nama} › ')
        else:
            baris.append(f'{nama}: {_tampil(a)} → {_tampil(b)}')
    return baris


def potret(v):
    if hasattr(v, 'geom_type'):
        return f'{v.geom_type}, {v.num_points} titik'
    if hasattr(v, 'all'):
        return sorted(str(x) for x in v.all())
    if hasattr(v, '_meta'):
        return str(v)
    return v if isinstance(v, (str, int, float, bool, list, dict, type(None))) else str(v)


def _label_medan(model, k):
    if k in LABEL_MEDAN:
        return LABEL_MEDAN[k]
    try:
        return str(model._meta.get_field(k).verbose_name).capitalize()
    except Exception:
        return k


def simpan_berjejak(serializer, **tambahan):
    data = {k: v for k, v in serializer.validated_data.items() if not isinstance(v, dict)}
    lama = {k: potret(getattr(serializer.instance, k, None)) for k in data}
    obj = serializer.save(**tambahan)
    baru = {k: potret(getattr(obj, k, None)) for k in data}
    return obj, selisih(lama, baru, lambda k: _label_medan(type(obj), k))


def _alamat_ip(request):
    teruskan = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if teruskan:
        return teruskan.split(',')[0].strip()[:45] or None
    return request.META.get('REMOTE_ADDR') or None


def _sasaran(jalur):
    bagian = [b for b in jalur.split('/') if b]
    nama = ''
    nomor = ''
    for b in bagian:
        if b in NAMA_SASARAN:
            nama = NAMA_SASARAN[b]
        elif b.isdigit():
            nomor = b
    if not nama:
        return ''
    return f'{nama} #{nomor}' if nomor else nama


def tandai_aktif(request):
    pengguna = getattr(request, 'user', None)
    if not (pengguna and pengguna.is_authenticated):
        return
    from django.core.cache import cache
    from django.db.models import Q
    from django.utils import timezone

    from inti.models import ProfilPengguna

    kunci = f'aktif:{pengguna.pk}'
    if cache.get(kunci):
        return
    cache.set(kunci, 1, JEDA_TANDA_AKTIF_DETIK)
    sekarang = timezone.now()
    batas = sekarang - timedelta(seconds=JEDA_TANDA_AKTIF_DETIK)
    diubah = (
        ProfilPengguna.objects.filter(user_id=pengguna.pk)
        .filter(Q(terakhir_aktif__isnull=True) | Q(terakhir_aktif__lt=batas))
        .update(terakhir_aktif=sekarang)
    )
    if not diubah:
        ProfilPengguna.objects.get_or_create(user_id=pengguna.pk, defaults={'terakhir_aktif': sekarang})


class JejakAktivitasMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._catat(request, response)
        except Exception as e:
            logger.error(f'[AUDIT] Gagal mencatat aktivitas: {type(e).__name__}: {e}')
        try:
            tandai_aktif(request)
        except Exception as e:
            logger.warning(f'[AUDIT] Gagal menandai pengguna aktif: {type(e).__name__}: {e}')
        return response

    def _catat(self, request, response):
        from inti.models import LogAktivitas

        jalur = request.path
        metode = request.method

        kode = getattr(response, 'status_code', None)

        if jalur.endswith('/o/token/'):
            self._catat_token(request, jalur, kode)
            return

        aksi = ringkasan = None
        dicatat = metode in METODE_DICATAT and '/asisten/' not in jalur
        if dicatat:
            for potongan, aksi_khusus, teks in JALUR_KHUSUS:
                if jalur.endswith(potongan):
                    aksi, ringkasan = aksi_khusus, teks
                    break

        ditolak = kode in (401, 403)

        if aksi is None:
            if not dicatat and not ditolak:
                return
            aksi = AKSI_METODE.get(metode, 'DITOLAK')
            ringkasan = ''

        jejak = getattr(request, 'jejak_audit', None)
        objek = _sasaran(jalur)
        rincian = ''
        if jejak and not ditolak:
            ringkasan, objek, rincian = jejak[0], jejak[1] or objek, jejak[2]
        elif kode and kode >= 400 and not ditolak:
            ringkasan = f'Gagal: {ringkasan or "permintaan tidak dapat diproses"} (kode {kode})'

        if ditolak:
            aksi = 'DITOLAK'
            ringkasan = ringkasan or (
                'Sesi login sudah berakhir atau belum masuk' if kode == 401
                else 'Ditolak karena tidak punya hak akses'
            )

        pengguna = getattr(request, 'user', None)
        masuk = bool(pengguna and pengguna.is_authenticated)

        LogAktivitas.objects.create(
            pengguna=pengguna if masuk else None,
            nama_pengguna=(pengguna.get_username() if masuk else ''),
            aksi=aksi,
            metode=metode,
            jalur=jalur[:255],
            objek=objek[:120],
            ringkasan=ringkasan[:255],
            rincian=rincian,
            kode_status=kode,
            alamat_ip=_alamat_ip(request),
            agen=request.META.get('HTTP_USER_AGENT', '')[:200],
        )

    def _catat_token(self, request, jalur, kode):
        from django.contrib.auth import get_user_model

        from inti.models import LogAktivitas

        if request.method != 'POST' or request.POST.get('grant_type') != 'password':
            return
        nama = (request.POST.get('username') or '').strip()[:150]
        User = get_user_model()
        pengguna = (
            User.objects.filter(username=nama).first()
            or User.objects.filter(email__iexact=nama).first()
            if nama else None
        )
        berhasil = kode == 200
        LogAktivitas.objects.create(
            pengguna=pengguna,
            nama_pengguna=pengguna.get_username() if pengguna else nama,
            aksi='MASUK' if berhasil else 'DITOLAK',
            metode='POST',
            jalur=jalur[:255],
            objek='',
            ringkasan='Masuk ke sistem' if berhasil else 'Percobaan masuk gagal',
            kode_status=kode,
            alamat_ip=_alamat_ip(request),
            agen=request.META.get('HTTP_USER_AGENT', '')[:200],
        )
