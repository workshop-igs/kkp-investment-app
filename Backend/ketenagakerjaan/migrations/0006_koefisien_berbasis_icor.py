from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ketenagakerjaan', '0005_hapus_proyeksi_tenaga_kerja'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='koefisientenagakerja',
            name='rasio_modal',
        ),
        migrations.RemoveField(
            model_name='koefisientenagakerja',
            name='w1',
        ),
        migrations.RemoveField(
            model_name='koefisientenagakerja',
            name='w2',
        ),
        migrations.AddField(
            model_name='koefisientenagakerja',
            name='dikalibrasi_oleh',
            field=models.CharField(blank=True, default='', help_text='Sumber kalibrasi, mis. "Kajian KKP 2026". Kosong = masih asumsi.', max_length=120),
        ),
        migrations.AddField(
            model_name='koefisientenagakerja',
            name='icor',
            field=models.FloatField(blank=True, help_text='ICOR sektor: rupiah modal per rupiah tambahan output per tahun', null=True),
        ),
        migrations.AddField(
            model_name='koefisientenagakerja',
            name='pengganda_tidak_langsung',
            field=models.FloatField(default=0.5, help_text='TK tidak langsung sebagai kelipatan TK langsung (0,5 = separuhnya)'),
        ),
        migrations.AddField(
            model_name='koefisientenagakerja',
            name='produktivitas_juta',
            field=models.FloatField(blank=True, help_text='Output per pekerja per tahun, dalam JUTA rupiah', null=True),
        ),
        migrations.AddField(
            model_name='koefisientenagakerja',
            name='terampil_pct',
            field=models.FloatField(default=0.3, help_text='Bagian TK yang menuntut keahlian bersertifikat (0-1)'),
        ),
        migrations.AlterField(
            model_name='koefisientenagakerja',
            name='density_per_ha',
            field=models.FloatField(default=10.0, help_text='Batas atas pekerja per hektare di lokasi (pembatas, bukan penambah)'),
        ),
    ]
