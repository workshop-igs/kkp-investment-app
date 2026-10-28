from django.contrib.auth.models import User
from django.contrib.gis.db import models
from django.utils import timezone


class Provinsi(models.Model):
    kode_bps = models.CharField(max_length=10, unique=True, help_text='Kode BPS provinsi')
    nama = models.CharField(max_length=100)

    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)

    geometry_tampilan = models.MultiPolygonField(
        srid=4326, null=True, blank=True,
        help_text='Batas yang disederhanakan untuk peta; jangan dipakai analisis.',
    )
    luas_laut_km2 = models.FloatField(default=0, help_text='Luas wilayah laut (km²)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inti_provinsi'
        ordering = ['kode_bps']
        verbose_name_plural = 'Provinsi'

    def __str__(self):
        return self.nama


class KabupatenKota(models.Model):
    JENIS_CHOICES = [
        ('KAB', 'Kabupaten'),
        ('KOTA', 'Kota'),
    ]

    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='kabupaten_kota')
    kode_bps = models.CharField(max_length=10, unique=True, help_text='Kode BPS kab/kota')
    nama = models.CharField(max_length=100)
    jenis = models.CharField(max_length=4, choices=JENIS_CHOICES, default='KAB')
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)
    pesisir = models.BooleanField(default=False, help_text='Apakah kab/kota pesisir')
    jumlah_penduduk = models.IntegerField(default=0)
    luas_km2 = models.FloatField(default=0, help_text='Luas wilayah daratan (km persegi)')

    penduduk_dtks = models.IntegerField(
        default=0, help_text='Penduduk terdaftar DTKS desil 1-4 (Kemensos, via Portal Satu Data KKP)'
    )
    jumlah_nelayan = models.IntegerField(default=0, help_text='Jumlah nelayan (statistik KKP)')
    jumlah_rtp_tangkap = models.IntegerField(
        default=0, help_text='Rumah tangga perikanan tangkap (statistik KKP)'
    )
    tahun_data_sosial = models.IntegerField(
        null=True, blank=True, help_text='Tahun data nelayan/RTP yang terpakai'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inti_kabupaten_kota'
        ordering = ['provinsi', 'kode_bps']
        verbose_name_plural = 'Kabupaten/Kota'

    def __str__(self):
        return f'{self.nama}, {self.provinsi.nama}'


class Kecamatan(models.Model):
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='kecamatan')
    kabupaten = models.ForeignKey(
        KabupatenKota, on_delete=models.SET_NULL, null=True, blank=True, related_name='kecamatan'
    )
    kode = models.CharField(max_length=20, blank=True, db_index=True, help_text='Kode Kemendagri, mis. 52.08.01')
    nama = models.CharField(max_length=100)
    geometry = models.MultiPolygonField(srid=4326)
    luas_ha = models.FloatField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inti_kecamatan'
        verbose_name_plural = 'Kecamatan'

    def __str__(self):
        return self.nama


class DesaKelurahan(models.Model):
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='desa_kelurahan')
    kecamatan = models.ForeignKey(
        Kecamatan, on_delete=models.SET_NULL, null=True, blank=True, related_name='desa_kelurahan'
    )
    kode = models.CharField(
        max_length=32, blank=True, db_index=True,
        help_text='Kode Kemendagri, mis. 52.08.01.2001; wilayah bersama ditulis A/B',
    )
    nama = models.CharField(max_length=100)
    jenis = models.CharField(max_length=10, default='Desa')
    geometry = models.MultiPolygonField(srid=4326)
    luas_ha = models.FloatField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inti_desa_kelurahan'
        verbose_name_plural = 'Desa/Kelurahan'

    def __str__(self):
        return f'{self.jenis} {self.nama}'


class WilayahPengelolaanPerikanan(models.Model):
    kode = models.CharField(max_length=3, unique=True, help_text='Nomor WPP-RI, mis. 713')
    perairan = models.CharField(max_length=255)
    zona_pit = models.CharField(max_length=20, blank=True, help_text='Zona Penangkapan Ikan Terukur')
    peruntukan_zona = models.CharField(max_length=255, blank=True)
    geometry = models.MultiPolygonField(srid=4326)
    titik_label = models.PointField(srid=4326)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inti_wpp'
        ordering = ['kode']
        verbose_name_plural = 'Wilayah Pengelolaan Perikanan'

    def __str__(self):
        return f'WPP-RI {self.kode}'


class GarisWPP(models.Model):
    JENIS_CHOICES = [('ANTAR', 'Batas antar-WPP'), ('LUAR', 'Batas terluar WPP')]

    jenis = models.CharField(max_length=5, choices=JENIS_CHOICES, unique=True)
    geometry = models.MultiLineStringField(srid=4326)

    class Meta:
        db_table = 'inti_wpp_garis'


class SektorInvestasi(models.Model):
    kode = models.CharField(max_length=50, unique=True, help_text='e.g., PERIKANAN_TANGKAP')
    nama = models.CharField(max_length=100)
    deskripsi = models.TextField(blank=True)
    ikon = models.CharField(max_length=50, blank=True, help_text='Icon identifier for frontend')
    warna = models.CharField(max_length=7, default='#0ea5e9', help_text='Hex color for map display')
    rasio_tk_per_miliar = models.FloatField(
        default=20.0, help_text='Rasio penyerapan tenaga kerja per Rp 1 Miliar investasi'
    )
    aktif = models.BooleanField(default=True)
    urutan = models.IntegerField(default=0, help_text='Urutan tampil di UI')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inti_sektor_investasi'
        ordering = ['urutan', 'nama']
        verbose_name_plural = 'Sektor Investasi'

    def __str__(self):
        return self.nama


class ProfilPengguna(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profil')
    instansi = models.CharField(max_length=255, blank=True, help_text='Unit kerja di KKP')
    provinsi = models.ForeignKey(
        Provinsi, on_delete=models.SET_NULL, null=True, blank=True, help_text='Provinsi wilayah kerja'
    )
    telepon = models.CharField(max_length=20, blank=True)
    terakhir_aktif = models.DateTimeField(
        null=True, blank=True, db_index=True, help_text='Permintaan terakhir dari akun ini (diperbarui paling sering per menit)'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inti_profil_pengguna'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f'{self.user.username} ({self.get_role_display()})'


class SumberData(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Aktif'),
        ('MOCK', 'Mock/Simulasi'),
        ('INACTIVE', 'Tidak Aktif'),
        ('ERROR', 'Error'),
    ]

    kode = models.CharField(max_length=20, unique=True)
    nama = models.CharField(max_length=100)
    deskripsi = models.TextField(blank=True)
    tipe = models.CharField(
        max_length=20,
        choices=[
            ('API', 'REST API'),
            ('WMS', 'WMS Service'),
            ('WFS', 'WFS Service'),
            ('WCS', 'WCS Service'),
            ('FILE', 'Static File'),
            ('DB', 'Database'),
        ],
        default='API',
    )
    base_url = models.URLField(blank=True)
    api_key_env = models.CharField(max_length=50, blank=True, help_text='Nama environment variable untuk API key')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='MOCK')
    last_sync = models.DateTimeField(null=True, blank=True)
    sync_interval_days = models.IntegerField(default=90, help_text='Interval sinkronisasi data (hari)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inti_sumber_data'
        ordering = ['nama']
        verbose_name_plural = 'Data Sources'

    def __str__(self):
        return f'{self.nama} ({self.get_status_display()})'

    @property
    def perlu_disinkronkan(self):
        if not self.last_sync:
            return True
        return (timezone.now() - self.last_sync).days >= self.sync_interval_days


class LogSinkronisasi(models.Model):
    RESULT_CHOICES = [
        ('SUCCESS', 'Berhasil'),
        ('PARTIAL', 'Sebagian Berhasil'),
        ('FAILED', 'Gagal'),
    ]

    data_source = models.ForeignKey(SumberData, on_delete=models.CASCADE, related_name='sync_logs')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    result = models.CharField(max_length=10, choices=RESULT_CHOICES, default='SUCCESS')
    records_fetched = models.IntegerField(default=0)
    records_updated = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    details_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'inti_log_sinkronisasi'
        ordering = ['-started_at']
        verbose_name_plural = 'Data Sync Logs'

    def __str__(self):
        return f'Sync {self.data_source.nama} @ {self.started_at}'


class LogAktivitas(models.Model):
    AKSI_CHOICES = [
        ('MASUK', 'Masuk'),
        ('KELUAR', 'Keluar'),
        ('DAFTAR', 'Pendaftaran akun'),
        ('BUAT', 'Membuat data'),
        ('UBAH', 'Mengubah data'),
        ('HAPUS', 'Menghapus data'),
        ('ANALISIS', 'Menjalankan analisis'),
        ('DITOLAK', 'Ditolak sistem'),
    ]

    pengguna = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='log_aktivitas',
    )
    nama_pengguna = models.CharField(
        max_length=150, blank=True, help_text='Disalin saat kejadian; tetap ada bila akun dihapus'
    )
    aksi = models.CharField(max_length=10, choices=AKSI_CHOICES, db_index=True)
    metode = models.CharField(max_length=10, blank=True)
    jalur = models.CharField(max_length=255, blank=True)
    objek = models.CharField(
        max_length=120, blank=True, help_text='Sasaran perbuatan, mis. "Proyek #12"'
    )
    ringkasan = models.CharField(max_length=255, blank=True)
    kode_status = models.IntegerField(null=True, blank=True)
    alamat_ip = models.GenericIPAddressField(null=True, blank=True)
    agen = models.CharField(max_length=200, blank=True, help_text='User-Agent, dipangkas')
    waktu = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'inti_log_aktivitas'
        ordering = ['-waktu']
        verbose_name = 'Log Aktivitas Pengguna'
        verbose_name_plural = 'Log Aktivitas Pengguna'
        indexes = [
            models.Index(fields=['-waktu', 'aksi'], name='log_aktivitas_waktu_aksi_idx'),
        ]

    def __str__(self):
        return f'{self.waktu:%Y-%m-%d %H:%M} {self.nama_pengguna or "anonim"} {self.aksi}'
