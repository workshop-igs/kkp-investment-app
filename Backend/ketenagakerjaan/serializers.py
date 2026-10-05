from rest_framework import serializers


class HitungTenagaKerjaSerializer(serializers.Serializer):
    sector_id = serializers.IntegerField(
        help_text='ID sektor investasi (FK ke inti.SektorInvestasi)'
    )
    total_tenaga_kerja = serializers.IntegerField(
        required=False, allow_null=True, default=None, min_value=1,
        help_text='Jumlah tenaga kerja proyek. Dikosongkan = katalog tanpa jumlah peserta.',
    )
