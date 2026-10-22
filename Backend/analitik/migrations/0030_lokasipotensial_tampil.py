from django.db import migrations, models


def tambak_bersyarat_konservasi(apps, schema_editor):
    apps.get_model('analitik', 'KetentuanRuang').objects.filter(
        sektor__kode='KONSERVASI_PESISIR', sub_zona='DARAT_PERIKANAN', provinsi=None, status='TIDAK_DIIZINKAN',
        sumber__startswith='Bawaan sistem',
    ).update(status='BERSYARAT')


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0029_alter_lokasipotensial_persen_sesuai'),
    ]

    operations = [
        migrations.AddField(
            model_name='lokasipotensial',
            name='tampil',
            field=models.BooleanField(default=True, help_text='Termasuk lokasi unggulan nasional yang ditampilkan di peta'),
        ),
        migrations.RunPython(tambak_bersyarat_konservasi, migrations.RunPython.noop),
    ]
