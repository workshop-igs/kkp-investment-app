from django.db import migrations


def buang_sensitivitas_proksi(apps, schema_editor):
    ProyekInvestasi = apps.get_model('pipeline', 'ProyekInvestasi')
    for proyek in ProyekInvestasi.objects.filter(analisis_json__has_key='sensitivitas'):
        del proyek.analisis_json['sensitivitas']
        proyek.save(update_fields=['analisis_json'])


class Migration(migrations.Migration):

    dependencies = [('pipeline', '0005_penamaan_indonesia')]

    operations = [migrations.RunPython(buang_sensitivitas_proksi, migrations.RunPython.noop)]
