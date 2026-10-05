from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('ketenagakerjaan', '0003_penamaan_indonesia'),
    ]

    operations = [
        migrations.DeleteModel(
            name='KebutuhanPelatihan',
        ),
    ]
