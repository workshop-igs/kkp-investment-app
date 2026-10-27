from django.db import migrations, models


def tambah_masa_berlaku(apps, schema_editor):
    for p in apps.get_model('analitik', 'PengaturanAnalisis').objects.filter(kunci='MASA_BERLAKU_DATA'):
        p.nilai.setdefault('aktivitas_tangkap', 1)
        p.save(update_fields=['nilai'])


def buang_masa_berlaku(apps, schema_editor):
    for p in apps.get_model('analitik', 'PengaturanAnalisis').objects.filter(kunci='MASA_BERLAKU_DATA'):
        p.nilai.pop('aktivitas_tangkap', None)
        p.save(update_fields=['nilai'])


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0032_lokasipotensial_wilayah'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rasteroseanografi',
            name='parameter',
            field=models.CharField(choices=[('KEDALAMAN', 'Kedalaman laut'), ('SUHU', 'Suhu permukaan laut'), ('ANOMALI_SUHU', 'Anomali suhu permukaan laut'), ('KLOROFIL', 'Klorofil-a'), ('GELOMBANG', 'Tinggi gelombang signifikan'), ('PERIODE_GLB', 'Periode puncak gelombang'), ('KD490', 'Kekeruhan perairan (Kd490)'), ('CURAH_HUJAN', 'Curah hujan bulanan'), ('BULAN_KERING', 'Bulan kering berturut-turut'), ('ARUS', 'Kecepatan arus permukaan'), ('ARUS_DASAR', 'Kecepatan arus dasar'), ('SALINITAS', 'Salinitas permukaan laut'), ('TSS', 'Padatan tersuspensi (TSS)'), ('KEMIRINGAN', 'Kemiringan lahan'), ('KEMIRINGAN_DASAR', 'Kemiringan dasar laut'), ('PASUT', 'Tunggang pasang surut'), ('PGA', 'Percepatan tanah puncak gempa (PGA)'), ('GELOMBANG_EKSTREM', 'Gelombang ekstrem periode ulang 50 tahun'), ('ANGIN_100M', 'Kecepatan angin 100 m'), ('GHI', 'Iradiasi surya global (GHI)'), ('BEDA_SUHU_1000M', 'Beda suhu permukaan dan kedalaman 1.000 m'), ('TANAH_LIAT', 'Kandungan tanah liat'), ('SHANNON', 'Indeks keanekaragaman hayati Shannon-Wiener'), ('ABRASI_PANTAI', 'Laju abrasi garis pantai'), ('EKS_MANGROVE', 'Eks-mangrove 1996-2020'), ('LUAS_EKS_MANGROVE', 'Luas hamparan eks-mangrove'), ('PRODUKSI_KABUPATEN', 'Perkiraan produksi ikan kabupaten/kota'), ('TANGKAP_SIANG', 'Aktivitas penangkapan ikan siang hari'), ('TANGKAP_MALAM', 'Aktivitas penangkapan ikan malam hari')], db_index=True, max_length=20),
        ),
        migrations.RunPython(tambah_masa_berlaku, buang_masa_berlaku),
    ]
