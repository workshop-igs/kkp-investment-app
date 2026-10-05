from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventarisasi', '0009_alter_unsurruanglaut_kelompok'),
    ]

    operations = [
        migrations.AlterField(
            model_name='zonasiruanglaut',
            name='sub_zona',
            field=models.CharField(choices=[('PERIKANAN_TANGKAP', 'Sub Zona Perikanan Tangkap'), ('PERIKANAN_BUDIDAYA', 'Sub Zona Perikanan Budidaya'), ('PELAYARAN', 'Sub Zona Pelayaran'), ('ENERGI', 'Sub Zona Energi'), ('PARIWISATA', 'Sub Zona Pariwisata'), ('KONSERVASI', 'Sub Zona Konservasi'), ('PERTAMBANGAN', 'Sub Zona Pertambangan'), ('INDUSTRI', 'Sub Zona Industri'), ('MANGROVE', 'Sub Zona Mangrove'), ('PERTAHANAN_KEAMANAN', 'Sub Zona Pertahanan dan Keamanan'), ('INFRASTRUKTUR', 'Sub Zona Infrastruktur'), ('EKOSISTEM_PESISIR', 'Sub Zona Pengelolaan Ekosistem Pesisir'), ('PERMUKIMAN', 'Sub Zona Permukiman'), ('PERGARAMAN', 'Sub Zona Pergaraman'), ('DUMPING', 'Sub Zona Dumping Area'), ('KAWASAN_SUCI', 'Kawasan Suci Laut'), ('TIDAK_DIBAGI', 'Tidak Dibagi ke dalam Sub Zona'), ('BELUM_DIATUR', 'Belum Diatur dalam RZWP-3-K'), ('LAINNYA', 'Lainnya')], default='LAINNYA', max_length=30),
        ),
    ]
