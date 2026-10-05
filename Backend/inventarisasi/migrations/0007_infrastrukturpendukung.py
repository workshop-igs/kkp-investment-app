import django.contrib.gis.db.models.fields
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0002_alter_sektorinvestasi_kode'),
        ('inventarisasi', '0006_kkprl_jenis_dokumen_unsurruanglaut'),
    ]

    operations = [
        migrations.CreateModel(
            name='InfrastrukturPendukung',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kategori', models.CharField(choices=[('PELABUHAN_PERIKANAN', 'Pelabuhan Perikanan'), ('PELABUHAN_UMUM', 'Pelabuhan Umum'), ('PELABUHAN_PENYEBERANGAN', 'Pelabuhan Penyeberangan'), ('TERMINAL_KHUSUS', 'Terminal Khusus'), ('JALAN_NASIONAL', 'Jalan Nasional'), ('JARINGAN_LISTRIK', 'Jaringan Listrik'), ('PEMBANGKIT_LISTRIK', 'Pembangkit Listrik'), ('KAWASAN_INDUSTRI', 'Kawasan Industri'), ('KAWASAN_PERDAGANGAN_BEBAS', 'Kawasan Perdagangan Bebas & Pelabuhan Bebas')], max_length=30)),
                ('kode_lapisan', models.CharField(help_text='Nama lapisan asal di GeoServer KKP', max_length=80)),
                ('nama', models.CharField(max_length=255)),
                ('kelas', models.CharField(blank=True, help_text='Mis. PPS/PPN/PPP/PPI untuk pelabuhan perikanan', max_length=120)),
                ('pengelola', models.CharField(blank=True, max_length=180)),
                ('status', models.CharField(blank=True, max_length=120)),
                ('keterangan', models.TextField(blank=True)),
                ('geometry', django.contrib.gis.db.models.fields.GeometryField(srid=4326)),
                ('luas_ha', models.FloatField(default=0)),
                ('sumber_data', models.CharField(default='KKP-WFS', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='infrastruktur', to='inti.provinsi')),
            ],
            options={
                'verbose_name_plural': 'Infrastruktur Pendukung',
                'db_table': 'inventarisasi_infrastruktur_pendukung',
                'ordering': ['kategori', 'nama'],
                'indexes': [models.Index(fields=['kategori'], name='infra_kategori_idx'), models.Index(fields=['-luas_ha'], name='infra_luas_turun_idx')],
            },
        ),
    ]
