from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pipeline', '0007_tahapan_kppip'),
    ]

    operations = [
        migrations.AddField(
            model_name='proyekinvestasi',
            name='sub_sektor',
            field=models.CharField(blank=True, help_text='Kode sub-jenis investasi', max_length=40),
        ),
    ]
