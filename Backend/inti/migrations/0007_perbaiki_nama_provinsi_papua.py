from django.db import migrations

NAMA_BENAR = {
    '91': 'Papua',
    '92': 'Papua Barat',
    '93': 'Papua Selatan',
    '94': 'Papua Tengah',
    '95': 'Papua Pegunungan',
    '96': 'Papua Barat Daya',
}

NAMA_LAMA = {
    '91': 'Papua Barat',
    '92': 'Papua Barat Daya',
    '93': 'Papua Selatan',
    '94': 'Papua',
    '95': 'Papua Tengah',
    '96': 'Papua Pegunungan',
}


def _terapkan(peta, apps, schema_editor):
    Provinsi = apps.get_model('inti', 'Provinsi')
    for kode, nama in peta.items():
        Provinsi.objects.filter(kode_bps=kode).update(nama=nama)


def maju(apps, schema_editor):
    _terapkan(NAMA_BENAR, apps, schema_editor)


def mundur(apps, schema_editor):
    _terapkan(NAMA_LAMA, apps, schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0006_kabupaten_kota_sosial'),
    ]

    operations = [
        migrations.RunPython(maju, mundur),
    ]
