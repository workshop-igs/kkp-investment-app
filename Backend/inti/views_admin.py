from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from analitik.models import KetentuanRuang
from inti.models import (
    LogAktivitas,
    SektorInvestasi,
    SumberData,
)
from ketenagakerjaan.models import KalibrasiPelatihanSektor, MatriksKeahlianSektor
from ketenagakerjaan.proyeksi import MATRIKS_KEAHLIAN
from pipeline.models import ProyekInvestasi

from .serializers import SektorInvestasiSerializer, SumberDataSerializer
from .serializers_admin import (
    SUB_ZONA_BERKETENTUAN,
    AdminLogAktivitasSerializer,
    AdminProyekSerializer,
    AdminUserSerializer,
    KetentuanSektorSerializer,
    KompetensiSektorSerializer,
    TambahAdminSerializer,
)


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('profil').all().order_by('-date_joined')
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]

    def create(self, request, *args, **kwargs):
        serializer = TambahAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminProyekViewSet(viewsets.ModelViewSet):
    queryset = ProyekInvestasi.objects.select_related('sektor', 'provinsi', 'created_by').all().order_by('-created_at')
    serializer_class = AdminProyekSerializer
    permission_classes = [IsAdminUser]


class AdminSektorViewSet(viewsets.ModelViewSet):
    queryset = SektorInvestasi.objects.all().order_by('urutan', 'nama')
    serializer_class = SektorInvestasiSerializer
    permission_classes = [IsAdminUser]

    @action(detail=True, methods=['get', 'put'])
    def ketentuan(self, request, pk=None):
        sektor = self.get_object()
        ada = {k.sub_zona: k for k in KetentuanRuang.objects.filter(sektor=sektor, provinsi=None)}
        if request.method == 'PUT':
            ser = KetentuanSektorSerializer(data=request.data, many=True)
            ser.is_valid(raise_exception=True)
            with transaction.atomic():
                for d in ser.validated_data:
                    lama = ada.get(d['sub_zona'])
                    if not d['status']:
                        if lama:
                            lama.delete()
                        continue
                    if lama and (lama.status, lama.syarat) == (d['status'], d['syarat']):
                        continue
                    KetentuanRuang.objects.update_or_create(
                        sektor=sektor, sub_zona=d['sub_zona'], provinsi=None,
                        defaults={'status': d['status'], 'syarat': d['syarat'], 'sumber': 'Ditetapkan administrator'},
                    )
            ada = {k.sub_zona: k for k in KetentuanRuang.objects.filter(sektor=sektor, provinsi=None)}
        return Response([
            {'sub_zona': kode, 'label': label, 'status': ada[kode].status if kode in ada else '',
             'syarat': ada[kode].syarat if kode in ada else '', 'sumber': ada[kode].sumber if kode in ada else ''}
            for kode, label in SUB_ZONA_BERKETENTUAN
        ])

    @action(detail=True, methods=['get', 'put'])
    def kompetensi(self, request, pk=None):
        sektor = self.get_object()
        if request.method == 'PUT':
            ser = KompetensiSektorSerializer(data=request.data, many=True)
            ser.is_valid(raise_exception=True)
            if sum(d['pct_demand'] for d in ser.validated_data) > 1.0001:
                raise ValidationError({'detail': 'Jumlah porsi seluruh kompetensi tidak boleh melebihi 100%.'})
            with transaction.atomic():
                kalibrasi, _ = KalibrasiPelatihanSektor.objects.get_or_create(sektor=sektor)
                kalibrasi.skill_matrix.all().delete()
                MatriksKeahlianSektor.objects.bulk_create(
                    [MatriksKeahlianSektor(labor_coefficient=kalibrasi, **d) for d in ser.validated_data]
                )
        baris = MatriksKeahlianSektor.objects.filter(labor_coefficient__sektor=sektor).order_by('-pct_demand')
        if baris.exists():
            return Response({'bawaan': False, 'baris': KompetensiSektorSerializer(baris, many=True).data})
        return Response({'bawaan': True, 'baris': [
            {'nama_posisi': m['posisi'], 'pct_demand': m['pct'], 'prioritas': m['prioritas'],
             'lembaga_pelatihan_rekomendasi': m['lembaga'], 'durasi_pelatihan_bulan': m['bulan'],
             'estimasi_biaya_per_orang_juta': m['biaya_juta'], 'skema_sertifikasi': m['skema']}
            for m in MATRIKS_KEAHLIAN.get(sektor.kode, MATRIKS_KEAHLIAN['DEFAULT'])
        ]})


class AdminDataSourceViewSet(viewsets.ModelViewSet):
    queryset = SumberData.objects.all().order_by('nama')
    serializer_class = SumberDataSerializer
    permission_classes = [IsAdminUser]


class AdminLogAktivitasViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LogAktivitas.objects.select_related('pengguna').all()
    serializer_class = AdminLogAktivitasSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['aksi', 'nama_pengguna', 'kode_status', 'metode']
    search_fields = ['nama_pengguna', 'jalur', 'objek', 'ringkasan', 'alamat_ip']
    ordering_fields = ['waktu', 'aksi', 'nama_pengguna']

    @action(detail=False, methods=['get'], url_path='pilihan-aksi')
    def pilihan_aksi(self, request):
        return Response(
            [{'kode': k, 'label': v} for k, v in LogAktivitas.AKSI_CHOICES]
        )
