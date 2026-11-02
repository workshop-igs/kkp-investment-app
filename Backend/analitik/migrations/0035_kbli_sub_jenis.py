from django.db import migrations

KBLI = {
    'TANGKAP_ARMADA_INDUSTRI': '03110', 'TANGKAP_PELAGIS': '03110', 'TANGKAP_DEMERSAL': '03110', 'TANGKAP_PELAGIS_KECIL': '03110',
    'BUDIDAYA_TAMBAK': '03231', 'BUDIDAYA_RUMPUT_LAUT': '03213', 'BUDIDAYA_LAUT': '03211', 'BUDIDAYA_KEKERANGAN': '03211',
    'BUDIDAYA_PEMBENIHAN': '03211',
    'OLAH_RANTAI_DINGIN': '52102', 'OLAH_PENGALENGAN': '10217', 'OLAH_RUMPUT_LAUT': '10298', 'OLAH_SIAP_SAJI': '10218',
    'WISATA_RESOR': '55209', 'WISATA_SELAM': '93297', 'WISATA_KAPAL_PESIAR': '50113', 'WISATA_MARINA': '93297',
    'JASA_GALANGAN': '30111', 'JASA_BUNKER': '46710', 'JASA_TERMINAL': '52221', 'JASA_SALVAGE': '52226',
    'INFRA_PELABUHAN_PERIKANAN': '42913', 'INFRA_PELINDUNG_PANTAI': '42915', 'INFRA_REKLAMASI': '42919',
    'INFRA_KABEL_PIPA': '42919',
    'ENERGI_PASUT': '35120', 'OTEC': '35120', 'PLTB_OFFSHORE': '35120',
    'GARAM_TAMBAK': '08930', 'GARAM_PEMURNIAN': '10773', 'GARAM_FORTIFIKASI': '10772',
    'BIOTEK_KOSMETIK': '20232', 'BIOTEK_BIOPLASTIK': '20131', 'BIOTEK_PAKAN_ALAMI': '03213',
    'KONSERVASI_MANGROVE': '02401', 'KONSERVASI_KARANG': '91426', 'KONSERVASI_KAWASAN': '91426',
}


def isi_kbli(apps, schema_editor):
    for p in apps.get_model('analitik', 'PengaturanAnalisis').objects.filter(kunci='KRITERIA_JENIS'):
        for per_sub in p.nilai.values():
            for sub, isi in per_sub.items():
                if not isi.get('kbli') and sub in KBLI:
                    isi['kbli'] = KBLI[sub]
        p.save(update_fields=['nilai'])


def buang_kbli(apps, schema_editor):
    for p in apps.get_model('analitik', 'PengaturanAnalisis').objects.filter(kunci='KRITERIA_JENIS'):
        for per_sub in p.nilai.values():
            for isi in per_sub.values():
                isi.pop('kbli', None)
        p.save(update_fields=['nilai'])


class Migration(migrations.Migration):

    dependencies = [('analitik', '0034_masa_berlaku_izin_tambang')]

    operations = [migrations.RunPython(isi_kbli, buang_kbli)]
