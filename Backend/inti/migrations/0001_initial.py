from django.conf import settings
import django.contrib.gis.db.models.fields
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DataSource',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kode', models.CharField(max_length=20, unique=True)),
                ('nama', models.CharField(max_length=100)),
                ('deskripsi', models.TextField(blank=True)),
                ('tipe', models.CharField(choices=[('API', 'REST API'), ('WMS', 'WMS Service'), ('WFS', 'WFS Service'), ('WCS', 'WCS Service'), ('FILE', 'Static File'), ('DB', 'Database')], default='API', max_length=20)),
                ('base_url', models.URLField(blank=True)),
                ('api_key_env', models.CharField(blank=True, help_text='Nama environment variable untuk API key', max_length=50)),
                ('status', models.CharField(choices=[('ACTIVE', 'Aktif'), ('MOCK', 'Mock/Simulasi'), ('INACTIVE', 'Tidak Aktif'), ('ERROR', 'Error')], default='MOCK', max_length=10)),
                ('last_sync', models.DateTimeField(blank=True, null=True)),
                ('sync_interval_days', models.IntegerField(default=90, help_text='Interval sinkronisasi data (hari)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'Data Sources',
                'db_table': 'core_data_source',
                'ordering': ['nama'],
            },
        ),
        migrations.CreateModel(
            name='Provinsi',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kode_bps', models.CharField(help_text='Kode BPS provinsi', max_length=10, unique=True)),
                ('nama', models.CharField(max_length=100)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('luas_laut_km2', models.FloatField(default=0, help_text='Luas wilayah laut (km²)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'Provinsi',
                'db_table': 'core_provinsi',
                'ordering': ['kode_bps'],
            },
        ),
        migrations.CreateModel(
            name='SektorInvestasi',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kode', models.CharField(max_length=20, unique=True)),
                ('nama', models.CharField(max_length=100)),
                ('deskripsi', models.TextField(blank=True)),
                ('ikon', models.CharField(blank=True, help_text='Icon identifier for frontend', max_length=50)),
                ('warna', models.CharField(default='#0ea5e9', help_text='Hex color for map display', max_length=7)),
                ('rasio_tk_per_miliar', models.FloatField(default=20.0, help_text='Rasio penyerapan tenaga kerja per Rp 1 Miliar investasi')),
                ('aktif', models.BooleanField(default=True)),
                ('urutan', models.IntegerField(default=0, help_text='Urutan tampil di UI')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name_plural': 'Sektor Investasi',
                'db_table': 'core_sektor_investasi',
                'ordering': ['urutan', 'nama'],
            },
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('PUSAT', 'Pemerintah Pusat'), ('DAERAH', 'Pemerintah Daerah'), ('AKADEMISI', 'Akademisi'), ('INVESTOR', 'Pelaku Usaha / Investor'), ('PUBLIK', 'Masyarakat Umum')], default='PUBLIK', max_length=20)),
                ('instansi', models.CharField(blank=True, help_text='Nama instansi/perusahaan', max_length=255)),
                ('telepon', models.CharField(blank=True, max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(blank=True, help_text='Provinsi terkait (untuk Pemda)', null=True, on_delete=django.db.models.deletion.SET_NULL, to='inti.provinsi')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name_plural': 'User Profiles',
                'db_table': 'core_user_profile',
            },
        ),
        migrations.CreateModel(
            name='KabupatenKota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kode_bps', models.CharField(help_text='Kode BPS kab/kota', max_length=10, unique=True)),
                ('nama', models.CharField(max_length=100)),
                ('jenis', models.CharField(choices=[('KAB', 'Kabupaten'), ('KOTA', 'Kota')], default='KAB', max_length=4)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('pesisir', models.BooleanField(default=False, help_text='Apakah kab/kota pesisir')),
                ('jumlah_penduduk', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='kabupaten_kota', to='inti.provinsi')),
            ],
            options={
                'verbose_name_plural': 'Kabupaten/Kota',
                'db_table': 'core_kabupaten_kota',
                'ordering': ['provinsi', 'kode_bps'],
            },
        ),
        migrations.CreateModel(
            name='DataSyncLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('result', models.CharField(choices=[('SUCCESS', 'Berhasil'), ('PARTIAL', 'Sebagian Berhasil'), ('FAILED', 'Gagal')], default='SUCCESS', max_length=10)),
                ('records_fetched', models.IntegerField(default=0)),
                ('records_updated', models.IntegerField(default=0)),
                ('error_message', models.TextField(blank=True)),
                ('details_json', models.JSONField(blank=True, default=dict)),
                ('data_source', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sync_logs', to='inti.datasource')),
            ],
            options={
                'verbose_name_plural': 'Data Sync Logs',
                'db_table': 'core_data_sync_log',
                'ordering': ['-started_at'],
            },
        ),
    ]
