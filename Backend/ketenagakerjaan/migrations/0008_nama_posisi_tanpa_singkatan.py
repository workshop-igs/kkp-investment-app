from django.db import migrations

NAMA_POSISI = [('Teknisi budidaya (KJA/tambak)', 'Teknisi budidaya (keramba jaring apung/tambak)'), ('Penanggung jawab mutu (HACCP)', 'Penanggung jawab mutu & keamanan pangan (HACCP)'), ('Ahli K3 instalasi kelistrikan', 'Ahli keselamatan dan kesehatan kerja (K3) kelistrikan'), ('Ahli K3 pekerjaan bawah air', 'Ahli keselamatan dan kesehatan kerja (K3) bawah air'), ('K3 & keselamatan kerja di perairan', 'Keselamatan dan kesehatan kerja (K3) di perairan')]


def maju(apps, schema_editor):
    Matriks = apps.get_model('ketenagakerjaan', 'MatriksKeahlianSektor')
    for lama, baru in NAMA_POSISI:
        Matriks.objects.filter(nama_posisi=lama).update(nama_posisi=baru)


def mundur(apps, schema_editor):
    Matriks = apps.get_model('ketenagakerjaan', 'MatriksKeahlianSektor')
    for lama, baru in NAMA_POSISI:
        Matriks.objects.filter(nama_posisi=baru).update(nama_posisi=lama)


class Migration(migrations.Migration):

    dependencies = [
        ('ketenagakerjaan', '0007_katalog_pelatihan_saja'),
    ]

    operations = [
        migrations.RunPython(maju, mundur),
    ]
