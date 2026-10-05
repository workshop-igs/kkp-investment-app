from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [('ketenagakerjaan', '0002_hybrid_labor_models')]

    operations = [
        migrations.RenameModel(old_name='LaborCoefficient', new_name='KoefisienTenagaKerja'),
        migrations.RenameModel(old_name='SectorSkillMatrix', new_name='MatriksKeahlianSektor'),
        migrations.AlterModelTable(
            name='koefisientenagakerja', table='ketenagakerjaan_koefisien_tenaga_kerja'
        ),
        migrations.AlterModelTable(
            name='matrikskeahliansektor', table='ketenagakerjaan_matriks_keahlian_sektor'
        ),
        migrations.AlterModelTable(
            name='profiltenagakerja', table='ketenagakerjaan_profil_tenaga_kerja'
        ),
    ]
