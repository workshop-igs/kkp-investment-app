from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0013_ketentuan_ruang'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rasterrisikobencana',
            name='jenis',
            field=models.CharField(choices=[('TSUNAMI', 'Tsunami'), ('ABRASI', 'Gelombang Ekstrem & Abrasi')], db_index=True, max_length=15),
        ),
        migrations.AlterField(
            model_name='zonarisikobencana',
            name='jenis',
            field=models.CharField(choices=[('TSUNAMI', 'Tsunami'), ('ABRASI', 'Gelombang Ekstrem & Abrasi')], db_index=True, max_length=15),
        ),
    ]
