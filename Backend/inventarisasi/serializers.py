from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import (
    KKPRL,
    InfrastrukturPendukung,
    PotensiInvestasi,
    ProgramKKP,
    SumberDayaAlam,
    UnsurRuangLaut,
    ZonasiRuangLaut,
)


class PotensiInvestasiSerializer(GeoFeatureModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)
    sektor_nama = serializers.CharField(source='sektor.nama', read_only=True)

    class Meta:
        model = PotensiInvestasi
        geo_field = 'geometry'
        fields = '__all__'


class ZonasiRuangLautSerializer(GeoFeatureModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)

    class Meta:
        model = ZonasiRuangLaut
        geo_field = 'geometry'
        fields = '__all__'


class KKPRLSerializer(GeoFeatureModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)

    class Meta:
        model = KKPRL
        geo_field = 'geometry'
        fields = '__all__'


class ProgramKKPSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = ProgramKKP
        geo_field = 'geometry'
        fields = '__all__'


class SumberDayaAlamSerializer(GeoFeatureModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)

    class Meta:
        model = SumberDayaAlam
        geo_field = 'geometry'
        fields = '__all__'


class UnsurRuangLautSerializer(GeoFeatureModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)

    class Meta:
        model = UnsurRuangLaut
        geo_field = 'geometry'
        fields = '__all__'


class InfrastrukturPendukungSerializer(GeoFeatureModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)

    class Meta:
        model = InfrastrukturPendukung
        geo_field = 'geometry'
        fields = '__all__'
