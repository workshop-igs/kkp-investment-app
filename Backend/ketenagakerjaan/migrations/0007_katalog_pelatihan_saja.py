from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0008_log_aktivitas'),
        ('ketenagakerjaan', '0006_koefisien_berbasis_icor'),
    ]

    operations = [
        migrations.CreateModel(
            name='KalibrasiPelatihanSektor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dikalibrasi_oleh', models.CharField(blank=True, default='', help_text='Sumber kalibrasi, mis. "Pusdiklat KKP 2026". Kosong = masih asumsi.', max_length=120)),
                ('sektor', models.OneToOneField(help_text='Sektor investasi terkait', on_delete=django.db.models.deletion.CASCADE, related_name='kalibrasi_pelatihan', to='inti.sektorinvestasi')),
            ],
            options={
                'verbose_name': 'Kalibrasi Pelatihan Sektor',
                'verbose_name_plural': 'Kalibrasi Pelatihan Sektor',
                'db_table': 'ketenagakerjaan_kalibrasi_pelatihan',
            },
        ),
        migrations.RemoveField(
            model_name='koefisientenagakerja',
            name='sektor',
        ),
        migrations.AddField(
            model_name='matrikskeahliansektor',
            name='skema_sertifikasi',
            field=models.CharField(blank=True, default='', help_text='Skema sertifikasi/kompetensi yang dituju, mis. "LSP Budidaya Perikanan"', max_length=255),
        ),
        migrations.AlterField(
            model_name='matrikskeahliansektor',
            name='estimasi_biaya_per_orang_juta',
            field=models.FloatField(default=5.0, help_text='Estimasi biaya pelatihan per orang (juta Rp)'),
        ),
        migrations.AlterField(
            model_name='matrikskeahliansektor',
            name='pct_demand',
            field=models.FloatField(default=0.0, help_text='Bagian tenaga kerja proyek yang menempati posisi ini (0,0-1,0). Jumlah seluruh baris satu sektor harus <= 1.'),
        ),
        migrations.DeleteModel(
            name='ProfilTenagaKerja',
        ),
        migrations.AlterField(
            model_name='matrikskeahliansektor',
            name='labor_coefficient',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='skill_matrix', to='ketenagakerjaan.kalibrasipelatihansektor'),
        ),
        migrations.DeleteModel(
            name='KoefisienTenagaKerja',
        ),
    ]
