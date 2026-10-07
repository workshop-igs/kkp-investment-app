import logging

logger = logging.getLogger('inti')

METODE_DICATAT = frozenset({'POST', 'PUT', 'PATCH', 'DELETE'})

JALUR_KHUSUS = (
    ('/auth/login/', 'MASUK', 'Masuk ke sistem'),
    ('/auth/logout/', 'KELUAR', 'Keluar dari sistem'),
    ('/auth/register/', 'DAFTAR', 'Pendaftaran akun baru'),
    ('/analitik/analisis/', 'ANALISIS', 'Menjalankan analisis kelayakan'),
    ('/auth/ganti-sandi/', 'UBAH', 'Mengganti kata sandi'),
    ('/auth/me/', 'UBAH', 'Memperbarui data diri'),
    ('/admin/users/', 'BUAT', 'Menambahkan akun administrator'),
)

AKSI_METODE = {'POST': 'BUAT', 'PUT': 'UBAH', 'PATCH': 'UBAH', 'DELETE': 'HAPUS'}

NAMA_SASARAN = {
    'proyek': 'Proyek investasi',
    'users': 'Akun pengguna',
    'sektor': 'Sektor investasi',
    'data-sources': 'Sumber data',
    'potensi': 'Lokasi potensi',
    'kkprl': 'Izin KKPRL',
    'zonasi': 'Zona ruang laut',
}


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


class JejakAktivitasMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._catat(request, response)
        except Exception as e:
            logger.error(f'[AUDIT] Gagal mencatat aktivitas: {type(e).__name__}: {e}')
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

        if ditolak:
            aksi = 'DITOLAK'
            ringkasan = ringkasan or f'Upaya tanpa hak akses ({metode})'

        pengguna = getattr(request, 'user', None)
        masuk = bool(pengguna and pengguna.is_authenticated)

        LogAktivitas.objects.create(
            pengguna=pengguna if masuk else None,
            nama_pengguna=(pengguna.get_username() if masuk else ''),
            aksi=aksi,
            metode=metode,
            jalur=jalur[:255],
            objek=_sasaran(jalur)[:120],
            ringkasan=ringkasan[:255],
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
