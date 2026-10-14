from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from analitik.models import KetentuanRuang, PengaturanAnalisis, StatusHitungUlang
from analitik.services import pengaturan
from analitik.services.konstanta import EKOSISTEM_PESISIR
from analitik.tasks import jadwalkan_hitung_ulang
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
            cache.clear()
            jadwalkan_hitung_ulang(lokasi=[], skor=True)
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


def status_hitung_ulang():
    s = StatusHitungUlang.objects.filter(pk=1).first()
    if s is None:
        return {'berjalan': False, 'menunggu': False, 'tahap': '', 'ke': 0, 'dari': 0, 'mulai': None, 'selesai': None,
                'galat': ''}
    return {'berjalan': s.berjalan, 'menunggu': s.perlu_lokasi is not None or s.perlu_skor, 'tahap': s.tahap,
            'ke': s.ke, 'dari': s.dari, 'mulai': s.mulai, 'selesai': s.selesai, 'galat': s.galat}


class AdminPengaturanAnalisisViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminUser]
    lookup_field = 'kunci'
    lookup_value_regex = '[A-Z_]+'

    @staticmethod
    def _baris(meta, simpanan):
        s = simpanan.get(meta['kunci'])
        return {
            **meta,
            'bawaan': pengaturan.BAWAAN[meta['kunci']],
            'nilai': s.nilai if s else pengaturan.BAWAAN[meta['kunci']],
            'diubah': s is not None,
            'diubah_oleh': s.diubah_oleh.get_username() if s and s.diubah_oleh else '',
            'diubah_pada': s.updated_at if s else None,
        }

    @staticmethod
    def _simpanan(**saring):
        return {p.kunci: p for p in PengaturanAnalisis.objects.filter(**saring).select_related('diubah_oleh')}

    def list(self, request):
        simpanan = self._simpanan()
        return Response({
            'kelompok': [{'kode': k, 'label': label} for k, label in pengaturan.KELOMPOK],
            'daftar': [self._baris(m, simpanan) for m in pengaturan.DAFTAR],
            'label_bagian': pengaturan.LABEL_BAGIAN,
            'sektor': list(SektorInvestasi.objects.order_by('urutan', 'nama').values('kode', 'nama')),
            'syarat_karakter': pengaturan.SYARAT_KARAKTER,
            'syarat_tambahan': pengaturan.SYARAT_TAMBAHAN,
            'ekosistem': EKOSISTEM_PESISIR,
            'hitung_ulang': status_hitung_ulang(),
        })

    def update(self, request, kunci=None):
        if kunci not in pengaturan.TERDAFTAR:
            raise NotFound('Pengaturan tidak dikenal.')
        nilai = request.data.get('nilai')
        try:
            pengaturan.periksa(kunci, nilai)
        except pengaturan.NilaiTidakSah as e:
            raise ValidationError({'detail': str(e)}) from e
        PengaturanAnalisis.objects.update_or_create(kunci=kunci, defaults={'nilai': nilai, 'diubah_oleh': request.user})
        return self._setelah(kunci)

    def destroy(self, request, kunci=None):
        if kunci not in pengaturan.TERDAFTAR:
            raise NotFound('Pengaturan tidak dikenal.')
        PengaturanAnalisis.objects.filter(kunci=kunci).delete()
        return self._setelah(kunci)

    def _setelah(self, kunci):
        pengaturan.segarkan()
        cache.clear()
        dampak = pengaturan.TERDAFTAR[kunci]['dampak']
        if dampak:
            jadwalkan_hitung_ulang(lokasi=[] if pengaturan.PETA in dampak else None, skor=pengaturan.SKOR in dampak)
        return Response({
            **self._baris(pengaturan.TERDAFTAR[kunci], self._simpanan(kunci=kunci)),
            'hitung_ulang': status_hitung_ulang(),
        })

    @action(detail=False, methods=['get', 'post'], url_path='hitung-ulang')
    def hitung_ulang(self, request):
        if request.method == 'POST':
            jadwalkan_hitung_ulang(lokasi=[], skor=True)
        else:
            jadwalkan_hitung_ulang()
        return Response(status_hitung_ulang())
