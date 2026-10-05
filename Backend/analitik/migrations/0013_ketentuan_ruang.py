from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0009_hapus_peran_eksternal'),
        ('analitik', '0012_skor_zona_kelas_risiko'),
    ]

    operations = [
        migrations.CreateModel(
            name='KetentuanRuang',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sub_zona', models.CharField(max_length=30)),
                ('status', models.CharField(choices=[('DIIZINKAN', 'Diizinkan'), ('BERSYARAT', 'Diizinkan bersyarat'), ('TIDAK_DIIZINKAN', 'Tidak diizinkan')], max_length=16)),
                ('syarat', models.TextField(blank=True)),
                ('sumber', models.CharField(blank=True, max_length=255)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provinsi', models.ForeignKey(blank=True, help_text='Kosong = berlaku untuk semua provinsi', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='ketentuan_ruang', to='inti.provinsi')),
                ('sektor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ketentuan_ruang', to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name_plural': 'Ketentuan Ruang',
                'db_table': 'analitik_ketentuan_ruang',
                'ordering': ['sektor', 'sub_zona'],
            },
        ),
        migrations.AddConstraint(
            model_name='ketentuanruang',
            constraint=models.UniqueConstraint(condition=models.Q(('provinsi__isnull', True)), fields=('sektor', 'sub_zona'), name='ketentuan_ruang_umum_unik'),
        ),
        migrations.AddConstraint(
            model_name='ketentuanruang',
            constraint=models.UniqueConstraint(condition=models.Q(('provinsi__isnull', False)), fields=('sektor', 'sub_zona', 'provinsi'), name='ketentuan_ruang_provinsi_unik'),
        ),
    ]
