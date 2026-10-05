from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0004_provinsi_geometry_tampilan'),
    ]

    operations = [
        migrations.AlterModelTable(
            name='kabupatenkota',
            table='inti_kabupaten_kota',
        ),
        migrations.AlterModelTable(
            name='logsinkronisasi',
            table='inti_log_sinkronisasi',
        ),
        migrations.AlterModelTable(
            name='profilpengguna',
            table='inti_profil_pengguna',
        ),
        migrations.AlterModelTable(
            name='provinsi',
            table='inti_provinsi',
        ),
        migrations.AlterModelTable(
            name='sektorinvestasi',
            table='inti_sektor_investasi',
        ),
        migrations.AlterModelTable(
            name='sumberdata',
            table='inti_sumber_data',
        ),
    ]
