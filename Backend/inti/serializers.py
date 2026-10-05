import re

from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import KabupatenKota, Provinsi, SektorInvestasi, SumberData


class ProvinsiSerializer(GeoFeatureModelSerializer):
    jumlah_kabkota = serializers.SerializerMethodField()

    class Meta:
        model = Provinsi
        geo_field = 'geometry'
        fields = ['id', 'kode_bps', 'nama', 'luas_laut_km2', 'jumlah_kabkota']

    def get_jumlah_kabkota(self, obj):
        return obj.kabupaten_kota.count()


class ProvinsiListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provinsi
        fields = ['id', 'kode_bps', 'nama', 'luas_laut_km2']


class KabupatenKotaSerializer(serializers.ModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)

    class Meta:
        model = KabupatenKota
        fields = ['id', 'kode_bps', 'nama', 'jenis', 'provinsi', 'provinsi_nama', 'pesisir', 'jumlah_penduduk']


class SektorInvestasiSerializer(serializers.ModelSerializer):
    class Meta:
        model = SektorInvestasi
        fields = ['id', 'kode', 'nama', 'deskripsi', 'ikon', 'warna', 'rasio_tk_per_miliar', 'aktif', 'urutan']

    def validate_kode(self, nilai):
        if not re.fullmatch(r'[A-Z][A-Z0-9_]{2,49}', nilai or ''):
            raise serializers.ValidationError('Kode hanya huruf kapital, angka, dan garis bawah (3-50 karakter).')
        return nilai


class SumberDataSerializer(serializers.ModelSerializer):
    perlu_disinkronkan = serializers.BooleanField(read_only=True)

    class Meta:
        model = SumberData
        fields = ['id', 'kode', 'nama', 'tipe', 'status', 'last_sync', 'sync_interval_days', 'perlu_disinkronkan']
