import django.contrib.gis.db.models.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventarisasi', '0018_kategori_infrastruktur_osm'),
    ]

    operations = [
        migrations.AddField(
            model_name='sumberdayaalam',
            name='geometry_tampilan',
            field=django.contrib.gis.db.models.fields.MultiPolygonField(
                blank=True, help_text='Petak dilebur per piksel ±55 m untuk peta skala kecil', null=True, srid=4326),
        ),
        migrations.RunSQL(
            "UPDATE inventarisasi_sumber_daya_alam SET geometry_tampilan = ST_Multi(ST_SimplifyPreserveTopology(ST_Polygon(ST_AsRaster(geometry, 0.0005::float8, -0.0005::float8, '8BUI'::text, 1::float8, 0::float8, NULL::float8, NULL::float8, 0::float8, 0::float8, true)), 0.0003)) "
            "WHERE sumber_data IN ('SIDAKO-KARANG', 'SIDAKO-LAMUN')",
            migrations.RunSQL.noop,
        ),
    ]
