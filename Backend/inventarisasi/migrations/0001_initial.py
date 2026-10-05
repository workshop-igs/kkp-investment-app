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
            name='PotensiInvestasi',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama', models.CharField(help_text='Nama zona potensi investasi', max_length=255)),
                ('deskripsi', models.TextField(blank=True)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(srid=4326)),
                ('luas_ha', models.FloatField(default=0)),
                ('potensi_sumber_daya', models.TextField(blank=True, help_text='Deskripsi potensi sumber daya')),
                ('nilai_potensi_miliar', models.FloatField(default=0, help_text='Estimasi nilai potensi (Miliar Rp)')),
                ('tingkat_potensi', models.CharField(choices=[('SANGAT_TINGGI', 'Sangat Tinggi'), ('TINGGI', 'Tinggi'), ('SEDANG', 'Sedang'), ('RENDAH', 'Rendah')], default='SEDANG', max_length=15)),
                ('jarak_pelabuhan_km', models.FloatField(blank=True, help_text='Jarak ke pelabuhan terdekat (km)', null=True)),
                ('jarak_bandara_km', models.FloatField(blank=True, help_text='Jarak ke bandara terdekat (km)', null=True)),
                ('akses_jalan', models.BooleanField(default=False, help_text='Akses jalan memadai')),
                ('akses_listrik', models.BooleanField(default=False, help_text='Akses listrik tersedia')),
                ('akses_air_bersih', models.BooleanField(default=False, help_text='Akses air bersih tersedia')),
                ('skor_kelayakan', models.FloatField(blank=True, help_text='Skor kelayakan investasi (0-1)', null=True)),
                ('skor_risiko', models.FloatField(blank=True, help_text='Skor risiko (0-1, 0=rendah)', null=True)),
                ('kelas_risiko', models.CharField(blank=True, help_text='Sangat Rendah/Rendah/Sedang/Tinggi', max_length=20)),
                ('tahun_data', models.IntegerField(blank=True, null=True)),
                ('sumber_data', models.CharField(default='Inventarisasi', max_length=100)),
                ('verified', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('kabupaten_kota', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inti.kabupatenkota')),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='potensi_investasi', to='inti.provinsi')),
                ('sektor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='potensi', to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name_plural': 'Potensi Investasi',
                'db_table': 'inventarisasi_potensi_investasi',
                'ordering': ['-skor_kelayakan', 'provinsi'],
            },
        ),
        migrations.CreateModel(
            name='ZonasiRuangLaut',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama_zona', models.CharField(max_length=255)),
                ('jenis_zona', models.CharField(choices=[('ZU', 'Zona Umum'), ('ZT', 'Zona Terbatas'), ('ZL', 'Zona Lainnya'), ('ALKI', 'Alur Laut Kepulauan Indonesia'), ('KSN', 'Kawasan Strategis Nasional'), ('KST', 'Kawasan Strategis Tertentu')], default='ZU', max_length=10)),
                ('sub_zona', models.CharField(choices=[('PERIKANAN_TANGKAP', 'Sub Zona Perikanan Tangkap'), ('PERIKANAN_BUDIDAYA', 'Sub Zona Perikanan Budidaya'), ('PELAYARAN', 'Sub Zona Pelayaran'), ('ENERGI', 'Sub Zona Energi'), ('PARIWISATA', 'Sub Zona Pariwisata'), ('KONSERVASI', 'Sub Zona Konservasi'), ('PERTAMBANGAN', 'Sub Zona Pertambangan'), ('INDUSTRI', 'Sub Zona Industri'), ('LAINNYA', 'Lainnya')], default='LAINNYA', max_length=30)),
                ('nomor_regulasi', models.CharField(blank=True, help_text='No. Perpres/Perda RTR/RZ', max_length=255)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(srid=4326)),
                ('luas_ha', models.FloatField(default=0)),
                ('keterangan', models.TextField(blank=True)),
                ('tahun_penetapan', models.IntegerField(blank=True, null=True)),
                ('sumber_data', models.CharField(default='DJPRL', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='zonasi_laut', to='inti.provinsi')),
            ],
            options={
                'verbose_name_plural': 'Zonasi Ruang Laut (RTR/RZ)',
                'db_table': 'inventarisasi_zonasi_ruang_laut',
                'ordering': ['provinsi', 'jenis_zona'],
            },
        ),
        migrations.CreateModel(
            name='SumberDayaAlam',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jenis', models.CharField(choices=[('MANGROVE', 'Mangrove'), ('TERUMBU_KARANG', 'Terumbu Karang'), ('LAMUN', 'Padang Lamun'), ('IKAN', 'Sumber Daya Ikan'), ('MINERAL', 'Mineral Laut'), ('ENERGI', 'Potensi Energi Laut'), ('GARAM', 'Potensi Garam'), ('BIOTA_LAUT', 'Biota Laut Lainnya')], max_length=20)),
                ('nama', models.CharField(max_length=255)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('luas_ha', models.FloatField(default=0)),
                ('kondisi', models.CharField(blank=True, help_text='Baik/Sedang/Rusak', max_length=50)),
                ('estimasi_nilai_miliar', models.FloatField(default=0)),
                ('tahun_data', models.IntegerField(blank=True, null=True)),
                ('sumber_data', models.CharField(default='KKP', max_length=100)),
                ('detail_json', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('potensi', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='sumber_daya', to='inventarisasi.potensiinvestasi')),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sumber_daya_alam', to='inti.provinsi')),
            ],
            options={
                'verbose_name_plural': 'Sumber Daya Alam',
                'db_table': 'inventarisasi_sumber_daya_alam',
                'ordering': ['provinsi', 'jenis'],
            },
        ),
        migrations.CreateModel(
            name='ProgramKKP',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama_program', models.CharField(max_length=255)),
                ('deskripsi', models.TextField(blank=True)),
                ('unit_pelaksana', models.CharField(help_text='Direktorat/unit KKP pelaksana', max_length=255)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('anggaran_miliar', models.FloatField(default=0, help_text='Anggaran (Miliar Rp)')),
                ('tahun_mulai', models.IntegerField(blank=True, null=True)),
                ('tahun_selesai', models.IntegerField(blank=True, null=True)),
                ('status', models.CharField(choices=[('RENCANA', 'Rencana'), ('BERJALAN', 'Berjalan'), ('SELESAI', 'Selesai'), ('DIBATALKAN', 'Dibatalkan')], default='BERJALAN', max_length=15)),
                ('sumber_data', models.CharField(default='KKP', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ManyToManyField(blank=True, related_name='program_kkp', to='inti.provinsi')),
                ('sektor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name_plural': 'Program KKP',
                'db_table': 'inventarisasi_program_kkp',
                'ordering': ['-tahun_mulai', 'nama_program'],
            },
        ),
        migrations.CreateModel(
            name='KKPRL',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nomor_izin', models.CharField(max_length=100, unique=True)),
                ('nama_pemohon', models.CharField(max_length=255)),
                ('jenis_kegiatan', models.CharField(max_length=255)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('luas_ha', models.FloatField(default=0)),
                ('tanggal_terbit', models.DateField(blank=True, null=True)),
                ('tanggal_berakhir', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('AKTIF', 'Aktif'), ('BERAKHIR', 'Berakhir'), ('DICABUT', 'Dicabut'), ('PROSES', 'Dalam Proses')], default='AKTIF', max_length=10)),
                ('keterangan', models.TextField(blank=True)),
                ('sumber_data', models.CharField(default='DJPRL', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('kabupaten_kota', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inti.kabupatenkota')),
                ('provinsi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='kkprl', to='inti.provinsi')),
                ('sektor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name': 'KKPRL',
                'verbose_name_plural': 'KKPRL (Izin Pemanfaatan Ruang Laut)',
                'db_table': 'inventarisasi_kkprl',
                'ordering': ['-tanggal_terbit'],
            },
        ),
    ]
