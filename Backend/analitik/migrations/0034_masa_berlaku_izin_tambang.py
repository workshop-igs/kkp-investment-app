from django.db import migrations


def tambah_masa_berlaku(apps, schema_editor):
    for p in apps.get_model('analitik', 'PengaturanAnalisis').objects.filter(kunci='MASA_BERLAKU_DATA'):
        p.nilai.setdefault('izin_tambang', 1)
        p.save(update_fields=['nilai'])


def buang_masa_berlaku(apps, schema_editor):
    for p in apps.get_model('analitik', 'PengaturanAnalisis').objects.filter(kunci='MASA_BERLAKU_DATA'):
        p.nilai.pop('izin_tambang', None)
        p.save(update_fields=['nilai'])


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0033_raster_aktivitas_tangkap'),
    ]

    operations = [
        migrations.RunPython(tambah_masa_berlaku, buang_masa_berlaku),
    ]
