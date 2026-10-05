from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pipeline', '0002_alter_proyekinvestasi_status'),
    ]

    operations = [
        migrations.AlterField(
            model_name='statushistory',
            name='status_baru',
            field=models.CharField(max_length=50),
        ),
        migrations.AlterField(
            model_name='statushistory',
            name='status_lama',
            field=models.CharField(max_length=50),
        ),
    ]
