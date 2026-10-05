from django.db import migrations
import django.db.models.deletion
from django.db import models


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0002_alter_sektorinvestasi_kode'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RenameModel(old_name='DataSource', new_name='SumberData'),
        migrations.RenameModel(old_name='DataSyncLog', new_name='LogSinkronisasi'),
        migrations.RenameModel(old_name='UserProfile', new_name='ProfilPengguna'),

        migrations.AlterModelTable(name='sumberdata', table='core_sumber_data'),
        migrations.AlterModelTable(name='logsinkronisasi', table='core_log_sinkronisasi'),
        migrations.AlterModelTable(name='profilpengguna', table='core_profil_pengguna'),

        migrations.AlterField(
            model_name='profilpengguna',
            name='user',
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='profil',
                to='auth.user',
            ),
        ),
    ]
