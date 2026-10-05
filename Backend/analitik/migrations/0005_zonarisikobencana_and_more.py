import django.contrib.gis.db.models.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0004_remove_rasterrisikobencana_raster_bencana_petak_unik_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ZonaRisikoBencana',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jenis', models.CharField(choices=[('TSUNAMI', 'Risiko Tsunami'), ('ABRASI', 'Risiko Gelombang Ekstrem & Abrasi'), ('BANJIR', 'Risiko Banjir')], db_index=True, max_length=15)),
                ('kelas', models.CharField(choices=[('RENDAH', 'Rendah'), ('SEDANG', 'Sedang'), ('TINGGI', 'Tinggi')], db_index=True, max_length=10)),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(srid=4326)),
                ('luas_ha', models.FloatField(default=0)),
                ('cakupan', django.contrib.gis.db.models.fields.PolygonField(blank=True, null=True, srid=4326)),
                ('sumber', models.CharField(default='BNPB InaRISK', max_length=120)),
                ('dibuat_pada', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name_plural': 'Zona Risiko Bencana',
                'db_table': 'analitik_zona_risiko_bencana',
                'ordering': ['-luas_ha'],
                'indexes': [models.Index(fields=['jenis', 'kelas'], name='zona_bencana_jenis_idx'), models.Index(fields=['-luas_ha'], name='zona_bencana_luas_idx')],
            },
        ),
        migrations.AddConstraint(
            model_name='zonarisikobencana',
            constraint=models.UniqueConstraint(fields=('jenis', 'kelas', 'cakupan'), name='zona_bencana_petak_unik'),
        ),
    ]
