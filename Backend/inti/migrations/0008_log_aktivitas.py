from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('inti', '0007_perbaiki_nama_provinsi_papua'),
    ]

    operations = [
        migrations.CreateModel(
            name='LogAktivitas',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama_pengguna', models.CharField(blank=True, help_text='Disalin saat kejadian; tetap ada bila akun dihapus', max_length=150)),
                ('aksi', models.CharField(choices=[('MASUK', 'Masuk'), ('KELUAR', 'Keluar'), ('DAFTAR', 'Pendaftaran akun'), ('BUAT', 'Membuat data'), ('UBAH', 'Mengubah data'), ('HAPUS', 'Menghapus data'), ('ANALISIS', 'Menjalankan analisis'), ('DITOLAK', 'Ditolak sistem')], db_index=True, max_length=10)),
                ('metode', models.CharField(blank=True, max_length=10)),
                ('jalur', models.CharField(blank=True, max_length=255)),
                ('objek', models.CharField(blank=True, help_text='Sasaran perbuatan, mis. "Proyek #12"', max_length=120)),
                ('ringkasan', models.CharField(blank=True, max_length=255)),
                ('kode_status', models.IntegerField(blank=True, null=True)),
                ('alamat_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('agen', models.CharField(blank=True, help_text='User-Agent, dipangkas', max_length=200)),
                ('waktu', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('pengguna', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='log_aktivitas', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Log Aktivitas Pengguna',
                'verbose_name_plural': 'Log Aktivitas Pengguna',
                'db_table': 'inti_log_aktivitas',
                'ordering': ['-waktu'],
                'indexes': [models.Index(fields=['-waktu', 'aksi'], name='log_aktivitas_waktu_aksi_idx')],
            },
        ),
    ]
