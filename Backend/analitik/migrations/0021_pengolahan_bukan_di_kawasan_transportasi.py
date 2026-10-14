from django.db import migrations


def terapkan(apps, schema_editor):
    apps.get_model('analitik', 'KetentuanRuang').objects.filter(
        sektor__kode='PENGOLAHAN_HASIL_LAUT', sub_zona='DARAT_TRANSPORTASI', provinsi__isnull=True,
        sumber__startswith='Bawaan sistem',
    ).update(status='TIDAK_DIIZINKAN', syarat='')


class Migration(migrations.Migration):
    dependencies = [('analitik', '0020_lokasi_potensial')]

    operations = [migrations.RunPython(terapkan, migrations.RunPython.noop)]
