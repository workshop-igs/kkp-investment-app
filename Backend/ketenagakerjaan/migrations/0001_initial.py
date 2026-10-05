from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('inti', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProyeksiTenagaKerja',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama_proyek', models.CharField(max_length=255)),
                ('nilai_investasi_miliar', models.FloatField(default=0)),
                ('rasio_tk_per_miliar', models.FloatField(default=20.0, help_text='Rasio TK/Miliar Rp untuk sektor ini')),
                ('total_tenaga_kerja', models.IntegerField(default=0)),
                ('tk_langsung', models.IntegerField(default=0, help_text='Tenaga kerja langsung')),
                ('tk_tidak_langsung', models.IntegerField(default=0, help_text='Tenaga kerja tidak langsung')),
                ('tk_terampil', models.IntegerField(default=0, help_text='TK terampil dibutuhkan')),
                ('tk_non_terampil', models.IntegerField(default=0, help_text='TK non-terampil dibutuhkan')),
                ('tk_lokal_tersedia', models.IntegerField(default=0, help_text='TK lokal yg memenuhi kualifikasi')),
                ('gap_tk', models.IntegerField(default=0, help_text='Kekurangan TK lokal')),
                ('detail_json', models.JSONField(blank=True, default=dict)),
                ('tanggal_proyeksi', models.DateTimeField(auto_now_add=True)),
                ('kabupaten_kota', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inti.kabupatenkota')),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='proyeksi_tk', to='inti.provinsi')),
                ('sektor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name_plural': 'Proyeksi Tenaga Kerja',
                'db_table': 'ketenagakerjaan_proyeksi',
                'ordering': ['-tanggal_proyeksi'],
            },
        ),
        migrations.CreateModel(
            name='KebutuhanPelatihan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jenis_keahlian', models.CharField(help_text='Jenis keahlian yang dibutuhkan', max_length=255)),
                ('jumlah_peserta', models.IntegerField(default=0, help_text='Jumlah peserta pelatihan dibutuhkan')),
                ('durasi_bulan', models.IntegerField(default=3, help_text='Estimasi durasi pelatihan (bulan)')),
                ('prioritas', models.CharField(choices=[('TINGGI', 'Tinggi'), ('SEDANG', 'Sedang'), ('RENDAH', 'Rendah')], default='SEDANG', max_length=10)),
                ('estimasi_biaya_juta', models.FloatField(default=0, help_text='Estimasi biaya pelatihan (Juta Rp)')),
                ('lembaga_pelatihan', models.CharField(blank=True, help_text='Lembaga pelatihan potensial', max_length=255)),
                ('keterangan', models.TextField(blank=True)),
                ('proyeksi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='kebutuhan_pelatihan', to='ketenagakerjaan.proyeksitenagakerja')),
            ],
            options={
                'verbose_name_plural': 'Kebutuhan Pelatihan',
                'db_table': 'ketenagakerjaan_kebutuhan_pelatihan',
                'ordering': ['proyeksi', 'prioritas'],
            },
        ),
        migrations.CreateModel(
            name='ProfilTenagaKerja',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tahun_data', models.IntegerField(default=2024)),
                ('angkatan_kerja', models.IntegerField(default=0)),
                ('tingkat_pengangguran_pct', models.FloatField(default=0)),
                ('tingkat_partisipasi_pct', models.FloatField(default=0)),
                ('pct_sd_smp', models.FloatField(default=0, help_text='% pendidikan SD-SMP')),
                ('pct_sma_smk', models.FloatField(default=0, help_text='% pendidikan SMA/SMK')),
                ('pct_diploma', models.FloatField(default=0, help_text='% pendidikan Diploma')),
                ('pct_sarjana', models.FloatField(default=0, help_text='% pendidikan S1+')),
                ('pct_nelayan', models.FloatField(default=0, help_text='% nelayan')),
                ('pct_petambak', models.FloatField(default=0, help_text='% petambak')),
                ('pct_industri', models.FloatField(default=0, help_text='% pekerja industri')),
                ('pct_jasa', models.FloatField(default=0, help_text='% pekerja jasa/pariwisata')),
                ('pct_lainnya', models.FloatField(default=0)),
                ('memiliki_sertifikat_pelaut', models.IntegerField(default=0)),
                ('memiliki_keahlian_budidaya', models.IntegerField(default=0)),
                ('memiliki_keahlian_pengolahan', models.IntegerField(default=0)),
                ('sumber_data', models.CharField(default='BPS', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('kabupaten_kota', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='profil_tk', to='inti.kabupatenkota')),
            ],
            options={
                'verbose_name_plural': 'Profil Tenaga Kerja',
                'db_table': 'ketenagakerjaan_profil_tk',
                'ordering': ['kabupaten_kota', '-tahun_data'],
                'unique_together': {('kabupaten_kota', 'tahun_data')},
            },
        ),
    ]
