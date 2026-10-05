from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('penarikan_data', '0004_samakan_nama_tabel'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='statistikketenagakerjaanbps',
            name='bps_domain_indikator_unik',
        ),
        migrations.AddConstraint(
            model_name='statistikketenagakerjaanbps',
            constraint=models.UniqueConstraint(fields=('domain', 'indikator', 'tahun'), name='bps_domain_indikator_tahun_unik'),
        ),
    ]
