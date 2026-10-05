from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('inti', '0009_hapus_peran_eksternal'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProfilInvestasiProvinsi',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('isi', models.JSONField(blank=True, default=dict)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('diperbarui_oleh', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('provinsi', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profil_investasi', to='inti.provinsi')),
            ],
            options={
                'verbose_name_plural': 'Profil Investasi Provinsi',
                'db_table': 'inti_profil_investasi_provinsi',
            },
        ),
    ]
