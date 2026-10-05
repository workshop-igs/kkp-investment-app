import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('pipeline', '0004_alter_proyekinvestasi_provinsi_and_more')]

    operations = [
        migrations.RenameModel(old_name='StatusHistory', new_name='RiwayatStatus'),
        migrations.AlterModelTable(name='riwayatstatus', table='pipeline_riwayat_status'),
        migrations.AlterField(
            model_name='riwayatstatus',
            name='proyek',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='riwayat_status',
                to='pipeline.proyekinvestasi',
            ),
        ),
    ]
