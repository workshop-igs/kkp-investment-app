from django.contrib.gis.db import models

from inti.models import KabupatenKota, Provinsi, SektorInvestasi


class ZonasiRuangLaut(models.Model):
    JENIS_ZONA_CHOICES = [
        ('ZU', 'Kawasan Pemanfaatan Umum'),
        ('ZT', 'Kawasan Pemanfaatan Terbatas'),
        ('ZL', 'Kawasan Konservasi'),
        ('ALKI', 'Alur Laut Kepulauan Indonesia'),
        ('KSN', 'Kawasan Strategis Nasional'),
        ('KST', 'Kawasan Strategis Nasional Tertentu'),
    ]
    SUB_ZONA_CHOICES = [
        ('PERIKANAN_TANGKAP', 'Sub Zona Perikanan Tangkap'),
        ('PERIKANAN_BUDIDAYA', 'Sub Zona Perikanan Budidaya'),
        ('PERIKANAN', 'Kawasan Perikanan (tangkap & budi daya)'),
        ('PELAYARAN', 'Sub Zona Pelayaran'),
        ('ENERGI', 'Sub Zona Energi'),
        ('PARIWISATA', 'Sub Zona Pariwisata'),
        ('KONSERVASI', 'Sub Zona Konservasi'),
        ('PERTAMBANGAN', 'Sub Zona Pertambangan'),
        ('INDUSTRI', 'Sub Zona Industri'),
        ('MANGROVE', 'Sub Zona Mangrove'),
        ('PERTAHANAN_KEAMANAN', 'Sub Zona Pertahanan dan Keamanan'),
        ('INFRASTRUKTUR', 'Sub Zona Infrastruktur'),
        ('EKOSISTEM_PESISIR', 'Sub Zona Pengelolaan Ekosistem Pesisir'),
        ('PERMUKIMAN', 'Sub Zona Permukiman'),
        ('PERGARAMAN', 'Sub Zona Pergaraman'),
        ('DUMPING', 'Sub Zona Dumping Area'),
        ('KAWASAN_SUCI', 'Kawasan Suci Laut'),
        ('TIDAK_DIBAGI', 'Tidak Dibagi ke dalam Sub Zona'),
        ('BELUM_DIATUR', 'Belum Diatur dalam RZWP-3-K'),
        ('LAINNYA', 'Lainnya'),
    ]
    TINGKAT_ACUAN_CHOICES = [
        ('RTRW_PROVINSI', 'RTRW Provinsi'),
        ('KAW', 'Rencana Zonasi Kawasan Antarwilayah'),
        ('RTRWN', 'RTRW Nasional'),
    ]

    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='zonasi_laut')
    tingkat_acuan = models.CharField(
        max_length=15, choices=TINGKAT_ACUAN_CHOICES, default='RTRW_PROVINSI', db_index=True
    )
    nama_zona = models.CharField(max_length=255)
    jenis_zona = models.CharField(max_length=10, choices=JENIS_ZONA_CHOICES, default='ZU')
    sub_zona = models.CharField(max_length=30, choices=SUB_ZONA_CHOICES, default='LAINNYA')
    nomor_regulasi = models.CharField(max_length=255, blank=True, help_text='No. Perpres/Perda RTR/RZ')
    geometry = models.MultiPolygonField(srid=4326)
    luas_ha = models.FloatField(default=0)
    persen_terbangun = models.FloatField(default=0, help_text='Bagian luas zona yang tertutup bangunan atau struktur eksisting')
    keterangan = models.TextField(blank=True)
    tahun_penetapan = models.IntegerField(null=True, blank=True)
    sumber_data = models.CharField(max_length=100, default='DJPRL')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventarisasi_zonasi_ruang_laut'
        ordering = ['provinsi', 'jenis_zona']
        verbose_name_plural = 'Zonasi Ruang Laut (RTR/RZ)'
        indexes = [
            models.Index(fields=['-luas_ha'], name='zonasi_luas_turun_idx'),
        ]

    def __str__(self):
        return f'{self.nama_zona} ({self.get_jenis_zona_display()}) - {self.provinsi.nama}'


class RegulasiTataRuang(models.Model):
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='regulasi_tata_ruang')
    sumber_data = models.CharField(max_length=100)
    judul = models.CharField(max_length=255)
    tentang = models.CharField(max_length=500)
    tautan = models.URLField(max_length=500)
    ditarik_pada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventarisasi_regulasi_tata_ruang'
        verbose_name_plural = 'Regulasi Tata Ruang'
        constraints = [
            models.UniqueConstraint(fields=['provinsi', 'sumber_data'], name='regulasi_provinsi_sumber_unik'),
        ]

    def __str__(self):
        return f'{self.judul} tentang {self.tentang}'


class KKPRL(models.Model):
    STATUS_CHOICES = [
        ('AKTIF', 'Aktif'),
        ('BERAKHIR', 'Berakhir'),
        ('DICABUT', 'Dicabut'),
        ('PROSES', 'Dalam Proses'),
    ]

    JENIS_DOKUMEN_CHOICES = [
        ('PERSETUJUAN', 'Persetujuan KKPRL'),
        ('KONFIRMASI', 'Konfirmasi KKPRL'),
        ('LAINNYA', 'Dokumen lain'),
    ]

    nomor_izin = models.CharField(max_length=100, unique=True)
    jenis_dokumen = models.CharField(max_length=15, choices=JENIS_DOKUMEN_CHOICES, default='PERSETUJUAN')
    nama_pemohon = models.CharField(max_length=255)
    jenis_kegiatan = models.CharField(max_length=255)
    sektor = models.ForeignKey(SektorInvestasi, on_delete=models.SET_NULL, null=True, blank=True)
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='kkprl')
    kabupaten_kota = models.ForeignKey(KabupatenKota, on_delete=models.SET_NULL, null=True, blank=True)
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)
    luas_ha = models.FloatField(default=0)
    tanggal_terbit = models.DateField(null=True, blank=True)
    tanggal_berakhir = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='AKTIF')
    keterangan = models.TextField(blank=True)
    sumber_data = models.CharField(max_length=100, default='DJPRL')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventarisasi_kkprl'
        ordering = ['-tanggal_terbit']
        verbose_name = 'KKPRL'
        verbose_name_plural = 'KKPRL (Izin Pemanfaatan Ruang Laut)'
        indexes = [
            models.Index(fields=['-luas_ha'], name='kkprl_luas_turun_idx'),
        ]

    def __str__(self):
        return f'{self.nomor_izin} - {self.nama_pemohon}'


class UnsurRuangLaut(models.Model):
    KELOMPOK_CHOICES = [
        ('RTRL', 'Rencana Tata Ruang Laut Nasional'),
        ('RZKAW', 'Rencana Zonasi Kawasan Antarwilayah'),
        ('KKPRL', 'Izin KKPRL (garis)'),
        ('MHA', 'Wilayah Kelola Masyarakat Hukum Adat'),
    ]

    kelompok = models.CharField(max_length=10, choices=KELOMPOK_CHOICES)
    kode_lapisan = models.CharField(max_length=60, help_text='Nama lapisan asal di GeoServer KKP')
    nama = models.CharField(max_length=255)
    jenis = models.CharField(max_length=255, blank=True)
    keterangan = models.TextField(blank=True)
    nomor_regulasi = models.CharField(max_length=255, blank=True)
    provinsi = models.ForeignKey(
        Provinsi, on_delete=models.SET_NULL, null=True, blank=True, related_name='unsur_ruang'
    )
    geometry = models.GeometryField(srid=4326)
    luas_ha = models.FloatField(default=0)
    sumber_data = models.CharField(max_length=100, default='KKP-WFS')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventarisasi_unsur_ruang_laut'
        ordering = ['kelompok', 'nama']
        verbose_name_plural = 'Unsur Ruang Laut (garis & titik)'
        indexes = [
            models.Index(fields=['kelompok'], name='unsur_kelompok_idx'),
            models.Index(fields=['-luas_ha'], name='unsur_luas_turun_idx'),
        ]

    def __str__(self):
        return f'{self.nama} ({self.get_kelompok_display()})'


class InfrastrukturPendukung(models.Model):
    KATEGORI_CHOICES = [
        ('PELABUHAN_PERIKANAN', 'Pelabuhan Perikanan'),
        ('PELABUHAN_UMUM', 'Pelabuhan Umum'),
        ('PELABUHAN_PENYEBERANGAN', 'Pelabuhan Penyeberangan'),
        ('TERMINAL_KHUSUS', 'Terminal Khusus'),
        ('JALAN_NASIONAL', 'Jalan Nasional'),
        ('JARINGAN_LISTRIK', 'Jaringan Listrik'),
        ('PEMBANGKIT_LISTRIK', 'Pembangkit Listrik'),
        ('KAWASAN_INDUSTRI', 'Kawasan Industri'),
        ('KAWASAN_PERDAGANGAN_BEBAS', 'Kawasan Perdagangan Bebas & Pelabuhan Bebas'),
    ]

    kategori = models.CharField(max_length=30, choices=KATEGORI_CHOICES)
    kode_lapisan = models.CharField(max_length=80, help_text='Nama lapisan asal di GeoServer KKP')
    nama = models.CharField(max_length=255)
    kelas = models.CharField(max_length=120, blank=True, help_text='Mis. PPS/PPN/PPP/PPI untuk pelabuhan perikanan')
    pengelola = models.CharField(max_length=180, blank=True)
    status = models.CharField(max_length=120, blank=True)
    keterangan = models.TextField(blank=True)
    provinsi = models.ForeignKey(
        Provinsi, on_delete=models.SET_NULL, null=True, blank=True, related_name='infrastruktur'
    )
    geometry = models.GeometryField(srid=4326)
    luas_ha = models.FloatField(default=0)
    sumber_data = models.CharField(max_length=100, default='KKP-WFS')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventarisasi_infrastruktur_pendukung'
        ordering = ['kategori', 'nama']
        verbose_name_plural = 'Infrastruktur Pendukung'
        indexes = [
            models.Index(fields=['kategori'], name='infra_kategori_idx'),
            models.Index(fields=['-luas_ha'], name='infra_luas_turun_idx'),
        ]

    def __str__(self):
        return f'{self.nama} ({self.get_kategori_display()})'


class BangunanEksisting(models.Model):
    JENIS_CHOICES = [
        ('PELABUHAN', 'Pelabuhan dan kolam pelabuhan'),
        ('DERMAGA', 'Dermaga dan jeti'),
        ('PEMECAH_GELOMBANG', 'Pemecah gelombang dan tanggul'),
        ('JEMBATAN', 'Jembatan'),
        ('ANJUNGAN', 'Anjungan dan sumur migas'),
        ('INDUSTRI', 'Industri'),
        ('PEMBANGKIT', 'Pembangkit dan gardu listrik'),
        ('BANDARA', 'Bandar udara'),
        ('PERMUKIMAN', 'Permukiman dan kawasan komersial'),
        ('KONSTRUKSI', 'Lahan konstruksi atau reklamasi'),
        ('MILITER', 'Kawasan militer'),
        ('BANGUNAN', 'Bangunan'),
    ]

    kode = models.CharField(max_length=40, unique=True, help_text='osm/way/123 atau kkp/45')
    jenis = models.CharField(max_length=20, choices=JENIS_CHOICES)
    nama = models.CharField(max_length=255, blank=True)
    sumber_data = models.CharField(max_length=40)
    geometry = models.MultiPolygonField(srid=4326)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventarisasi_bangunan_eksisting'
        verbose_name_plural = 'Bangunan Eksisting'

    def __str__(self):
        return f'{self.nama or self.get_jenis_display()} ({self.kode})'


class ProgramKKP(models.Model):
    STATUS_CHOICES = [
        ('RENCANA', 'Rencana'),
        ('BERJALAN', 'Berjalan'),
        ('SELESAI', 'Selesai'),
        ('DIBATALKAN', 'Dibatalkan'),
    ]

    nama_program = models.CharField(max_length=255)
    deskripsi = models.TextField(blank=True)
    unit_pelaksana = models.CharField(max_length=255, help_text='Direktorat/unit KKP pelaksana')
    sektor = models.ForeignKey(SektorInvestasi, on_delete=models.SET_NULL, null=True, blank=True)
    provinsi = models.ManyToManyField(Provinsi, blank=True, related_name='program_kkp')
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)
    anggaran_miliar = models.FloatField(default=0, help_text='Anggaran (Miliar Rp)')
    tahun_mulai = models.IntegerField(null=True, blank=True)
    tahun_selesai = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='BERJALAN')
    sumber_data = models.CharField(max_length=100, default='KKP')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventarisasi_program_kkp'
        ordering = ['-tahun_mulai', 'nama_program']
        verbose_name_plural = 'Program KKP'

    def __str__(self):
        return f'{self.nama_program} ({self.get_status_display()})'


class PotensiInvestasi(models.Model):
    TINGKAT_POTENSI_CHOICES = [
        ('SANGAT_TINGGI', 'Sangat Tinggi'),
        ('TINGGI', 'Tinggi'),
        ('SEDANG', 'Sedang'),
        ('RENDAH', 'Rendah'),
    ]

    nama = models.CharField(max_length=255, help_text='Nama zona potensi investasi')
    deskripsi = models.TextField(blank=True)
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='potensi_investasi')
    kabupaten_kota = models.ForeignKey(KabupatenKota, on_delete=models.SET_NULL, null=True, blank=True)
    sektor = models.ForeignKey(SektorInvestasi, on_delete=models.CASCADE, related_name='potensi')
    geometry = models.MultiPolygonField(srid=4326)
    luas_ha = models.FloatField(default=0)

    potensi_sumber_daya = models.TextField(blank=True, help_text='Deskripsi potensi sumber daya')
    nilai_potensi_miliar = models.FloatField(default=0, help_text='Estimasi nilai potensi (Miliar Rp)')
    tingkat_potensi = models.CharField(max_length=15, choices=TINGKAT_POTENSI_CHOICES, default='SEDANG')

    jarak_pelabuhan_km = models.FloatField(null=True, blank=True, help_text='Jarak ke pelabuhan terdekat (km)')
    jarak_bandara_km = models.FloatField(null=True, blank=True, help_text='Jarak ke bandara terdekat (km)')
    akses_jalan = models.BooleanField(default=False, help_text='Akses jalan memadai')
    akses_listrik = models.BooleanField(default=False, help_text='Akses listrik tersedia')
    akses_air_bersih = models.BooleanField(default=False, help_text='Akses air bersih tersedia')

    skor_kelayakan = models.FloatField(null=True, blank=True, help_text='Skor kelayakan investasi (0-1)')
    skor_risiko = models.FloatField(null=True, blank=True, help_text='Skor risiko (0-1, 0=rendah)')
    kelas_risiko = models.CharField(max_length=20, blank=True, help_text='Sangat Rendah/Rendah/Sedang/Tinggi')

    tahun_data = models.IntegerField(null=True, blank=True)
    sumber_data = models.CharField(max_length=100, default='Inventarisasi')
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventarisasi_potensi_investasi'
        ordering = ['-skor_kelayakan', 'provinsi']
        verbose_name_plural = 'Potensi Investasi'

    def __str__(self):
        return f'{self.nama} - {self.sektor.nama} ({self.provinsi.nama})'


class SumberDayaAlam(models.Model):
    JENIS_CHOICES = [
        ('MANGROVE', 'Mangrove'),
        ('TERUMBU_KARANG', 'Terumbu Karang'),
        ('LAMUN', 'Padang Lamun'),
        ('IKAN', 'Sumber Daya Ikan'),
        ('MINERAL', 'Mineral Laut'),
        ('ENERGI', 'Potensi Energi Laut'),
        ('GARAM', 'Potensi Garam'),
        ('BIOTA_LAUT', 'Biota Laut Lainnya'),
    ]

    potensi = models.ForeignKey(
        PotensiInvestasi, on_delete=models.CASCADE, related_name='sumber_daya', null=True, blank=True
    )
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='sumber_daya_alam')
    jenis = models.CharField(max_length=20, choices=JENIS_CHOICES)
    nama = models.CharField(max_length=255)
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)
    luas_ha = models.FloatField(default=0)
    kondisi = models.CharField(max_length=50, blank=True, help_text='Baik/Sedang/Rusak')
    estimasi_nilai_miliar = models.FloatField(default=0)
    tahun_data = models.IntegerField(null=True, blank=True)
    sumber_data = models.CharField(max_length=100, default='KKP')
    detail_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventarisasi_sumber_daya_alam'
        ordering = ['provinsi', 'jenis']
        verbose_name_plural = 'Sumber Daya Alam'

    def __str__(self):
        return f'{self.get_jenis_display()} - {self.nama}'
