from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('penarikan_data', '0003_statistikketenagakerjaanbps_and_more'),
    ]

    operations = [
        migrations.AlterModelTable(
            name='konfigurasiapi',
            table='penarikan_data_konfigurasi_api',
        ),
        migrations.AlterModelTable(
            name='logpenarikan',
            table='penarikan_data_log_penarikan',
        ),
        migrations.AlterModelTable(
            name='statistikketenagakerjaanbps',
            table='penarikan_data_statistik_ketenagakerjaan_bps',
        ),
    ]
