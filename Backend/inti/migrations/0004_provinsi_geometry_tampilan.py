import django.contrib.gis.db.models.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0003_penamaan_indonesia'),
    ]

    operations = [
        migrations.AddField(
            model_name='provinsi',
            name='geometry_tampilan',
            field=django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, help_text='Batas yang disederhanakan untuk peta; jangan dipakai analisis.', null=True, srid=4326),
        ),
    ]
