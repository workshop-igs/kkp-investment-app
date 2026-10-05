import django.contrib.gis.db.models.fields
from django.db import migrations, models


from django.contrib.postgres.operations import CreateExtension


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0001_initial'),
    ]

    operations = [
        CreateExtension('postgis_raster'),
        migrations.CreateModel(
            name='RasterRisikoBencana',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jenis', models.CharField(choices=[('TSUNAMI', 'Risiko Tsunami'), ('ABRASI', 'Risiko Gelombang Ekstrem & Abrasi'), ('BANJIR', 'Risiko Banjir')], db_index=True, max_length=15)),
                ('rast', django.contrib.gis.db.models.fields.RasterField(null=True, srid=4326)),
                ('cakupan', django.contrib.gis.db.models.fields.PolygonField(blank=True, null=True, srid=4326)),
                ('nilai_maks', models.FloatField(default=0, help_text='Nilai tertinggi di petak ini')),
                ('sumber', models.CharField(default='BNPB InaRISK', max_length=120)),
                ('layanan', models.CharField(blank=True, help_text='Nama layanan InaRISK asal', max_length=120)),
                ('ditarik_pada', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name_plural': 'Raster Risiko Bencana',
                'db_table': 'analitik_raster_risiko_bencana',
                'indexes': [models.Index(fields=['jenis'], name='raster_bencana_jenis_idx')],
            },
        ),
    ]
