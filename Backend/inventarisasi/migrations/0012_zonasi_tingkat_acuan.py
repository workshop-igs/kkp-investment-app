from django.db import migrations, models


def isi_tingkat(apps, schema_editor):
    Zonasi = apps.get_model('inventarisasi', 'ZonasiRuangLaut')
    Zonasi.objects.filter(sumber_data='KKP-WFS').update(tingkat_acuan='KAW')


class Migration(migrations.Migration):

    dependencies = [
        ('inventarisasi', '0011_unsur_kelompok_mha'),
    ]

    operations = [
        migrations.AddField(
            model_name='zonasiruanglaut',
            name='tingkat_acuan',
            field=models.CharField(choices=[('RTRW_PROVINSI', 'RTRW Provinsi'), ('KAW', 'Rencana Zonasi Kawasan Antarwilayah'), ('RTRWN', 'RTRW Nasional')], db_index=True, default='RTRW_PROVINSI', max_length=15),
        ),
        migrations.RunPython(isi_tingkat, migrations.RunPython.noop),
    ]
