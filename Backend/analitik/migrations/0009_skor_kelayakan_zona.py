from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0005_samakan_nama_tabel'),
        ('inventarisasi', '0010_alter_zonasiruanglaut_sub_zona'),
        ('analitik', '0008_delete_risikobencana'),
    ]

    operations = [
        migrations.CreateModel(
            name='SkorKelayakanZona',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('skor_total', models.FloatField(db_index=True, help_text='0-1, makin tinggi makin layak')),
                ('skor_lokasi', models.FloatField(default=0)),
                ('skor_risiko', models.FloatField(default=0, help_text='Sudah dibalik: tinggi = risiko rendah')),
                ('kelas', models.CharField(choices=[('SANGAT_RENDAH', 'Sangat Rendah'), ('RENDAH', 'Rendah'), ('SEDANG', 'Sedang'), ('TINGGI', 'Tinggi')], db_index=True, max_length=15)),
                ('kesesuaian_tr', models.BooleanField(default=False)),
                ('potensi_sda', models.FloatField(default=0.5)),
                ('aksesibilitas', models.FloatField(default=0.5)),
                ('kondisi_sosek', models.FloatField(default=0.5)),
                ('jarak_infra_km', models.FloatField(blank=True, help_text='Ke infrastruktur terdekat', null=True)),
                ('risiko_bencana', models.FloatField(default=0.4)),
                ('risiko_regulasi', models.FloatField(default=0.4)),
                ('jumlah_kkprl', models.IntegerField(default=0, help_text='Izin aktif yang tumpang tindih')),
                ('sumber_sosek', models.CharField(default='NETRAL', help_text="'BPS' bila dari data kab/kota, 'NETRAL' bila belum tersedia", max_length=40)),
                ('dihitung_pada', models.DateTimeField(auto_now=True)),
                ('sektor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='inti.sektorinvestasi')),
                ('zona', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='skor_kelayakan', to='inventarisasi.zonasiruanglaut')),
            ],
            options={
                'verbose_name_plural': 'Skor Kelayakan Zona',
                'db_table': 'analitik_skor_kelayakan_zona',
                'ordering': ['-skor_total'],
                'indexes': [models.Index(fields=['sektor', '-skor_total'], name='skor_zona_sektor_idx'), models.Index(fields=['sektor', 'kelas'], name='skor_zona_kelas_idx')],
            },
        ),
        migrations.AddConstraint(
            model_name='skorkelayakanzona',
            constraint=models.UniqueConstraint(fields=('zona', 'sektor'), name='skor_zona_sektor_unik'),
        ),
    ]
