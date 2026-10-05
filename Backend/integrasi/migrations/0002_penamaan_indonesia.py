from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [('integrasi', '0001_initial')]

    operations = [
        migrations.RenameModel(old_name='DJPRLSync', new_name='SinkronisasiDJPRL'),
        migrations.AlterModelTable(name='sinkronisasidjprl', table='integration_sinkronisasi_djprl'),
    ]
