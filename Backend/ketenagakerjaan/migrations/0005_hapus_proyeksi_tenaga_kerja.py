from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('ketenagakerjaan', '0004_hapus_kebutuhan_pelatihan'),
    ]

    operations = [
        migrations.DeleteModel(
            name='ProyeksiTenagaKerja',
        ),
    ]
