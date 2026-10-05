from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0002_rasterrisikobencana'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='rasterrisikobencana',
            constraint=models.UniqueConstraint(fields=('jenis', 'cakupan'), name='raster_bencana_petak_unik'),
        ),
    ]
