from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventarisasi', '0003_alter_zonasiruanglaut_sub_zona'),
    ]

    operations = [
        migrations.AlterField(
            model_name='zonasiruanglaut',
            name='jenis_zona',
            field=models.CharField(choices=[('ZU', 'Kawasan Pemanfaatan Umum'), ('ZT', 'Kawasan Pemanfaatan Terbatas'), ('ZL', 'Kawasan Konservasi'), ('ALKI', 'Alur Laut Kepulauan Indonesia'), ('KSN', 'Kawasan Strategis Nasional'), ('KST', 'Kawasan Strategis Nasional Tertentu')], default='ZU', max_length=10),
        ),
    ]
