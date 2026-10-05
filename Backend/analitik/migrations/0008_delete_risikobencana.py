from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0007_alter_rasterrisikobencana_jenis_and_more'),
    ]

    operations = [
        migrations.DeleteModel(
            name='RisikoBencana',
        ),
    ]
