import django.contrib.gis.db.models.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0031_bioteknologi_zona_darat'),
    ]

    operations = [
        migrations.AddField(
            model_name='lokasipotensial',
            name='wilayah',
            field=django.contrib.gis.db.models.fields.MultiPolygonField(
                null=True, srid=4326,
                help_text='Sel bersambung yang memenuhi kriteria; tampil di peta sebagai area indikatif'),
        ),
        migrations.RunSQL(
            'UPDATE analitik_lokasi_potensial SET wilayah = geometry WHERE wilayah IS NULL',
            migrations.RunSQL.noop,
        ),
        migrations.AlterField(
            model_name='lokasipotensial',
            name='wilayah',
            field=django.contrib.gis.db.models.fields.MultiPolygonField(
                srid=4326, help_text='Sel bersambung yang memenuhi kriteria; tampil di peta sebagai area indikatif'),
        ),
    ]
