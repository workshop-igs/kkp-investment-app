from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0009_skor_kelayakan_zona'),
    ]

    operations = [
        migrations.AddField(
            model_name='skorkelayakanzona',
            name='ekosistem_rincian',
            field=models.CharField(blank=True, help_text='Jenis & kondisi ekosistem yang beririsan', max_length=255),
        ),
        migrations.AddField(
            model_name='skorkelayakanzona',
            name='sensitivitas_ekosistem',
            field=models.FloatField(blank=True, help_text='0-1; makin sehat & luas ekosistemnya, makin tinggi', null=True),
        ),
        migrations.AddField(
            model_name='skorkelayakanzona',
            name='sumber_lingkungan',
            field=models.CharField(default='NETRAL', help_text="Komponen risiko lingkungan yang benar-benar berdata: 'ekosistem', 'bencana', atau keduanya", max_length=40),
        ),
    ]
