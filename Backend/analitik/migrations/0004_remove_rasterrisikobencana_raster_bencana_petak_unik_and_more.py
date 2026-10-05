from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0003_rasterrisikobencana_raster_bencana_petak_unik'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='rasterrisikobencana',
            name='raster_bencana_petak_unik',
        ),
        migrations.RemoveIndex(
            model_name='rasterrisikobencana',
            name='raster_bencana_jenis_idx',
        ),
        migrations.AddField(
            model_name='rasterrisikobencana',
            name='varian',
            field=models.CharField(choices=[('BAHAYA', 'Indeks Bahaya'), ('RISIKO', 'Indeks Risiko')], db_index=True, default='RISIKO', max_length=10),
        ),
        migrations.AddIndex(
            model_name='rasterrisikobencana',
            index=models.Index(fields=['jenis', 'varian'], name='raster_bencana_jenis_idx'),
        ),
        migrations.AddConstraint(
            model_name='rasterrisikobencana',
            constraint=models.UniqueConstraint(fields=('jenis', 'varian', 'cakupan'), name='raster_bencana_petak_unik'),
        ),
    ]
