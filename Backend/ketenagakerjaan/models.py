from django.db import models

from inti.models import SektorInvestasi


class KalibrasiPelatihanSektor(models.Model):
    sektor = models.OneToOneField(
        SektorInvestasi,
        on_delete=models.CASCADE,
        related_name='kalibrasi_pelatihan',
        help_text='Sektor investasi terkait',
    )
    dikalibrasi_oleh = models.CharField(
        max_length=120, blank=True, default='',
        help_text='Sumber kalibrasi, mis. "Pusdiklat KKP 2026". Kosong = masih asumsi.',
    )

    class Meta:
        db_table = 'ketenagakerjaan_kalibrasi_pelatihan'
        verbose_name = 'Kalibrasi Pelatihan Sektor'
        verbose_name_plural = 'Kalibrasi Pelatihan Sektor'

    def __str__(self):
        sumber = self.dikalibrasi_oleh or 'asumsi'
        return f'{self.sektor.nama} ({sumber})'


class MatriksKeahlianSektor(models.Model):
    PRIORITAS_CHOICES = [
        ('TINGGI', 'Tinggi'),
        ('SEDANG', 'Sedang'),
        ('RENDAH', 'Rendah'),
    ]

    labor_coefficient = models.ForeignKey(
        KalibrasiPelatihanSektor, on_delete=models.CASCADE, related_name='skill_matrix'
    )
    nama_posisi = models.CharField(
        max_length=255, help_text="Nama posisi/keahlian, e.g. 'Teknisi Budidaya Rumput Laut'"
    )
    pct_demand = models.FloatField(
        default=0.0,
        help_text='Bagian tenaga kerja proyek yang menempati posisi ini (0,0-1,0). '
                  'Jumlah seluruh baris satu sektor harus <= 1.',
    )
    prioritas = models.CharField(max_length=10, choices=PRIORITAS_CHOICES, default='SEDANG')
    lembaga_pelatihan_rekomendasi = models.CharField(
        max_length=255, blank=True, help_text='Lembaga pelatihan yang direkomendasikan'
    )
    durasi_pelatihan_bulan = models.IntegerField(default=3, help_text='Estimasi durasi pelatihan (bulan)')
    estimasi_biaya_per_orang_juta = models.FloatField(
        default=5.0, help_text='Estimasi biaya pelatihan per orang (juta Rp)'
    )
    skema_sertifikasi = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Skema sertifikasi/kompetensi yang dituju, mis. "LSP Budidaya Perikanan"',
    )

    class Meta:
        db_table = 'ketenagakerjaan_matriks_keahlian_sektor'
        ordering = ['labor_coefficient', '-pct_demand']
        verbose_name = 'Matriks Keahlian Sektor'
        verbose_name_plural = 'Matriks Keahlian Sektor'

    def __str__(self):
        return f'{self.nama_posisi} ({self.pct_demand * 100:.0f}%)'
