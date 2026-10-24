from rest_framework import serializers

from .models import ProyekInvestasi, RekapRealisasi, RiwayatStatus

LABEL_TANPA_PROVINSI = 'Perairan nasional'


class RiwayatStatusSerializer(serializers.ModelSerializer):
    diubah_oleh_nama = serializers.SerializerMethodField()
    status_lama_display = serializers.SerializerMethodField()
    status_baru_display = serializers.SerializerMethodField()
    tanggal_formatted = serializers.SerializerMethodField()

    class Meta:
        model = RiwayatStatus
        fields = [
            'id',
            'status_lama',
            'status_lama_display',
            'status_baru',
            'status_baru_display',
            'tanggal',
            'tanggal_formatted',
            'catatan',
            'diubah_oleh_nama',
        ]

    def get_diubah_oleh_nama(self, obj):
        if obj.diubah_oleh:
            return obj.diubah_oleh.get_full_name() or obj.diubah_oleh.username
        return 'Administrator / Sistem'

    def get_status_lama_display(self, obj):
        mapping = dict(ProyekInvestasi.STATUS_CHOICES)
        return mapping.get(obj.status_lama, obj.status_lama)

    def get_status_baru_display(self, obj):
        mapping = dict(ProyekInvestasi.STATUS_CHOICES)
        return mapping.get(obj.status_baru, obj.status_baru)

    def get_tanggal_formatted(self, obj):
        if not obj.tanggal:
            return ''
        from django.utils import timezone
        tz = timezone.get_current_timezone()
        local_dt = obj.tanggal.astimezone(tz)
        months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        month_name = months[local_dt.month - 1]
        return f"{local_dt.day} {month_name} {local_dt.year}, {local_dt.strftime('%H:%M:%S')} WIB"


class ProyekInvestasiSerializer(serializers.ModelSerializer):
    riwayat_status = RiwayatStatusSerializer(many=True, read_only=True)
    provinsi_nama = serializers.SerializerMethodField()
    sektor_nama = serializers.CharField(source='sektor.nama', read_only=True, default=None)
    sektor_kode = serializers.CharField(source='sektor.kode', read_only=True, default=None)
    sub_sektor_nama = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    def get_provinsi_nama(self, obj):
        return obj.provinsi.nama if obj.provinsi_id else LABEL_TANPA_PROVINSI

    def get_sub_sektor_nama(self, obj):
        from analitik.services.kriteria import sub_jenis

        return next((s['nama'] for s in sub_jenis(obj.sektor.kode) if s['kode'] == obj.sub_sektor), None) \
            if obj.sektor_id and obj.sub_sektor else None

    class Meta:
        model = ProyekInvestasi
        fields = [
            'id',
            'kode_proyek',
            'nama',
            'deskripsi',
            'investor',
            'provinsi',
            'provinsi_nama',
            'kabupaten_kota',
            'lokasi_detail',
            'sektor',
            'sektor_nama',
            'sektor_kode',
            'sub_sektor',
            'sub_sektor_nama',
            'nilai_investasi_miliar',
            'nilai_realisasi_miliar',
            'status',
            'status_display',
            'tanggal_mulai',
            'tanggal_target_selesai',
            'progress_pct',
            'proyeksi_tenaga_kerja',
            'realisasi_tenaga_kerja',
            'skor_kelayakan',
            'skor_risiko',
            'analisis_json',
            'created_at',
            'updated_at',
            'riwayat_status',
            'geometry',
            'luas_ha',
        ]
        read_only_fields = ['kode_proyek', 'created_at', 'updated_at']


class ProyekInvestasiListSerializer(serializers.ModelSerializer):
    provinsi_nama = serializers.SerializerMethodField()
    sektor_nama = serializers.CharField(source='sektor.nama', read_only=True, default=None)
    sektor_kode = serializers.CharField(source='sektor.kode', read_only=True, default=None)

    def get_provinsi_nama(self, obj):
        return obj.provinsi.nama if obj.provinsi_id else LABEL_TANPA_PROVINSI

    class Meta:
        model = ProyekInvestasi
        fields = [
            'id',
            'kode_proyek',
            'nama',
            'investor',
            'provinsi_nama',
            'sektor_nama',
            'sektor_kode',
            'nilai_investasi_miliar',
            'status',
            'progress_pct',
            'proyeksi_tenaga_kerja',
            'created_at',
        ]


class RekapRealisasiSerializer(serializers.ModelSerializer):
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)
    sektor_nama = serializers.CharField(source='sektor.nama', read_only=True)

    class Meta:
        model = RekapRealisasi
        fields = [
            'id',
            'provinsi',
            'provinsi_nama',
            'sektor',
            'sektor_nama',
            'tahun',
            'jumlah_proyek',
            'total_rencana_miliar',
            'total_realisasi_miliar',
            'total_tenaga_kerja',
            'pct_realisasi',
        ]
