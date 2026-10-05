import django.contrib.gis.db.models.fields
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('inti', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='RisikoBencana',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jenis_bencana', models.CharField(choices=[('TSUNAMI', 'Tsunami'), ('BANJIR_ROB', 'Banjir Rob'), ('ABRASI', 'Abrasi'), ('GEMPA', 'Gempa Bumi'), ('GELOMBANG', 'Gelombang Ekstrem')], max_length=15)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('kelas_risiko', models.CharField(choices=[('SANGAT_RENDAH', 'Sangat Rendah'), ('RENDAH', 'Rendah'), ('SEDANG', 'Sedang'), ('TINGGI', 'Tinggi')], default='SEDANG', max_length=15)),
                ('skor_risiko', models.FloatField(default=0.5, help_text='Skor risiko (0-1)')),
                ('sumber_data', models.CharField(default='BMKG/BNPB', max_length=100)),
                ('tahun_data', models.IntegerField(blank=True, null=True)),
                ('detail_json', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='risiko_bencana', to='inti.provinsi')),
            ],
            options={
                'verbose_name_plural': 'Risiko Bencana',
                'db_table': 'analitik_risiko_bencana',
                'ordering': ['provinsi', 'jenis_bencana'],
            },
        ),
        migrations.CreateModel(
            name='PetaRisiko',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama_zona', models.CharField(max_length=255)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(srid=4326)),
                ('risiko_regulasi', models.FloatField(default=0.5, help_text='Overlay RTR/RZ, KKPRL (0-1)')),
                ('risiko_lingkungan', models.FloatField(default=0.5, help_text='Indeks kesehatan ekosistem (0-1)')),
                ('risiko_sosial', models.FloatField(default=0.5, help_text='Konflik tenurial, kemiskinan (0-1)')),
                ('risiko_bencana_komposit', models.FloatField(default=0.5)),
                ('skor_risiko_total', models.FloatField(default=0.5)),
                ('kelas_risiko', models.CharField(choices=[('SANGAT_RENDAH', 'Sangat Rendah'), ('RENDAH', 'Rendah'), ('SEDANG', 'Sedang'), ('TINGGI', 'Tinggi')], default='SEDANG', max_length=15)),
                ('detail_regulasi_json', models.JSONField(blank=True, default=dict)),
                ('detail_lingkungan_json', models.JSONField(blank=True, default=dict)),
                ('detail_sosial_json', models.JSONField(blank=True, default=dict)),
                ('tanggal_analisis', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='peta_risiko', to='inti.provinsi')),
            ],
            options={
                'verbose_name_plural': 'Peta Risiko',
                'db_table': 'analitik_peta_risiko',
                'ordering': ['provinsi', '-skor_risiko_total'],
            },
        ),
        migrations.CreateModel(
            name='AnalisisKelayakan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama_zona', models.CharField(max_length=255)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('luas_ha', models.FloatField(default=0)),
                ('npv_idr', models.FloatField(default=0, help_text='Net Present Value (IDR)')),
                ('irr_pct', models.FloatField(default=0, help_text='Internal Rate of Return (%)')),
                ('payback_period_tahun', models.FloatField(default=0, help_text='Payback Period (tahun)')),
                ('roi_pct', models.FloatField(default=0, help_text='Return on Investment (%)')),
                ('sensitivitas_json', models.JSONField(blank=True, default=dict, help_text='Analisis sensitivitas {variabel: {perubahan_pct: npv_baru}}')),
                ('skor_finansial', models.FloatField(default=0, help_text='Skor aspek finansial (0-1)')),
                ('risiko_pasar', models.FloatField(default=0.5, help_text='Skor risiko pasar (0-1)')),
                ('risiko_operasional', models.FloatField(default=0.5)),
                ('risiko_regulasi', models.FloatField(default=0.5)),
                ('risiko_lingkungan', models.FloatField(default=0.5)),
                ('risiko_sosial', models.FloatField(default=0.5)),
                ('skor_risiko', models.FloatField(default=0, help_text='Skor aspek risiko komposit (0-1)')),
                ('kesesuaian_tata_ruang', models.BooleanField(default=False)),
                ('potensi_sumber_daya', models.FloatField(default=0.5, help_text='Skor potensi SDA (0-1)')),
                ('aksesibilitas', models.FloatField(default=0.5, help_text='Skor aksesibilitas (0-1)')),
                ('kondisi_sosek', models.FloatField(default=0.5, help_text='Skor sosial-ekonomi (0-1)')),
                ('skor_lokasi', models.FloatField(default=0, help_text='Skor aspek lokasi (0-1)')),
                ('prediksi_keuntungan_5yr', models.FloatField(default=0, help_text='Prediksi keuntungan 5 tahun (IDR)')),
                ('skenario_terbaik_json', models.JSONField(blank=True, default=dict)),
                ('skenario_terburuk_json', models.JSONField(blank=True, default=dict)),
                ('forecast_json', models.JSONField(blank=True, default=dict, help_text='Forecasting berbasis data historis')),
                ('skor_prediksi', models.FloatField(default=0, help_text='Skor aspek prediksi (0-1)')),
                ('keputusan', models.CharField(choices=[('LAYAK', 'Layak'), ('BERSYARAT', 'Layak Bersyarat'), ('TIDAK_LAYAK', 'Tidak Layak')], default='BERSYARAT', max_length=15)),
                ('prioritas', models.CharField(choices=[('TINGGI', 'Prioritas Tinggi'), ('SEDANG', 'Prioritas Sedang'), ('RENDAH', 'Prioritas Rendah')], default='SEDANG', max_length=10)),
                ('strategi_mitigasi', models.JSONField(blank=True, default=list, help_text='Daftar strategi mitigasi risiko')),
                ('catatan_rekomendasi', models.TextField(blank=True)),
                ('skor_ahp_total', models.FloatField(default=0, help_text='Skor AHP total tertimbang (0-1)')),
                ('consistency_ratio', models.FloatField(default=0, help_text='CR dari matriks AHP (<0.1 = konsisten)')),
                ('nilai_investasi_miliar', models.FloatField(default=0)),
                ('tanggal_analisis', models.DateTimeField(auto_now_add=True)),
                ('versi_model', models.CharField(default='1.0', max_length=20)),
                ('detail_json', models.JSONField(blank=True, default=dict, help_text='Full analysis result JSON')),
                ('kabupaten_kota', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inti.kabupatenkota')),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='analisis_kelayakan', to='inti.provinsi')),
                ('sektor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name_plural': 'Analisis Kelayakan',
                'db_table': 'analitik_analisis_kelayakan',
                'ordering': ['-tanggal_analisis'],
            },
        ),
        migrations.CreateModel(
            name='ParameterAHP',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama_kriteria', models.CharField(max_length=100)),
                ('kode_kriteria', models.CharField(help_text='e.g. FINANSIAL, RISIKO, LOKASI', max_length=20)),
                ('bobot', models.FloatField(default=0.2, help_text='Bobot hasil AHP (0-1)')),
                ('urutan', models.IntegerField(default=0)),
                ('deskripsi', models.TextField(blank=True)),
                ('pairwise_json', models.JSONField(blank=True, default=dict, help_text='Matriks perbandingan berpasangan {kriteria_lain: nilai}')),
                ('sektor', models.ForeignKey(blank=True, help_text='Null = parameter default untuk semua sektor', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='parameter_ahp', to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name_plural': 'Parameter AHP',
                'db_table': 'analitik_parameter_ahp',
                'ordering': ['sektor', 'urutan'],
                'unique_together': {('sektor', 'kode_kriteria')},
            },
        ),
    ]
