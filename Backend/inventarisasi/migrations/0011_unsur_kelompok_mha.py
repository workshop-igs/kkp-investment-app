from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventarisasi', '0010_alter_zonasiruanglaut_sub_zona'),
    ]

    operations = [
        migrations.AlterField(
            model_name='unsurruanglaut',
            name='kelompok',
            field=models.CharField(choices=[('RTRL', 'Rencana Tata Ruang Laut Nasional'), ('RZKAW', 'Rencana Zonasi Kawasan Antarwilayah'), ('KKPRL', 'Izin KKPRL (garis)'), ('MHA', 'Wilayah Kelola Masyarakat Hukum Adat')], max_length=10),
        ),
    ]
