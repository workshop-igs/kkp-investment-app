import django.contrib.gis.db.models.fields
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0013_profil_terakhir_aktif'),
        ('inventarisasi', '0019_sumberdayaalam_geometry_tampilan'),
    ]

    operations = [
        migrations.CreateModel(
            name='IzinTambang',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kode_wiup', models.CharField(max_length=40)),
                ('nama_usaha', models.CharField(max_length=255)),
                ('badan_usaha', models.CharField(blank=True, max_length=40)),
                ('jenis_izin', models.CharField(max_length=10)),
                ('kegiatan', models.CharField(blank=True, max_length=40)),
                ('komoditas', models.CharField(blank=True, max_length=100)),
                ('sk_iup', models.CharField(blank=True, max_length=100)),
                ('tanggal_berlaku', models.DateField()),
                ('tanggal_akhir', models.DateField(blank=True, null=True)),
                ('luas_ha', models.FloatField(default=0)),
                ('kabupaten', models.CharField(blank=True, max_length=100)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(srid=4326)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='izin_tambang', to='inti.provinsi')),
            ],
            options={
                'verbose_name_plural': 'Izin Tambang',
                'db_table': 'inventarisasi_izin_tambang',
            },
        ),
    ]
