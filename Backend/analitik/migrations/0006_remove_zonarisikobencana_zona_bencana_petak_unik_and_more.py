from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analitik', '0005_zonarisikobencana_and_more'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='zonarisikobencana',
            name='zona_bencana_petak_unik',
        ),
        migrations.RemoveIndex(
            model_name='zonarisikobencana',
            name='zona_bencana_jenis_idx',
        ),
        migrations.AddField(
            model_name='zonarisikobencana',
            name='varian',
            field=models.CharField(choices=[('BAHAYA', 'Indeks Bahaya'), ('RISIKO', 'Indeks Risiko')], db_index=True, default='RISIKO', max_length=10),
        ),
        migrations.AddIndex(
            model_name='zonarisikobencana',
            index=models.Index(fields=['jenis', 'varian', 'kelas'], name='zona_bencana_jenis_idx'),
        ),
        migrations.AddConstraint(
            model_name='zonarisikobencana',
            constraint=models.UniqueConstraint(fields=('jenis', 'varian', 'kelas', 'cakupan'), name='zona_bencana_petak_unik'),
        ),
    ]
