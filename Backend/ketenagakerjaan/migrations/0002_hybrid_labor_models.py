from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0002_alter_sektorinvestasi_kode'),
        ('ketenagakerjaan', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='LaborCoefficient',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('density_per_ha', models.FloatField(default=0.5, help_text='D_sektor: jumlah TK per hektar lahan (E_spasial = area_ha × D)')),
                ('rasio_modal', models.DecimalField(decimal_places=2, default=500000000, help_text='R_modal: Rp per orang TK (E_finansial = capex / R_modal)', max_digits=20)),
                ('w1', models.FloatField(default=0.4, help_text='Bobot estimasi spasial (E_spasial)')),
                ('w2', models.FloatField(default=0.6, help_text='Bobot estimasi finansial (E_finansial)')),
                ('sektor', models.OneToOneField(help_text='Sektor investasi terkait', on_delete=django.db.models.deletion.CASCADE, related_name='labor_coefficient', to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name': 'Koefisien Tenaga Kerja',
                'verbose_name_plural': 'Koefisien Tenaga Kerja',
                'db_table': 'ketenagakerjaan_labor_coefficient',
            },
        ),
        migrations.CreateModel(
            name='SectorSkillMatrix',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama_posisi', models.CharField(help_text="Nama posisi/keahlian, e.g. 'Teknisi Budidaya Rumput Laut'", max_length=255)),
                ('pct_demand', models.FloatField(default=0.0, help_text='Persentase demand dari E_total (0.0 – 1.0), e.g. 0.25 = 25%')),
                ('prioritas', models.CharField(choices=[('TINGGI', 'Tinggi'), ('SEDANG', 'Sedang'), ('RENDAH', 'Rendah')], default='SEDANG', max_length=10)),
                ('lembaga_pelatihan_rekomendasi', models.CharField(blank=True, help_text='Lembaga pelatihan yang direkomendasikan', max_length=255)),
                ('durasi_pelatihan_bulan', models.IntegerField(default=3, help_text='Estimasi durasi pelatihan (bulan)')),
                ('estimasi_biaya_per_orang_juta', models.FloatField(default=5.0, help_text='Estimasi biaya pelatihan per orang (Juta Rp)')),
                ('labor_coefficient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='skill_matrix', to='ketenagakerjaan.laborcoefficient')),
            ],
            options={
                'verbose_name': 'Matriks Keahlian Sektor',
                'verbose_name_plural': 'Matriks Keahlian Sektor',
                'db_table': 'ketenagakerjaan_sector_skill_matrix',
                'ordering': ['labor_coefficient', '-pct_demand'],
            },
        ),
    ]
