from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0010_skor_zona_ekosistem'),
    ]

    operations = [
        migrations.AddField(
            model_name='skorkelayakanzona',
            name='rasio_dtks',
            field=models.FloatField(blank=True, help_text='Penduduk DTKS desil 1-4 / jumlah penduduk kab/kota', null=True),
        ),
        migrations.AddField(
            model_name='skorkelayakanzona',
            name='rasio_nelayan',
            field=models.FloatField(blank=True, help_text='Jumlah nelayan / jumlah penduduk kab/kota', null=True),
        ),
        migrations.AddField(
            model_name='skorkelayakanzona',
            name='risiko_sosial',
            field=models.FloatField(blank=True, help_text='0-1; 1 = paling berisiko secara sosial', null=True),
        ),
        migrations.AddField(
            model_name='skorkelayakanzona',
            name='sumber_sosial',
            field=models.CharField(default='NETRAL', help_text="Komponen risiko sosial yang berdata: 'kemiskinan', 'tenurial', atau keduanya", max_length=40),
        ),
        migrations.AddField(
            model_name='skorkelayakanzona',
            name='wilayah_adat',
            field=models.BooleanField(default=False, help_text='Beririsan wilayah kelola masyarakat hukum adat'),
        ),
        migrations.AlterField(
            model_name='skorkelayakanzona',
            name='sumber_sosek',
            field=models.CharField(default='NETRAL', help_text="'KKP' bila dari data kab/kota, 'NETRAL' bila belum tersedia", max_length=40),
        ),
    ]
