from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [('penarikan_data', '0001_initial')]

    operations = [
        migrations.RenameModel(old_name='ExternalAPIConfig', new_name='KonfigurasiAPI'),
        migrations.RenameModel(old_name='FetchLog', new_name='LogPenarikan'),
        migrations.AlterModelTable(name='konfigurasiapi', table='data_acquisition_konfigurasi_api'),
        migrations.AlterModelTable(name='logpenarikan', table='data_acquisition_log_penarikan'),
    ]
