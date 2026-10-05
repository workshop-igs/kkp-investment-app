import django.contrib.gis.db.models.fields
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0002_alter_sektorinvestasi_kode'),
        ('inventarisasi', '0005_zonasiruanglaut_zonasi_luas_turun_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='kkprl',
            name='jenis_dokumen',
            field=models.CharField(choices=[('PERSETUJUAN', 'Persetujuan KKPRL'), ('KONFIRMASI', 'Konfirmasi KKPRL'), ('LAINNYA', 'Dokumen lain')], default='PERSETUJUAN', max_length=15),
        ),
        migrations.CreateModel(
            name='UnsurRuangLaut',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kelompok', models.CharField(choices=[('RTRL', 'Rencana Tata Ruang Laut Nasional'), ('RZKAW', 'Rencana Zonasi Kawasan Antarwilayah'), ('PKKPRL', 'Perairan KKPRL 1:50.000'), ('KKPRL', 'Izin KKPRL (garis)')], max_length=10)),
                ('kode_lapisan', models.CharField(help_text='Nama lapisan asal di GeoServer KKP', max_length=60)),
                ('nama', models.CharField(max_length=255)),
                ('jenis', models.CharField(blank=True, max_length=255)),
                ('keterangan', models.TextField(blank=True)),
                ('nomor_regulasi', models.CharField(blank=True, max_length=255)),
                ('geometry', django.contrib.gis.db.models.fields.GeometryField(srid=4326)),
                ('luas_ha', models.FloatField(default=0)),
                ('sumber_data', models.CharField(default='KKP-WFS', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='unsur_ruang', to='inti.provinsi')),
            ],
            options={
                'verbose_name_plural': 'Unsur Ruang Laut (garis & titik)',
                'db_table': 'inventarisasi_unsur_ruang_laut',
                'ordering': ['kelompok', 'nama'],
                'indexes': [models.Index(fields=['kelompok'], name='unsur_kelompok_idx'), models.Index(fields=['-luas_ha'], name='unsur_luas_turun_idx')],
            },
        ),
    ]
