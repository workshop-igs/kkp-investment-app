from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('penarikan_data', '0002_penamaan_indonesia'),
    ]

    operations = [
        migrations.CreateModel(
            name='StatistikKetenagakerjaanBPS',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(db_index=True, max_length=8)),
                ('kode_provinsi', models.CharField(db_index=True, max_length=4)),
                ('indikator', models.CharField(choices=[('angkatan_kerja', 'Jumlah Angkatan Kerja'), ('bekerja', 'Penduduk 15+ yang Bekerja'), ('pengangguran', 'Penduduk 15+ yang Menganggur'), ('tpt', 'Tingkat Pengangguran Terbuka'), ('tpak', 'Tingkat Partisipasi Angkatan Kerja'), ('upah_formal', 'Rata-rata Upah Pekerja Formal')], max_length=20)),
                ('var_id', models.IntegerField(help_text='Nomor variabel BPS untuk domain ini')),
                ('th_id', models.IntegerField(help_text='Nomor tahun BPS')),
                ('tahun', models.CharField(max_length=10)),
                ('per_wilayah', models.JSONField(blank=True, default=dict)),
                ('diperbarui_pada', models.DateTimeField(auto_now=True)),
                ('diperiksa_pada', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'verbose_name_plural': 'Statistik Ketenagakerjaan BPS',
                'db_table': 'data_acquisition_statistik_ketenagakerjaan_bps',
                'ordering': ['kode_provinsi', 'indikator'],
                'indexes': [models.Index(fields=['kode_provinsi', 'indikator'], name='bps_prov_indikator_idx')],
            },
        ),
        migrations.AddConstraint(
            model_name='statistikketenagakerjaanbps',
            constraint=models.UniqueConstraint(fields=('domain', 'indikator'), name='bps_domain_indikator_unik'),
        ),
    ]
