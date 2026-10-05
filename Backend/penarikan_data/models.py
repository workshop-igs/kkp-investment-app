from django.db import models


class KonfigurasiAPI(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Aktif - API Connected'),
        ('MOCK', 'Mock - Data Simulasi'),
        ('DISABLED', 'Nonaktif'),
    ]

    kode = models.CharField(max_length=20, unique=True, help_text='BIG, BPS, BMKG, KKP, BNPB')
    nama = models.CharField(max_length=100)
    base_url = models.URLField(blank=True)
    api_key_env_var = models.CharField(max_length=50, blank=True, help_text='Env var name for API key')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='MOCK')
    last_successful_fetch = models.DateTimeField(null=True, blank=True)
    fetch_interval_hours = models.IntegerField(default=2160, help_text='Default 90 days = 2160 hours')
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=3)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'penarikan_data_konfigurasi_api'
        verbose_name_plural = 'External API Configs'

    def __str__(self):
        return f'{self.kode} - {self.nama} ({self.get_status_display()})'


class LogPenarikan(models.Model):
    RESULT_CHOICES = [
        ('SUCCESS', 'Success'),
        ('PARTIAL', 'Partial'),
        ('FAILED', 'Failed'),
        ('MOCK', 'Mock Data Used'),
    ]

    api_config = models.ForeignKey(KonfigurasiAPI, on_delete=models.CASCADE, related_name='fetch_logs')
    endpoint = models.CharField(max_length=500)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    result = models.CharField(max_length=10, choices=RESULT_CHOICES)
    records_count = models.IntegerField(default=0)
    response_time_ms = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    request_params = models.JSONField(default=dict, blank=True)
    response_summary = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'penarikan_data_log_penarikan'
        ordering = ['-started_at']
        verbose_name_plural = 'Fetch Logs'

    def __str__(self):
        return f'{self.api_config.kode} @ {self.started_at} - {self.result}'


class StatistikKetenagakerjaanBPS(models.Model):
    INDIKATOR_CHOICES = [
        ('tpt', 'Tingkat Pengangguran Terbuka'),
        ('pengangguran', 'Penduduk 15+ yang Menganggur'),
    ]

    domain = models.CharField(max_length=8, db_index=True)
    indikator = models.CharField(max_length=20, choices=INDIKATOR_CHOICES)

    var_id = models.IntegerField(help_text='Nomor variabel BPS untuk domain ini')
    th_id = models.IntegerField(help_text='Nomor tahun BPS')
    tahun = models.CharField(max_length=10)

    per_wilayah = models.JSONField(default=dict, blank=True)

    diperbarui_pada = models.DateTimeField(auto_now=True)
    diperiksa_pada = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'penarikan_data_statistik_ketenagakerjaan_bps'
        verbose_name_plural = 'Statistik Ketenagakerjaan BPS'
        ordering = ['indikator', '-tahun']
        constraints = [
            models.UniqueConstraint(
                fields=['domain', 'indikator', 'tahun'],
                name='bps_domain_indikator_tahun_unik',
            )
        ]

    def __str__(self):
        return f'{self.get_indikator_display()} ({self.tahun})'


class ProduksiPerikananBPS(models.Model):
    KELOMPOK_CHOICES = [
        ('BUDIDAYA', 'Perikanan budidaya'),
        ('TANGKAP_LAUT', 'Perikanan tangkap di laut'),
    ]

    provinsi = models.ForeignKey('inti.Provinsi', on_delete=models.CASCADE, related_name='produksi_perikanan')
    kelompok = models.CharField(max_length=12, choices=KELOMPOK_CHOICES)
    komoditas = models.CharField(max_length=60)
    tahun = models.IntegerField()
    produksi_ton = models.FloatField(null=True, blank=True)
    nilai_ribu_rp = models.FloatField(null=True, blank=True)
    diperbarui_pada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'penarikan_data_produksi_perikanan_bps'
        verbose_name_plural = 'Produksi Perikanan BPS'
        constraints = [
            models.UniqueConstraint(
                fields=['provinsi', 'kelompok', 'komoditas', 'tahun'],
                name='produksi_perikanan_unik',
            )
        ]

    def __str__(self):
        return f'{self.komoditas} {self.provinsi_id} {self.tahun}'
