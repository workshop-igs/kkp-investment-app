import django.contrib.gis.db.models.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0014_hapus_banjir'),
    ]

    operations = [
        migrations.CreateModel(
            name='RasterOseanografi',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('parameter', models.CharField(choices=[('KEDALAMAN', 'Kedalaman laut'), ('SUHU', 'Suhu permukaan laut'), ('KLOROFIL', 'Klorofil-a'), ('GELOMBANG', 'Tinggi gelombang signifikan')], db_index=True, max_length=15)),
                ('rast', django.contrib.gis.db.models.fields.RasterField(srid=4326)),
                ('cakupan', django.contrib.gis.db.models.fields.PolygonField(srid=4326)),
                ('satuan', models.CharField(max_length=20)),
                ('periode', models.CharField(blank=True, max_length=80)),
                ('sumber', models.CharField(max_length=200)),
                ('ditarik_pada', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'Raster Oseanografi',
                'db_table': 'analitik_raster_oseanografi',
            },
        ),
        migrations.AddConstraint(
            model_name='rasteroseanografi',
            constraint=models.UniqueConstraint(fields=('parameter', 'cakupan'), name='raster_oseanografi_petak_unik'),
        ),
    ]
