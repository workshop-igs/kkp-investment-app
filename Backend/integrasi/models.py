from django.db import models


class SinkronisasiDJPRL(models.Model):
    DIRECTION_CHOICES = [
        ('PUSH', 'Push ke DJPRL'),
        ('PULL', 'Pull dari DJPRL'),
        ('BOTH', 'Bidirectional'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Menunggu'),
        ('SYNCING', 'Sedang Sinkronisasi'),
        ('SUCCESS', 'Berhasil'),
        ('FAILED', 'Gagal'),
        ('MOCK', 'Mock Mode'),
    ]

    nama_dataset = models.CharField(max_length=255)
    direction = models.CharField(max_length=5, choices=DIRECTION_CHOICES, default='PULL')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='MOCK')
    endpoint_url = models.URLField(blank=True)
    last_sync = models.DateTimeField(null=True, blank=True)
    records_synced = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    config_json = models.JSONField(default=dict, blank=True, help_text='Mapping & transformation config')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'integrasi_sinkronisasi_djprl'
        ordering = ['-last_sync']
        verbose_name_plural = 'DJPRL Sync Config'

    def __str__(self):
        return f'{self.nama_dataset} ({self.get_direction_display()}) - {self.get_status_display()}'
