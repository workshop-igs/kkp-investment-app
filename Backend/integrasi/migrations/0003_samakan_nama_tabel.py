from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('integrasi', '0002_penamaan_indonesia'),
    ]

    operations = [
        migrations.AlterModelTable(
            name='sinkronisasidjprl',
            table='integrasi_sinkronisasi_djprl',
        ),
    ]
