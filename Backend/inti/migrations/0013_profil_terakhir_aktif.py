from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0012_hapus_profil_kurasi'),
    ]

    operations = [
        migrations.AddField(
            model_name='profilpengguna',
            name='terakhir_aktif',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Permintaan terakhir dari akun ini (diperbarui paling sering per menit)',
                null=True,
            ),
        ),
    ]
