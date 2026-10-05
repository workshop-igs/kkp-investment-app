from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='sektorinvestasi',
            name='kode',
            field=models.CharField(help_text='e.g., PERIKANAN_TANGKAP', max_length=50, unique=True),
        ),
    ]
