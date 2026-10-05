from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0005_samakan_nama_tabel'),
    ]

    operations = [
        migrations.AddField(
            model_name='kabupatenkota',
            name='jumlah_nelayan',
            field=models.IntegerField(default=0, help_text='Jumlah nelayan (statistik KKP)'),
        ),
        migrations.AddField(
            model_name='kabupatenkota',
            name='jumlah_rtp_tangkap',
            field=models.IntegerField(default=0, help_text='Rumah tangga perikanan tangkap (statistik KKP)'),
        ),
        migrations.AddField(
            model_name='kabupatenkota',
            name='luas_km2',
            field=models.FloatField(default=0, help_text='Luas wilayah daratan (km persegi)'),
        ),
        migrations.AddField(
            model_name='kabupatenkota',
            name='penduduk_dtks',
            field=models.IntegerField(default=0, help_text='Penduduk terdaftar DTKS desil 1-4 (Kemensos, via Portal Satu Data KKP)'),
        ),
        migrations.AddField(
            model_name='kabupatenkota',
            name='tahun_data_sosial',
            field=models.IntegerField(blank=True, help_text='Tahun data nelayan/RTP yang terpakai', null=True),
        ),
    ]
