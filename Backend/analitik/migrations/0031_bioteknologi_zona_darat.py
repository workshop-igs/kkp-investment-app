from django.db import migrations

ZONA = {'DARAT_INDUSTRI': 'DIIZINKAN', 'DARAT_PERIKANAN': 'BERSYARAT'}


def bioteknologi_zona_darat(apps, schema_editor):
    ketentuan = apps.get_model('analitik', 'KetentuanRuang')
    for sub_zona, status in ZONA.items():
        ketentuan.objects.filter(
            sektor__kode='BIOTEKNOLOGI_KELAUTAN', sub_zona=sub_zona, provinsi=None, status='TIDAK_DIIZINKAN',
            sumber__startswith='Bawaan sistem',
        ).update(status=status)


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0030_lokasipotensial_tampil'),
    ]

    operations = [
        migrations.RunPython(bioteknologi_zona_darat, migrations.RunPython.noop),
    ]
