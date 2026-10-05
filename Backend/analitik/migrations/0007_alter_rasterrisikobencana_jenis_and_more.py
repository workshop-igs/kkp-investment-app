from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0006_remove_zonarisikobencana_zona_bencana_petak_unik_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rasterrisikobencana',
            name='jenis',
            field=models.CharField(choices=[('TSUNAMI', 'Tsunami'), ('ABRASI', 'Gelombang Ekstrem & Abrasi'), ('BANJIR', 'Banjir')], db_index=True, max_length=15),
        ),
        migrations.AlterField(
            model_name='zonarisikobencana',
            name='jenis',
            field=models.CharField(choices=[('TSUNAMI', 'Tsunami'), ('ABRASI', 'Gelombang Ekstrem & Abrasi'), ('BANJIR', 'Banjir')], db_index=True, max_length=15),
        ),
    ]
