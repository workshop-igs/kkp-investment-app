from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0011_skor_zona_sosial'),
    ]

    operations = [
        migrations.AddField(
            model_name='skorkelayakanzona',
            name='kelas_risiko',
            field=models.CharField(choices=[('SANGAT_RENDAH', 'Sangat Rendah'), ('RENDAH', 'Rendah'), ('SEDANG', 'Sedang'), ('TINGGI', 'Tinggi')], db_index=True, default='SEDANG', help_text='Kelas risiko investasi 0-1 menurut RISK_CLASS_THRESHOLDS', max_length=15),
        ),
    ]
