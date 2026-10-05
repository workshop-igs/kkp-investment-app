from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventarisasi', '0004_alter_zonasiruanglaut_jenis_zona'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='zonasiruanglaut',
            index=models.Index(fields=['-luas_ha'], name='zonasi_luas_turun_idx'),
        ),
    ]
