from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pipeline', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='proyekinvestasi',
            name='status',
            field=models.CharField(choices=[('LOI', 'Letter of Intent'), ('FS', 'Feasibility Study'), ('DEV', 'Development'), ('OP', 'Operational')], default='LOI', max_length=15),
        ),
    ]
