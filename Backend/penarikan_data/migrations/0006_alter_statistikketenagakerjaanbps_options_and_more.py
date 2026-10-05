from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('penarikan_data', '0005_remove_statistikketenagakerjaanbps_bps_domain_indikator_unik_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='statistikketenagakerjaanbps',
            options={'ordering': ['indikator', '-tahun'], 'verbose_name_plural': 'Statistik Ketenagakerjaan BPS'},
        ),
        migrations.RemoveIndex(
            model_name='statistikketenagakerjaanbps',
            name='bps_prov_indikator_idx',
        ),
        migrations.RemoveField(
            model_name='statistikketenagakerjaanbps',
            name='kode_provinsi',
        ),
        migrations.AlterField(
            model_name='statistikketenagakerjaanbps',
            name='indikator',
            field=models.CharField(choices=[('tpt', 'Tingkat Pengangguran Terbuka'), ('pengangguran', 'Penduduk 15+ yang Menganggur')], max_length=20),
        ),
    ]
