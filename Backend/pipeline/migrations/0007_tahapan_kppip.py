from django.db import migrations, models

MAJU = {'LOI': 'PERENCANAAN', 'FS': 'PENYIAPAN', 'DEV': 'KONSTRUKSI', 'OP': 'OPERASI'}
MUNDUR = {**{b: a for a, b in MAJU.items()}, 'TRANSAKSI': 'FS'}


def _petakan(peta, apps):
    Proyek = apps.get_model('pipeline', 'ProyekInvestasi')
    Riwayat = apps.get_model('pipeline', 'RiwayatStatus')
    for lama, baru in peta.items():
        Proyek.objects.filter(status=lama).update(status=baru)
        Riwayat.objects.filter(status_lama=lama).update(status_lama=baru)
        Riwayat.objects.filter(status_baru=lama).update(status_baru=baru)


def maju(apps, schema_editor):
    _petakan(MAJU, apps)


def mundur(apps, schema_editor):
    _petakan(MUNDUR, apps)


class Migration(migrations.Migration):

    dependencies = [
        ('pipeline', '0006_hapus_sensitivitas_proksi'),
    ]

    operations = [
        migrations.AlterField(
            model_name='proyekinvestasi',
            name='status',
            field=models.CharField(
                choices=[
                    ('PERENCANAAN', 'Perencanaan'),
                    ('PENYIAPAN', 'Penyiapan'),
                    ('TRANSAKSI', 'Transaksi'),
                    ('KONSTRUKSI', 'Konstruksi'),
                    ('OPERASI', 'Operasi'),
                ],
                default='PERENCANAAN',
                max_length=15,
            ),
        ),
        migrations.AlterModelOptions(
            name='riwayatstatus',
            options={'ordering': ['-tanggal'], 'verbose_name_plural': 'Riwayat Tahap Proyek'},
        ),
        migrations.RunPython(maju, mundur),
    ]
