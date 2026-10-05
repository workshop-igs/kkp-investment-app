from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from analitik.models import KetentuanRuang
from analitik.services.konstanta import SUB_ZONA_TANPA_RINCIAN
from inti.models import LogAktivitas, ProfilPengguna
from inventarisasi.models import ZonasiRuangLaut
from ketenagakerjaan.models import MatriksKeahlianSektor
from pipeline.models import ProyekInvestasi

SUB_ZONA_BERKETENTUAN = [(k, v) for k, v in ZonasiRuangLaut.SUB_ZONA_CHOICES if k not in SUB_ZONA_TANPA_RINCIAN]


class AdminProfilPenggunaSerializer(serializers.ModelSerializer):
    class Meta:  # type: ignore
        model = ProfilPengguna
        fields = ['instansi', 'telepon', 'provinsi']


class AdminUserSerializer(serializers.ModelSerializer):
    profil = AdminProfilPenggunaSerializer()
    role_display = serializers.SerializerMethodField()
    provinsi_nama = serializers.CharField(source='profil.provinsi.nama', read_only=True)

    class Meta:  # type: ignore
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 
            'is_active', 'is_staff', 'is_superuser', 'date_joined',
            'profil', 'role_display', 'provinsi_nama'
        ]
        read_only_fields = ['is_staff', 'is_superuser', 'date_joined']

    def get_role_display(self, obj):
        return 'Administrator' if obj.is_staff else 'Pengguna KKP'

    def validate(self, attrs):
        diminta = sorted({'is_staff', 'is_superuser'} & set(self.initial_data))
        if diminta:
            raise PermissionDenied(
                'Akses administrator hanya diberikan dengan menambahkan akun '
                'administrator baru, tidak dengan mengubah akun yang sudah ada.'
            )
        request = self.context.get('request')
        if (self.instance is not None and request is not None
                and self.instance.pk == request.user.pk and attrs.get('is_active') is False):
            raise serializers.ValidationError(
                {'is_active': ['Anda tidak dapat menonaktifkan akun Anda sendiri.']}
            )
        return attrs

    def update(self, instance, validated_data):
        data_profil = validated_data.pop('profil', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if data_profil:
            profil, _ = ProfilPengguna.objects.get_or_create(user=instance)
            for attr, value in data_profil.items():
                setattr(profil, attr, value)
            profil.save()

        return instance


class TambahAdminSerializer(serializers.Serializer):
    username = serializers.RegexField(
        r'^[\w.@+-]+$', min_length=3, max_length=150,
        error_messages={'invalid': 'Hanya huruf, angka, dan tanda . @ + - _ tanpa spasi.'},
    )
    email = serializers.EmailField(max_length=254)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    instansi = serializers.CharField(max_length=255, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_ulang = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, nilai):
        nilai = nilai.lower()
        if User.objects.filter(username__iexact=nilai).exists():
            raise serializers.ValidationError('Nama pengguna ini sudah dipakai.')
        return nilai

    def validate_email(self, nilai):
        nilai = nilai.lower()
        if User.objects.filter(email__iexact=nilai).exists():
            raise serializers.ValidationError('Surel ini sudah terdaftar.')
        return nilai

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_ulang'):
            raise serializers.ValidationError({'password_ulang': ['Tidak sama dengan kata sandi.']})
        calon = User(username=attrs['username'], email=attrs['email'], first_name=attrs['first_name'])
        try:
            validate_password(attrs['password'], user=calon)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': e.messages}) from e
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            user = User.objects.create_user(
                username=validated_data['username'],
                email=validated_data['email'],
                password=validated_data['password'],
                first_name=validated_data['first_name'].strip(),
                last_name=validated_data.get('last_name', '').strip(),
                is_staff=True,
            )
            profil, _ = ProfilPengguna.objects.get_or_create(user=user)
            profil.instansi = (validated_data.get('instansi') or '').strip() or 'Kementerian Kelautan dan Perikanan'
            profil.save()
        return user


class AdminLogAktivitasSerializer(serializers.ModelSerializer):
    aksi_label = serializers.CharField(source='get_aksi_display', read_only=True)

    class Meta:  # type: ignore
        model = LogAktivitas
        fields = [
            'id', 'waktu', 'nama_pengguna', 'aksi', 'aksi_label', 'metode',
            'jalur', 'objek', 'ringkasan', 'kode_status', 'alamat_ip', 'agen',
        ]
        read_only_fields = fields


class AdminProyekSerializer(serializers.ModelSerializer):
    sektor_nama = serializers.CharField(source='sektor.nama', read_only=True)
    provinsi_nama = serializers.CharField(source='provinsi.nama', read_only=True)
    investor_nama = serializers.CharField(source='created_by.first_name', read_only=True)

    class Meta:  # type: ignore
        model = ProyekInvestasi
        fields = '__all__'
        read_only_fields = ['kode_proyek', 'created_by', 'created_at', 'updated_at']


class KetentuanSektorSerializer(serializers.Serializer):
    sub_zona = serializers.ChoiceField(choices=SUB_ZONA_BERKETENTUAN)
    status = serializers.ChoiceField(choices=KetentuanRuang.STATUS_CHOICES, allow_blank=True)
    syarat = serializers.CharField(allow_blank=True, max_length=1000, required=False, default='')


class KompetensiSektorSerializer(serializers.ModelSerializer):
    pct_demand = serializers.FloatField(min_value=0, max_value=1)
    durasi_pelatihan_bulan = serializers.IntegerField(min_value=1, max_value=60)
    estimasi_biaya_per_orang_juta = serializers.FloatField(min_value=0)

    class Meta:  # type: ignore
        model = MatriksKeahlianSektor
        fields = ['nama_posisi', 'pct_demand', 'prioritas', 'lembaga_pelatihan_rekomendasi',
                  'durasi_pelatihan_bulan', 'estimasi_biaya_per_orang_juta', 'skema_sertifikasi']
