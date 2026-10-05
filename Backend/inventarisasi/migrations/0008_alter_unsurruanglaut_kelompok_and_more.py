from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventarisasi', '0007_infrastrukturpendukung'),
    ]

    operations = [
        migrations.AlterField(
            model_name='unsurruanglaut',
            name='kelompok',
            field=models.CharField(choices=[('RTRL', 'Rencana Tata Ruang Laut Nasional'), ('RZKAW', 'Rencana Zonasi Kawasan Antarwilayah'), ('PKKPRL', 'Alokasi Ruang Laut 1:50.000'), ('KKPRL', 'Izin KKPRL (garis)')], max_length=10),
        ),
        migrations.AddIndex(
            model_name='kkprl',
            index=models.Index(fields=['-luas_ha'], name='kkprl_luas_turun_idx'),
        ),
    ]
