from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventarisasi', '0008_alter_unsurruanglaut_kelompok_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='unsurruanglaut',
            name='kelompok',
            field=models.CharField(choices=[('RTRL', 'Rencana Tata Ruang Laut Nasional'), ('RZKAW', 'Rencana Zonasi Kawasan Antarwilayah'), ('KKPRL', 'Izin KKPRL (garis)')], max_length=10),
        ),
    ]
