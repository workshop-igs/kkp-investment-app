from django.db import migrations
from django.db.models import Max

SELANG_JAM = 24 * 90
OSEANOGRAFI = ['SUHU', 'ANOMALI_SUHU', 'KLOROFIL', 'GELOMBANG', 'PERIODE_GLB', 'KD490']


def isi_jadwal(apps, schema_editor):
    KonfigurasiAPI = apps.get_model('penarikan_data', 'KonfigurasiAPI')
    PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')
    KKPRL = apps.get_model('inventarisasi', 'KKPRL')
    InfrastrukturPendukung = apps.get_model('inventarisasi', 'InfrastrukturPendukung')
    RasterOseanografi = apps.get_model('analitik', 'RasterOseanografi')
    ProduksiPerikananBPS = apps.get_model('penarikan_data', 'ProduksiPerikananBPS')

    PeriodicTask.objects.filter(task='penarikan_data.tasks.periksa_statistik_bps').delete()
    terakhir = {
        'KKP-KKPRL': ('Izin KKPRL, Portal Satu Data KKP',
                      KKPRL.objects.filter(sumber_data='KKP-WFS').aggregate(t=Max('updated_at'))['t']),
        'KKP-INFRA': ('Infrastruktur, Portal Satu Data KKP',
                      InfrastrukturPendukung.objects.filter(sumber_data='KKP-WFS').aggregate(t=Max('updated_at'))['t']),
        'OSM-INFRA': ('Bandara, gardu induk, kampus, dan listrik 20 kV, OpenStreetMap',
                      InfrastrukturPendukung.objects.filter(sumber_data='OSM').aggregate(t=Max('updated_at'))['t']),
        'OSEANOGRAFI': ('Oseanografi 12 bulan terakhir, NOAA dan NASA',
                        RasterOseanografi.objects.filter(parameter__in=OSEANOGRAFI).aggregate(t=Max('ditarik_pada'))['t']),
        'BPS-PRODUKSI': ('Produksi dan nilai produksi perikanan, BPS',
                         ProduksiPerikananBPS.objects.aggregate(t=Max('diperbarui_pada'))['t']),
        'KKP-RTRW': ('RTRW Provinsi beserta matriks KKPRL, folder data KKP', None),
    }
    for kode, (nama, waktu) in terakhir.items():
        cfg, dibuat = KonfigurasiAPI.objects.get_or_create(
            kode=kode, defaults={'nama': nama, 'status': 'ACTIVE', 'fetch_interval_hours': SELANG_JAM},
        )
        if dibuat or not cfg.last_successful_fetch:
            cfg.last_successful_fetch = waktu
            cfg.save(update_fields=['last_successful_fetch'])


class Migration(migrations.Migration):

    dependencies = [
        ('penarikan_data', '0007_produksi_perikanan_bps'),
        ('inventarisasi', '0019_sumberdayaalam_geometry_tampilan'),
        ('analitik', '0031_bioteknologi_zona_darat'),
        ('django_celery_beat', '0019_alter_periodictasks_options'),
    ]

    operations = [
        migrations.RunPython(isi_jadwal, migrations.RunPython.noop),
    ]
