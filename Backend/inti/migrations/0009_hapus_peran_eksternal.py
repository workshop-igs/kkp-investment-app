
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0008_log_aktivitas'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='profilpengguna',
            name='role',
        ),
        migrations.AlterField(
            model_name='profilpengguna',
            name='instansi',
            field=models.CharField(blank=True, help_text='Unit kerja di KKP', max_length=255),
        ),
        migrations.AlterField(
            model_name='profilpengguna',
            name='provinsi',
            field=models.ForeignKey(blank=True, help_text='Provinsi wilayah kerja', null=True, on_delete=django.db.models.deletion.SET_NULL, to='inti.provinsi'),
        ),
    ]
