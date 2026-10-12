from django.contrib.auth.models import User
from django.contrib.gis.db import models

from inti.models import KabupatenKota, Provinsi, SektorInvestasi


class ProyekInvestasi(models.Model):
    STATUS_CHOICES = [
        ('PERENCANAAN', 'Perencanaan'),
        ('PENYIAPAN', 'Penyiapan'),
        ('TRANSAKSI', 'Transaksi'),
        ('KONSTRUKSI', 'Konstruksi'),
        ('OPERASI', 'Operasi'),
    ]

    kode_proyek = models.CharField(max_length=20, unique=True, help_text='Auto-generated: PRJ-XXXX')
    nama = models.CharField(max_length=255)
    deskripsi = models.TextField(blank=True)
    investor = models.CharField(max_length=255, blank=True)

    provinsi = models.ForeignKey(
        Provinsi,
        on_delete=models.SET_NULL,
        related_name='proyek_investasi',
        null=True,
        blank=True,
        help_text='Kosong = perairan nasional / di luar kewenangan provinsi',
    )
    kabupaten_kota = models.ForeignKey(KabupatenKota, on_delete=models.SET_NULL, null=True, blank=True)
    lokasi_detail = models.CharField(max_length=255, blank=True)
    geometry = models.MultiPolygonField(srid=4326, null=True, blank=True)
    luas_ha = models.FloatField(default=0)

    sektor = models.ForeignKey(
        SektorInvestasi, on_delete=models.SET_NULL, related_name='proyek', null=True, blank=True
    )
    nilai_investasi_miliar = models.FloatField(default=0)
    nilai_realisasi_miliar = models.FloatField(default=0, help_text='Realisasi investasi aktual')

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PERENCANAAN')
    tanggal_mulai = models.DateField(null=True, blank=True)
    tanggal_target_selesai = models.DateField(null=True, blank=True)
    progress_pct = models.FloatField(default=0, help_text='Persentase progress (0-100)')

    proyeksi_tenaga_kerja = models.IntegerField(default=0)
    realisasi_tenaga_kerja = models.IntegerField(default=0)

    skor_kelayakan = models.FloatField(null=True, blank=True)
    skor_risiko = models.FloatField(null=True, blank=True)
    analisis_json = models.JSONField(default=dict, blank=True, help_text='Snapshot hasil analisis terakhir')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pipeline_proyek_investasi'
        ordering = ['-created_at']
        verbose_name_plural = 'Proyek Investasi'

    def __str__(self):
        return f'{self.kode_proyek} - {self.nama}'

    URUTAN_KODE = 'pipeline_kode_proyek_seq'

    @classmethod
    def _kode_berikutnya(cls) -> str:
        from django.db import connection

        with connection.cursor() as c:
            c.execute(f"SELECT nextval('{cls.URUTAN_KODE}')")
            return f'PRJ-{c.fetchone()[0]:04d}'

    def _catat_riwayat(self, is_new: bool, old_status) -> None:
        catatan = getattr(self, '_history_catatan', None)
        user = getattr(self, '_history_user', self.created_by if is_new else None)
        label = dict(self.STATUS_CHOICES)

        if is_new:
            RiwayatStatus.objects.create(
                proyek=self,
                status_lama='-',
                status_baru=self.status,
                catatan=catatan
                or (
                    f'Proyek didaftarkan ke daftar Proyek Investasi pada tahap '
                    f'{label.get(self.status, self.status)}.'
                ),
                diubah_oleh=user,
            )
        elif old_status and old_status != self.status:
            RiwayatStatus.objects.create(
                proyek=self,
                status_lama=old_status,
                status_baru=self.status,
                catatan=catatan
                or (
                    f'Tahap proyek diperbarui dari {label.get(old_status, old_status)} '
                    f'ke {label.get(self.status, self.status)}.'
                ),
                diubah_oleh=user,
            )
        elif catatan:
            RiwayatStatus.objects.create(
                proyek=self,
                status_lama=self.status,
                status_baru=self.status,
                catatan=catatan,
                diubah_oleh=user,
            )

    def save(self, *args, **kwargs):
        from django.db import transaction

        is_new = self.pk is None

        old_status = (
            None
            if is_new
            else ProyekInvestasi.objects.filter(pk=self.pk)
            .values_list('status', flat=True)
            .first()
        )

        with transaction.atomic():
            if not self.kode_proyek:
                self.kode_proyek = self._kode_berikutnya()
            super().save(*args, **kwargs)
            self._catat_riwayat(is_new, old_status)


class RiwayatStatus(models.Model):
    proyek = models.ForeignKey(ProyekInvestasi, on_delete=models.CASCADE, related_name='riwayat_status')
    status_lama = models.CharField(max_length=50)
    status_baru = models.CharField(max_length=50)
    tanggal = models.DateTimeField(auto_now_add=True)
    catatan = models.TextField(blank=True)
    diubah_oleh = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'pipeline_riwayat_status'
        ordering = ['-tanggal']
        verbose_name_plural = 'Riwayat Tahap Proyek'

    def __str__(self):
        return f'{self.proyek.kode_proyek}: {self.status_lama} → {self.status_baru} ({self.tanggal})'


class RekapRealisasi(models.Model):
    provinsi = models.ForeignKey(Provinsi, on_delete=models.CASCADE, related_name='rekap_realisasi')
    sektor = models.ForeignKey(SektorInvestasi, on_delete=models.CASCADE, related_name='rekap_realisasi')
    tahun = models.IntegerField()

    jumlah_proyek = models.IntegerField(default=0)
    total_rencana_miliar = models.FloatField(default=0)
    total_realisasi_miliar = models.FloatField(default=0)
    total_tenaga_kerja = models.IntegerField(default=0)
    pct_realisasi = models.FloatField(default=0, help_text='% realisasi terhadap rencana')

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pipeline_rekap_realisasi'
        ordering = ['-tahun', 'provinsi']
        unique_together = ['provinsi', 'sektor', 'tahun']
        verbose_name_plural = 'Rekap Realisasi'

    def __str__(self):
        return f'Rekap {self.sektor.nama} - {self.provinsi.nama} ({self.tahun})'
