from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventarisasi', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='zonasiruanglaut',
            name='sub_zona',
            field=models.CharField(choices=[('PERIKANAN_TANGKAP', 'Sub Zona Perikanan Tangkap'), ('PERIKANAN_BUDIDAYA', 'Sub Zona Perikanan Budidaya'), ('PELAYARAN', 'Sub Zona Pelayaran'), ('ENERGI', 'Sub Zona Energi'), ('PARIWISATA', 'Sub Zona Pariwisata'), ('KONSERVASI', 'Sub Zona Konservasi'), ('PERTAMBANGAN', 'Sub Zona Pertambangan'), ('INDUSTRI', 'Sub Zona Industri'), ('MANGROVE', 'Sub Zona Mangrove'), ('PERTAHANAN_KEAMANAN', 'Sub Zona Pertahanan dan Keamanan'), ('INFRASTRUKTUR', 'Sub Zona Infrastruktur'), ('LAINNYA', 'Lainnya')], default='LAINNYA', max_length=30),
        ),
    ]
