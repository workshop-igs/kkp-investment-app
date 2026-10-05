from django.db import migrations, models
import django.db.models.deletion

BUAT_URUTAN = """
CREATE SEQUENCE IF NOT EXISTS pipeline_kode_proyek_seq;
SELECT setval(
    'pipeline_kode_proyek_seq',
    GREATEST(
        COALESCE((
            SELECT MAX(NULLIF(regexp_replace(kode_proyek, '[^0-9]', '', 'g'), ''))::bigint
            FROM pipeline_proyek_investasi
        ), 0),
        COALESCE((SELECT MAX(id) FROM pipeline_proyek_investasi), 0),
        1
    )
);
"""

HAPUS_URUTAN = 'DROP SEQUENCE IF EXISTS pipeline_kode_proyek_seq;'



class Migration(migrations.Migration):

    dependencies = [
        ('inti', '0002_alter_sektorinvestasi_kode'),
        ('pipeline', '0003_alter_statushistory_status_baru_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='proyekinvestasi',
            name='provinsi',
            field=models.ForeignKey(blank=True, help_text='Kosong = perairan nasional / di luar kewenangan provinsi', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='proyek_investasi', to='inti.provinsi'),
        ),
        migrations.AlterField(
            model_name='proyekinvestasi',
            name='sektor',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='proyek', to='inti.sektorinvestasi'),
        ),
        migrations.RunSQL(sql=BUAT_URUTAN, reverse_sql=HAPUS_URUTAN),
    ]
