from django.contrib.gis.db import models

from inti.models import KabupatenKota, Provinsi, SektorInvestasi


class ParameterAHP(models.Model):
    sektor = models.ForeignKey(
        SektorInvestasi,
        on_delete=models.CASCADE,
        related_name='parameter_ahp',
        null=True,
        blank=True,
        help_text='Null = parameter default untuk semua sektor',
    )
    nama_kriteria = models.CharField(max_length=100)
    kode_kriteria = models.CharField(max_length=20, help_text='e.g. FINANSIAL, RISIKO, LOKASI')
    bobot = models.FloatField(default=0.2, help_text='Bobot hasil AHP (0-1)')
    urutan = models.IntegerField(default=0)
    deskripsi = models.TextField(blank=True)

    pairwise_json = models.JSONField(
        default=dict, blank=True, help_text='Matriks perbandingan berpasangan {kriteria_lain: nilai}'
    )

    class Meta:
        db_table = 'analitik_parameter_ahp'
        ordering = ['sektor', 'urutan']
        unique_together = ['sektor', 'kode_kriteria']
        verbose_name_plural = 'Parameter AHP'

    def __str__(self):
        sektor_nama = self.sektor.nama if self.sektor else 'Default'
        return f'{self.nama_kriteria} ({sektor_nama}) = {self.bobot:.2f}'


class AnalisisKelayakan(models.Model):
    KEPUTUSAN_CHOICES = [
        ('LAYAK', 'Layak'),
        ('BERSYARAT', 'Layak Bersyarat'),
        ('TIDAK_LAYAK', 'Tidak Layak'),
    ]
    PRIORITAS_CHOICES = [
        ('TINGGI', 'Prioritas Tinggi'),
        ('SEDANG', 'Prioritas Sedang'),
        ('RENDAH', 'Prioritas Rendah'),
    ]

    nama_zona = models.CharField(max_length=255)
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='analisis_kelayakan')
    kabupaten_kota = models.ForeignKey(KabupatenKota, on_delete=models.SET_NULL, null=True, blank=True)
    sektor = models.ForeignKey(SektorInvestasi, on_delete=models.CASCADE)
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)
    luas_ha = models.FloatField(default=0)

    npv_idr = models.FloatField(default=0, help_text='Net Present Value (IDR)')
    irr_pct = models.FloatField(default=0, help_text='Internal Rate of Return (%)')
    payback_period_tahun = models.FloatField(default=0, help_text='Payback Period (tahun)')
    roi_pct = models.FloatField(default=0, help_text='Return on Investment (%)')
    sensitivitas_json = models.JSONField(
        default=dict, blank=True, help_text='Analisis sensitivitas {variabel: {perubahan_pct: npv_baru}}'
    )
    skor_finansial = models.FloatField(default=0, help_text='Skor aspek finansial (0-1)')

    risiko_pasar = models.FloatField(default=0.5, help_text='Skor risiko pasar (0-1)')
    risiko_operasional = models.FloatField(default=0.5)
    risiko_regulasi = models.FloatField(default=0.5)
    risiko_lingkungan = models.FloatField(default=0.5)
    risiko_sosial = models.FloatField(default=0.5)
    skor_risiko = models.FloatField(default=0, help_text='Skor aspek risiko komposit (0-1)')

    kesesuaian_tata_ruang = models.BooleanField(default=False)
    potensi_sumber_daya = models.FloatField(default=0.5, help_text='Skor potensi SDA (0-1)')
    aksesibilitas = models.FloatField(default=0.5, help_text='Skor aksesibilitas (0-1)')
    kondisi_sosek = models.FloatField(default=0.5, help_text='Skor sosial-ekonomi (0-1)')
    skor_lokasi = models.FloatField(default=0, help_text='Skor aspek lokasi (0-1)')

    prediksi_keuntungan_5yr = models.FloatField(default=0, help_text='Prediksi keuntungan 5 tahun (IDR)')
    skenario_terbaik_json = models.JSONField(default=dict, blank=True)
    skenario_terburuk_json = models.JSONField(default=dict, blank=True)
    forecast_json = models.JSONField(default=dict, blank=True, help_text='Forecasting berbasis data historis')
    skor_prediksi = models.FloatField(default=0, help_text='Skor aspek prediksi (0-1)')

    keputusan = models.CharField(max_length=15, choices=KEPUTUSAN_CHOICES, default='BERSYARAT')
    prioritas = models.CharField(max_length=10, choices=PRIORITAS_CHOICES, default='SEDANG')
    strategi_mitigasi = models.JSONField(default=list, blank=True, help_text='Daftar strategi mitigasi risiko')
    catatan_rekomendasi = models.TextField(blank=True)

    skor_ahp_total = models.FloatField(default=0, help_text='Skor AHP total tertimbang (0-1)')
    consistency_ratio = models.FloatField(default=0, help_text='CR dari matriks AHP (<0.1 = konsisten)')

    nilai_investasi_miliar = models.FloatField(default=0)
    tanggal_analisis = models.DateTimeField(auto_now_add=True)
    versi_model = models.CharField(max_length=20, default='1.0')
    detail_json = models.JSONField(default=dict, blank=True, help_text='Full analysis result JSON')

    class Meta:
        db_table = 'analitik_analisis_kelayakan'
        ordering = ['-tanggal_analisis']
        verbose_name_plural = 'Analisis Kelayakan'

    def __str__(self):
        return f'{self.nama_zona} - {self.get_keputusan_display()} (AHP: {self.skor_ahp_total:.2f})'


class PetaRisiko(models.Model):
    KELAS_RISIKO_CHOICES = [
        ('SANGAT_RENDAH', 'Sangat Rendah'),
        ('RENDAH', 'Rendah'),
        ('SEDANG', 'Sedang'),
        ('TINGGI', 'Tinggi'),
    ]

    nama_zona = models.CharField(max_length=255)
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='peta_risiko')
    geometry = models.MultiPolygonField(srid=4326)

    risiko_regulasi = models.FloatField(default=0.5, help_text='Overlay RTR/RZ, KKPRL (0-1)')
    risiko_lingkungan = models.FloatField(default=0.5, help_text='Indeks kesehatan ekosistem (0-1)')
    risiko_sosial = models.FloatField(default=0.5, help_text='Konflik tenurial, kemiskinan (0-1)')

    risiko_bencana_komposit = models.FloatField(default=0.5)

    skor_risiko_total = models.FloatField(default=0.5)
    kelas_risiko = models.CharField(max_length=15, choices=KELAS_RISIKO_CHOICES, default='SEDANG')

    detail_regulasi_json = models.JSONField(default=dict, blank=True)
    detail_lingkungan_json = models.JSONField(default=dict, blank=True)
    detail_sosial_json = models.JSONField(default=dict, blank=True)

    tanggal_analisis = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analitik_peta_risiko'
        ordering = ['provinsi', '-skor_risiko_total']
        verbose_name_plural = 'Peta Risiko'

    def __str__(self):
        return f'{self.nama_zona} - {self.get_kelas_risiko_display()}'


class RasterRisikoBencana(models.Model):
    JENIS_CHOICES = [
        ('TSUNAMI', 'Tsunami'),
        ('ABRASI', 'Gelombang Ekstrem & Abrasi'),
        ('BANJIR', 'Banjir'),
    ]

    VARIAN_CHOICES = [
        ('BAHAYA', 'Indeks Bahaya'),
        ('RISIKO', 'Indeks Risiko'),
    ]

    jenis = models.CharField(max_length=15, choices=JENIS_CHOICES, db_index=True)
    varian = models.CharField(
        max_length=10, choices=VARIAN_CHOICES, default='RISIKO', db_index=True
    )

    rast = models.RasterField(srid=4326, null=True)

    cakupan = models.PolygonField(srid=4326, null=True, blank=True)

    nilai_maks = models.FloatField(default=0, help_text='Nilai tertinggi di petak ini')
    sumber = models.CharField(max_length=120, default='BNPB InaRISK')
    layanan = models.CharField(max_length=120, blank=True, help_text='Nama layanan InaRISK asal')
    ditarik_pada = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analitik_raster_risiko_bencana'
        verbose_name_plural = 'Raster Risiko Bencana'
        indexes = [
            models.Index(fields=['jenis', 'varian'], name='raster_bencana_jenis_idx')
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['jenis', 'varian', 'cakupan'], name='raster_bencana_petak_unik'
            )
        ]

    def __str__(self):
        return f'{self.get_varian_display()} {self.get_jenis_display()} — petak {self.id}'


class ZonaRisikoBencana(models.Model):
    JENIS_CHOICES = RasterRisikoBencana.JENIS_CHOICES

    KELAS_CHOICES = [
        ('RENDAH', 'Rendah'),
        ('SEDANG', 'Sedang'),
        ('TINGGI', 'Tinggi'),
    ]

    jenis = models.CharField(max_length=15, choices=JENIS_CHOICES, db_index=True)

    varian = models.CharField(
        max_length=10,
        choices=RasterRisikoBencana.VARIAN_CHOICES,
        default='RISIKO',
        db_index=True,
    )

    kelas = models.CharField(max_length=10, choices=KELAS_CHOICES, db_index=True)
    geometry = models.MultiPolygonField(srid=4326)

    luas_ha = models.FloatField(default=0)

    cakupan = models.PolygonField(srid=4326, null=True, blank=True)

    sumber = models.CharField(max_length=120, default='BNPB InaRISK')
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analitik_zona_risiko_bencana'
        verbose_name_plural = 'Zona Risiko Bencana'
        ordering = ['-luas_ha']
        indexes = [
            models.Index(fields=['jenis', 'varian', 'kelas'], name='zona_bencana_jenis_idx'),
            models.Index(fields=['-luas_ha'], name='zona_bencana_luas_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['jenis', 'varian', 'kelas', 'cakupan'],
                name='zona_bencana_petak_unik',
            )
        ]

    def __str__(self):
        return f'{self.get_varian_display()} {self.get_jenis_display()} - {self.get_kelas_display()}'


class KetentuanRuang(models.Model):
    STATUS_CHOICES = [
        ('DIIZINKAN', 'Diizinkan'),
        ('BERSYARAT', 'Diizinkan bersyarat'),
        ('TIDAK_DIIZINKAN', 'Tidak diizinkan'),
    ]

    sektor = models.ForeignKey(SektorInvestasi, on_delete=models.CASCADE, related_name='ketentuan_ruang')
    sub_zona = models.CharField(max_length=30)
    provinsi = models.ForeignKey(
        Provinsi, on_delete=models.CASCADE, null=True, blank=True, related_name='ketentuan_ruang',
        help_text='Kosong = berlaku untuk semua provinsi',
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES)
    syarat = models.TextField(blank=True)
    sumber = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analitik_ketentuan_ruang'
        ordering = ['sektor', 'sub_zona']
        verbose_name_plural = 'Ketentuan Ruang'
        constraints = [
            models.UniqueConstraint(
                fields=['sektor', 'sub_zona'], condition=models.Q(provinsi__isnull=True),
                name='ketentuan_ruang_umum_unik',
            ),
            models.UniqueConstraint(
                fields=['sektor', 'sub_zona', 'provinsi'], condition=models.Q(provinsi__isnull=False),
                name='ketentuan_ruang_provinsi_unik',
            ),
        ]

    def __str__(self):
        return f'{self.sektor.kode} / {self.sub_zona}: {self.get_status_display()}'


class SkorKelayakanZona(models.Model):
    KELAS_CHOICES = [
        ('SANGAT_RENDAH', 'Sangat Rendah'),
        ('RENDAH', 'Rendah'),
        ('SEDANG', 'Sedang'),
        ('TINGGI', 'Tinggi'),
    ]

    zona = models.ForeignKey(
        'inventarisasi.ZonasiRuangLaut',
        on_delete=models.CASCADE,
        related_name='skor_kelayakan',
    )
    sektor = models.ForeignKey(SektorInvestasi, on_delete=models.CASCADE)

    skor_total = models.FloatField(db_index=True, help_text='0-1, makin tinggi makin layak')
    skor_lokasi = models.FloatField(default=0)
    skor_risiko = models.FloatField(default=0, help_text='Sudah dibalik: tinggi = risiko rendah')
    kelas = models.CharField(max_length=15, choices=KELAS_CHOICES, db_index=True)

    kelas_risiko = models.CharField(
        max_length=15, choices=KELAS_CHOICES, db_index=True, default='SEDANG',
        help_text='Kelas risiko investasi 0-1 menurut RISK_CLASS_THRESHOLDS',
    )

    kesesuaian_tr = models.BooleanField(default=False)
    status_tr = models.CharField(max_length=16, blank=True, help_text='Ketentuan tata ruang untuk sektor ini')
    sesuai_karakter = models.BooleanField(
        default=True, help_text='Ranah, kedalaman, gelombang, jarak pantai, dan ekosistem cocok dengan jenis investasi'
    )
    potensi_sda = models.FloatField(default=0.5)
    aksesibilitas = models.FloatField(default=0.5)
    kondisi_sosek = models.FloatField(default=0.5)
    jarak_infra_km = models.FloatField(null=True, blank=True, help_text='Ke infrastruktur terdekat')

    risiko_bencana = models.FloatField(default=0.4)
    risiko_regulasi = models.FloatField(default=0.4)

    sensitivitas_ekosistem = models.FloatField(
        null=True, blank=True, help_text='0-1; makin sehat & luas ekosistemnya, makin tinggi'
    )
    ekosistem_rincian = models.CharField(
        max_length=255, blank=True, help_text='Jenis & kondisi ekosistem yang beririsan'
    )
    sumber_lingkungan = models.CharField(
        max_length=40,
        default='NETRAL',
        help_text="Komponen risiko lingkungan yang benar-benar berdata: 'ekosistem', 'bencana', atau keduanya",
    )
    jumlah_kkprl = models.IntegerField(default=0, help_text='Izin aktif yang tumpang tindih')

    risiko_sosial = models.FloatField(
        null=True, blank=True, help_text='0-1; 1 = paling berisiko secara sosial'
    )
    rasio_dtks = models.FloatField(
        null=True, blank=True, help_text='Penduduk DTKS desil 1-4 / jumlah penduduk kab/kota'
    )
    rasio_nelayan = models.FloatField(
        null=True, blank=True, help_text='Jumlah nelayan / jumlah penduduk kab/kota'
    )
    wilayah_adat = models.BooleanField(
        default=False, help_text='Beririsan wilayah kelola masyarakat hukum adat'
    )
    sumber_sosial = models.CharField(
        max_length=40,
        default='NETRAL',
        help_text="Komponen risiko sosial yang berdata: 'kemiskinan', 'tenurial', atau keduanya",
    )

    sumber_sosek = models.CharField(
        max_length=40,
        default='NETRAL',
        help_text="'KKP' bila dari data kab/kota, 'NETRAL' bila belum tersedia",
    )
    dihitung_pada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analitik_skor_kelayakan_zona'
        verbose_name_plural = 'Skor Kelayakan Zona'
        ordering = ['-skor_total']
        constraints = [
            models.UniqueConstraint(fields=['zona', 'sektor'], name='skor_zona_sektor_unik'),
        ]
        indexes = [
            models.Index(fields=['sektor', '-skor_total'], name='skor_zona_sektor_idx'),
            models.Index(fields=['sektor', 'kelas'], name='skor_zona_kelas_idx'),
        ]

    def __str__(self):
        return f'{self.zona_id} / {self.sektor_id}: {self.skor_total:.2f} ({self.kelas})'


class LokasiPotensial(models.Model):
    sektor = models.ForeignKey(
        SektorInvestasi, on_delete=models.CASCADE, null=True, blank=True,
        help_text='Kosong = gabungan semua jenis untuk tampilan awal peta',
    )
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE)
    geometry = models.MultiPolygonField(srid=4326)
    luas_ha = models.FloatField()
    persen_sesuai = models.FloatField(help_text='Rata-rata persentase parameter terukur yang sangat sesuai, 0-100')
    jenis = models.JSONField(default=list, help_text='Kode jenis investasi yang cocok di lokasi ini')
    rincian = models.JSONField(default=dict, help_text='Ringkasan parameter dan zona untuk popup peta')
    dihitung_pada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analitik_lokasi_potensial'
        verbose_name_plural = 'Lokasi Potensial'
        ordering = ['-persen_sesuai']

    def __str__(self):
        return f'{self.sektor_id or "SEMUA"} / {self.provinsi_id}: {self.luas_ha:.1f} ha ({self.persen_sesuai:.0f}%)'


class RasterOseanografi(models.Model):
    PARAMETER_CHOICES = [
        ('KEDALAMAN', 'Kedalaman laut'),
        ('SUHU', 'Suhu permukaan laut'),
        ('ANOMALI_SUHU', 'Anomali suhu permukaan laut'),
        ('KLOROFIL', 'Klorofil-a'),
        ('GELOMBANG', 'Tinggi gelombang signifikan'),
    ]

    parameter = models.CharField(max_length=15, choices=PARAMETER_CHOICES, db_index=True)
    rast = models.RasterField(srid=4326)
    cakupan = models.PolygonField(srid=4326)
    satuan = models.CharField(max_length=20)
    periode = models.CharField(max_length=80, blank=True)
    sumber = models.CharField(max_length=200)
    ditarik_pada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analitik_raster_oseanografi'
        verbose_name_plural = 'Raster Oseanografi'
        constraints = [
            models.UniqueConstraint(fields=['parameter', 'cakupan'], name='raster_oseanografi_petak_unik'),
        ]

    def __str__(self):
        return f'{self.get_parameter_display()} — petak {self.id}'
