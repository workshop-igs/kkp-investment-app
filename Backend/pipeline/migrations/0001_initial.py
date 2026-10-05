from django.conf import settings
import django.contrib.gis.db.models.fields
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('inti', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProyekInvestasi',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kode_proyek', models.CharField(help_text='Auto-generated: PRJ-XXXX', max_length=20, unique=True)),
                ('nama', models.CharField(max_length=255)),
                ('deskripsi', models.TextField(blank=True)),
                ('investor', models.CharField(blank=True, max_length=255)),
                ('lokasi_detail', models.CharField(blank=True, max_length=255)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('luas_ha', models.FloatField(default=0)),
                ('nilai_investasi_miliar', models.FloatField(default=0)),
                ('nilai_realisasi_miliar', models.FloatField(default=0, help_text='Realisasi investasi aktual')),
                ('status', models.CharField(choices=[('LOI', 'Letter of Intent'), ('MOU', 'MoU / Kesepakatan'), ('FS', 'Feasibility Study'), ('PERIZINAN', 'Perizinan & AMDAL'), ('KONSTRUKSI', 'Konstruksi'), ('OPERASIONAL', 'Operasional'), ('DITANGGUHKAN', 'Ditangguhkan'), ('DIBATALKAN', 'Dibatalkan')], default='LOI', max_length=15)),
                ('tanggal_mulai', models.DateField(blank=True, null=True)),
                ('tanggal_target_selesai', models.DateField(blank=True, null=True)),
                ('progress_pct', models.FloatField(default=0, help_text='Persentase progress (0-100)')),
                ('proyeksi_tenaga_kerja', models.IntegerField(default=0)),
                ('realisasi_tenaga_kerja', models.IntegerField(default=0)),
                ('skor_kelayakan', models.FloatField(blank=True, null=True)),
                ('skor_risiko', models.FloatField(blank=True, null=True)),
                ('analisis_json', models.JSONField(blank=True, default=dict, help_text='Snapshot hasil analisis terakhir')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('kabupaten_kota', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inti.kabupatenkota')),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='proyek_investasi', to='inti.provinsi')),
                ('sektor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='proyek', to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name_plural': 'Proyek Investasi',
                'db_table': 'pipeline_proyek_investasi',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='StatusHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status_lama', models.CharField(max_length=15)),
                ('status_baru', models.CharField(max_length=15)),
                ('tanggal', models.DateTimeField(auto_now_add=True)),
                ('catatan', models.TextField(blank=True)),
                ('diubah_oleh', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('proyek', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='status_history', to='pipeline.proyekinvestasi')),
            ],
            options={
                'verbose_name_plural': 'Status History',
                'db_table': 'pipeline_status_history',
                'ordering': ['-tanggal'],
            },
        ),
        migrations.CreateModel(
            name='RekapRealisasi',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tahun', models.IntegerField()),
                ('jumlah_proyek', models.IntegerField(default=0)),
                ('total_rencana_miliar', models.FloatField(default=0)),
                ('total_realisasi_miliar', models.FloatField(default=0)),
                ('total_tenaga_kerja', models.IntegerField(default=0)),
                ('pct_realisasi', models.FloatField(default=0, help_text='% realisasi terhadap rencana')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rekap_realisasi', to='inti.provinsi')),
                ('sektor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rekap_realisasi', to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name_plural': 'Rekap Realisasi',
                'db_table': 'pipeline_rekap_realisasi',
                'ordering': ['-tahun', 'provinsi'],
                'unique_together': {('provinsi', 'sektor', 'tahun')},
            },
        ),
    ]
