import io
import json
import re
from collections import Counter
from datetime import timedelta

import pandas as pd
from django.contrib.auth.models import User
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.cache import cache
from django.db import connection, transaction
from django.db.models.deletion import Collector
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from analitik.models import (
    AreaParameter,
    KetentuanRuang,
    NilaiWilayahParameter,
    ParameterTambahan,
    PengaturanAnalisis,
    StatusHitungUlang,
)
from analitik.services import konstanta, pengaturan
from analitik.services.asal_data import ringkasan_sumber
from analitik.services.kriteria import PARAMETER
from analitik.services.parameter_tambahan import geojson_area, kunci_nama
from analitik.tasks import jadwalkan_hitung_ulang
from inti.models import (
    KabupatenKota,
    LogAktivitas,
    ProfilPengguna,
    Provinsi,
    SektorInvestasi,
)
from inventarisasi.models import ZonasiRuangLaut
from ketenagakerjaan.models import KalibrasiPelatihanSektor, MatriksKeahlianSektor
from ketenagakerjaan.proyeksi import MATRIKS_KEAHLIAN
from pipeline.models import ProyekInvestasi

from .audit import catat, potret, selisih, simpan_berjejak
from .izin import LEVEL, level
from .kbli import ringkas
from .kesehatan import periksa_semua
from .serializers import SektorInvestasiSerializer
from .serializers_admin import (
    SUB_ZONA_BERKETENTUAN,
    AdminLogAktivitasSerializer,
    AdminProyekSerializer,
    AdminUserSerializer,
    KetentuanSektorSerializer,
    KompetensiSektorSerializer,
    ParameterTambahanSerializer,
    TambahAkunSerializer,
)


def _nama_akun(u):
    return u.get_full_name() or u.username


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('profil').all().order_by('-date_joined')
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]

    def create(self, request, *args, **kwargs):
        serializer = TambahAkunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data['level'] == 'ADMIN' and not request.user.is_superuser:
            raise PermissionDenied('Hanya Super Admin yang dapat membuat akun Administrator.')
        user = serializer.save()
        catat(request, f"Menambahkan akun '{_nama_akun(user)}' dengan level {LEVEL[level(user)]}", f'Akun @{user.username}')
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        data_profil = serializer.validated_data.get('profil') or {}
        profil = ProfilPengguna.objects.filter(user=serializer.instance).first()
        lama = {k: potret(getattr(profil, k, None)) for k in data_profil}
        user, rincian = simpan_berjejak(serializer)
        profil = ProfilPengguna.objects.filter(user=user).first()
        rincian += selisih(lama, {k: potret(getattr(profil, k, None)) for k in data_profil},
                           lambda k: str(ProfilPengguna._meta.get_field(k).verbose_name).capitalize())
        catat(self.request, f"Mengubah akun '{_nama_akun(user)}'", f'Akun @{user.username}', rincian)

    @action(detail=True, methods=['post'], url_path='level')
    def ubah_level(self, request, pk=None):
        sasaran = self.get_object()
        baru = request.data.get('level')
        if baru not in LEVEL:
            raise ValidationError({'detail': 'Level akses tidak dikenal.'})
        if sasaran.pk == request.user.pk:
            raise ValidationError({'detail': 'Anda tidak dapat mengubah level akses akun Anda sendiri.'})
        if sasaran.is_superuser:
            raise ValidationError({'detail': 'Level akses Super Admin tidak dapat diubah.'})
        lama = level(sasaran)
        if 'ADMIN' in (lama, baru) and lama != baru and not request.user.is_superuser:
            raise PermissionDenied('Hanya Super Admin yang dapat memberi atau mencabut level Administrator.')
        with transaction.atomic():
            sasaran.is_staff = baru == 'ADMIN'
            sasaran.save(update_fields=['is_staff'])
            profil, _ = ProfilPengguna.objects.get_or_create(user=sasaran)
            profil.akses_portofolio = baru == 'PENUH'
            profil.save(update_fields=['akses_portofolio'])
        catat(request, f"Mengubah level akses akun '{_nama_akun(sasaran)}'", f'Akun @{sasaran.username}',
              [f'Level: {LEVEL[lama]} → {LEVEL[baru]}'])
        return Response(AdminUserSerializer(User.objects.select_related('profil').get(pk=sasaran.pk)).data)

    def destroy(self, request, *args, **kwargs):
        sasaran = self.get_object()
        if sasaran.pk == request.user.pk:
            raise ValidationError({'detail': 'Anda tidak dapat menghapus akun Anda sendiri.'})
        if sasaran.is_superuser and not request.user.is_superuser:
            raise ValidationError({'detail': 'Akun superadmin hanya dapat dihapus oleh superadmin.'})
        catat(request, f"Menghapus akun '{_nama_akun(sasaran)}'", f'Akun @{sasaran.username}')
        sasaran.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


RENTANG_AKTIF_MENIT = 3


@api_view(['GET'])
@permission_classes([IsAdminUser])
def status_sistem(request):
    kunci = 'admin:status-sistem'
    kesehatan = cache.get(kunci)
    if kesehatan is None:
        kesehatan = periksa_semua()
        cache.set(kunci, kesehatan, 15)
    sekarang = timezone.now()
    pengguna = User.objects.all()
    return Response({
        'pengguna': {
            'terdaftar': pengguna.count(),
            'nonaktif': pengguna.filter(is_active=False).count(),
            'aktif_sekarang': pengguna.filter(
                profil__terakhir_aktif__gte=sekarang - timedelta(minutes=RENTANG_AKTIF_MENIT)
            ).count(),
            'aktif_hari_ini': pengguna.filter(
                profil__terakhir_aktif__gte=sekarang - timedelta(hours=24)
            ).count(),
            'rentang_aktif_menit': RENTANG_AKTIF_MENIT,
        },
        'kesehatan': kesehatan,
        'diperiksa_pada': sekarang,
    })


class AdminProyekViewSet(viewsets.ModelViewSet):
    queryset = ProyekInvestasi.objects.select_related('sektor', 'provinsi', 'created_by').all().order_by('-created_at')
    serializer_class = AdminProyekSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

    def perform_update(self, serializer):
        serializer.instance._history_user = self.request.user
        p, rincian = simpan_berjejak(serializer)
        catat(self.request, f"Mengubah proyek '{p.nama}'", f'Proyek {p.kode_proyek}', rincian)

    def perform_destroy(self, instance):
        catat(self.request, f"Menghapus proyek '{instance.nama}'", f'Proyek {instance.kode_proyek}')
        instance.delete()


LABEL_DAMPAK = {
    'analitik.LokasiPotensial': 'Lokasi potensial di Peta Sebaran',
    'analitik.SkorKelayakanZona': 'Skor kelayakan zona',
    'analitik.KetentuanRuang': 'Ketentuan zona (boleh, bersyarat, dilarang)',
    'analitik.AnalisisKelayakan': 'Hasil analisis kelayakan tersimpan',
    'analitik.ParameterAHP': 'Bobot penilaian (AHP)',
    'ketenagakerjaan.KalibrasiPelatihanSektor': 'Kalibrasi pelatihan tenaga kerja',
    'ketenagakerjaan.MatriksKeahlianSektor': 'Kebutuhan kompetensi tenaga kerja',
    'pipeline.RekapRealisasi': 'Rekap realisasi investasi',
}


def _bersihkan_pengaturan(sektor):
    sub = set(konstanta.KRITERIA_JENIS.get(sektor.kode, {})) | set(pengaturan.atur('KRITERIA_JENIS').get(sektor.kode, {}))
    for p in PengaturanAnalisis.objects.all():
        if not isinstance(p.nilai, dict):
            continue
        bawaan = pengaturan.BAWAAN.get(p.kunci)
        buang = (({sektor.kode} | sub) & set(p.nilai)) - set(bawaan if isinstance(bawaan, dict) else ())
        if buang:
            p.nilai = {k: v for k, v in p.nilai.items() if k not in buang}
            p.save(update_fields=['nilai'])
    pengaturan.segarkan()


class AdminSektorViewSet(viewsets.ModelViewSet):
    queryset = SektorInvestasi.objects.all().order_by('urutan', 'nama')
    serializer_class = SektorInvestasiSerializer
    permission_classes = [IsAdminUser]

    def perform_create(self, serializer):
        s = serializer.save()
        catat(self.request, f"Menambahkan jenis investasi '{s.nama}'", f'Jenis {s.kode}')

    def perform_update(self, serializer):
        s, rincian = simpan_berjejak(serializer)
        catat(self.request, f"Mengubah jenis investasi '{s.nama}'", f'Jenis {s.kode}', rincian)

    @action(detail=True, methods=['get'])
    def dampak(self, request, pk=None):
        sektor = self.get_object()
        pengumpul = Collector(using='default')
        pengumpul.collect([sektor])
        jumlah = Counter()
        for model, isi in pengumpul.data.items():
            jumlah[model._meta.label] += len(isi)
        for qs in pengumpul.fast_deletes:
            jumlah[qs.model._meta.label] += qs.count()
        return Response({
            'terhapus': [
                {'nama': LABEL_DAMPAK.get(label, label.split('.')[-1]), 'jumlah': n}
                for label, n in jumlah.most_common()
                if n and label != SektorInvestasi._meta.label and '_' not in label.split('.')[-1]
            ],
            'proyek': sektor.proyek.count(),
        })

    def perform_destroy(self, instance):
        with transaction.atomic():
            proyek = ProyekInvestasi.objects.filter(sektor=instance).update(sub_sektor='')
            _bersihkan_pengaturan(instance)
            instance.delete()
        cache.clear()
        catat(self.request, f"Menghapus jenis investasi '{instance.nama}' beserta datanya", f'Jenis {instance.kode}',
              [f'{proyek} proyek kini tanpa jenis investasi'] if proyek else ())

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
            lama = {kode: ada[kode].status for kode in ada}
            ada = {k.sub_zona: k for k in KetentuanRuang.objects.filter(sektor=sektor, provinsi=None)}
            label = dict(SUB_ZONA_BERKETENTUAN)
            catat(request, f"Mengubah ketentuan zona jenis investasi '{sektor.nama}'", f'Jenis {sektor.kode}',
                  selisih(lama, {kode: ada[kode].status for kode in ada}, lambda k: label.get(k, k)))
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
            catat(request, f"Mengubah kebutuhan kompetensi jenis investasi '{sektor.nama}'", f'Jenis {sektor.kode}',
                  [f"{d['nama_posisi']}: {round(d['pct_demand'] * 100, 1)}%" for d in ser.validated_data])
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


class AdminLogAktivitasViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LogAktivitas.objects.select_related('pengguna').all()
    serializer_class = AdminLogAktivitasSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['aksi', 'nama_pengguna', 'kode_status', 'metode']
    search_fields = ['nama_pengguna', 'jalur', 'objek', 'ringkasan', 'rincian', 'alamat_ip']
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
        sektor = list(SektorInvestasi.objects.order_by('urutan', 'nama').values('kode', 'nama'))
        return Response({
            'kelompok': [{'kode': k, 'label': label, 'keterangan': ket, 'halaman': halaman}
                         for k, label, ket, halaman in pengaturan.KELOMPOK],
            'daftar': [self._baris(m, simpanan) for m in pengaturan.DAFTAR],
            'label_bagian': pengaturan.LABEL_BAGIAN,
            'sektor': sektor,
            'templat_model_usaha': {s['kode']: konstanta.model_usaha_kosong(s['kode']) for s in sektor},
            'parameter_kriteria': {k: {'label': label, 'satuan': satuan} for k, (label, satuan, _) in PARAMETER.items()},
            'kbli': {isi['kbli']: ringkas(isi['kbli'])['judul']
                     for sumber in (konstanta.KRITERIA_JENIS, pengaturan.atur('KRITERIA_JENIS'))
                     for per_sub in sumber.values() for isi in per_sub.values() if ringkas(isi.get('kbli'))},
            'hitung_ulang': status_hitung_ulang(),
            'sumber_data': ringkasan_sumber(),
        })

    def update(self, request, kunci=None):
        if kunci not in pengaturan.TERDAFTAR:
            raise NotFound('Pengaturan tidak dikenal.')
        nilai = request.data.get('nilai')
        try:
            pengaturan.periksa(kunci, nilai)
        except pengaturan.NilaiTidakSah as e:
            raise ValidationError({'detail': str(e)}) from e
        meta = pengaturan.TERDAFTAR[kunci]
        lama = pengaturan.atur(kunci)
        PengaturanAnalisis.objects.update_or_create(kunci=kunci, defaults={'nilai': nilai, 'diubah_oleh': request.user})
        catat(request, f"Mengubah pengaturan '{meta['label']}'", 'Pengaturan', self._selisih(meta, lama, nilai))
        return self._setelah(kunci)

    def destroy(self, request, kunci=None):
        if kunci not in pengaturan.TERDAFTAR:
            raise NotFound('Pengaturan tidak dikenal.')
        meta = pengaturan.TERDAFTAR[kunci]
        lama = pengaturan.atur(kunci)
        PengaturanAnalisis.objects.filter(kunci=kunci).delete()
        catat(request, f"Mengembalikan pengaturan '{meta['label']}' ke nilai bawaan", 'Pengaturan',
              self._selisih(meta, lama, pengaturan.BAWAAN[kunci]))
        return self._setelah(kunci)

    @staticmethod
    def _selisih(meta, lama, baru):
        if not (isinstance(lama, dict) and isinstance(baru, dict)):
            lama, baru = {meta['label']: lama}, {meta['label']: baru}
        nama = {**pengaturan.LABEL_BAGIAN, **dict(SektorInvestasi.objects.values_list('kode', 'nama'))}
        return selisih(lama, baru, lambda k: nama.get(k, k))

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


def _cakupan(p):
    if not (p.area.exists() if p.tipe == 'AREA' else p.nilai_wilayah.exists()):
        return set()
    return set(p.provinsi.values_list('kode_bps', flat=True)) or None


def _berpengaruh(p):
    return p is not None and p.aktif and p.peran != 'INFORMASI'


def _picu_parameter(lama, baru, cakupan_lama, cakupan_baru):
    cache.clear()
    if not (_berpengaruh(lama) or _berpengaruh(baru)):
        return
    cakupan = [c for c in (cakupan_lama, cakupan_baru) if c != 'tidak ada']
    if any(c is None for c in cakupan):
        jadwalkan_hitung_ulang(lokasi=[])
    elif set().union(*cakupan):
        jadwalkan_hitung_ulang(lokasi=sorted(set().union(*cakupan)))


class AdminParameterTambahanViewSet(viewsets.ModelViewSet):
    queryset = ParameterTambahan.objects.prefetch_related('sektor', 'provinsi')
    serializer_class = ParameterTambahanSerializer
    permission_classes = [IsAdminUser]

    def perform_create(self, serializer):
        p = serializer.save(dibuat_oleh=self.request.user)
        catat(self.request, f"Menambahkan parameter tambahan '{p.nama}'", 'Parameter tambahan')
        _picu_parameter(None, p, 'tidak ada', _cakupan(p))

    def perform_update(self, serializer):
        lama = ParameterTambahan.objects.get(pk=serializer.instance.pk)
        cakupan_lama = _cakupan(lama)
        p, rincian = simpan_berjejak(serializer)
        catat(self.request, f"Mengubah parameter tambahan '{p.nama}'", 'Parameter tambahan', rincian)
        _picu_parameter(lama, p, cakupan_lama, _cakupan(p))

    def perform_destroy(self, instance):
        cakupan = _cakupan(instance)
        catat(self.request, f"Menghapus parameter tambahan '{instance.nama}'", 'Parameter tambahan')
        instance.delete()
        _picu_parameter(instance, None, cakupan, 'tidak ada')

    @action(detail=True, methods=['get', 'post'])
    def area(self, request, pk=None):
        p = self.get_object()
        if request.method == 'POST':
            if p.tipe != 'AREA':
                raise ValidationError({'detail': 'Parameter ini bertipe tabel, bukan area.'})
            bentuk = []
            for f in request.data.get('features') or []:
                g = (f or {}).get('geometry') or {}
                if g.get('type') not in ('Polygon', 'MultiPolygon'):
                    continue
                geom = GEOSGeometry(json.dumps(g), srid=4326)
                x0, y0, x1, y1 = geom.extent
                if x0 < 90 or x1 > 145 or y0 < -15 or y1 > 10:
                    raise ValidationError({'detail': 'Koordinat di luar wilayah Indonesia; pastikan berkas memakai '
                                                     'derajat WGS84 (EPSG:4326) atau sertakan berkas .prj.'})
                geom = geom if geom.valid else geom.buffer(0)
                if geom.geom_type == 'Polygon':
                    geom = MultiPolygon(geom, srid=4326)
                if geom.geom_type != 'MultiPolygon' or geom.empty:
                    continue
                sifat = {k.lower(): v for k, v in ((f or {}).get('properties') or {}).items()}
                nama = next((str(sifat[k]) for k in ('nama', 'name', 'namobj', 'keterangan') if sifat.get(k)), '')
                bentuk.append(AreaParameter(parameter=p, nama=nama[:255], geometry=geom))
            if not bentuk:
                raise ValidationError({'detail': 'Berkas tidak memuat poligon area.'})
            lama = ParameterTambahan.objects.get(pk=p.pk)
            cakupan_lama = _cakupan(lama)
            with transaction.atomic():
                p.area.all().delete()
                AreaParameter.objects.bulk_create(bentuk)
                if not p.provinsi.exists():
                    p.provinsi.set(Provinsi.objects.filter(id__in=ZonasiRuangLaut.objects.filter(
                        geometry__intersects=MultiPolygon(
                            [poli for b in bentuk for poli in b.geometry], srid=4326).unary_union,
                    ).values('provinsi_id')))
            _picu_parameter(lama, p, cakupan_lama, _cakupan(p))
            catat(request, f"Mengunggah area parameter tambahan '{p.nama}'", 'Parameter tambahan',
                  [f'{len(bentuk)} poligon area'])
        with connection.cursor() as c:
            geojson = geojson_area(c, p.id)
        return Response({'jumlah': p.area.count(), 'provinsi': sorted(_cakupan(p) or []), 'geojson': geojson})

    @action(detail=True, methods=['get', 'post'], parser_classes=[MultiPartParser, FormParser])
    def tabel(self, request, pk=None):
        p = self.get_object()
        hasil = {}
        if request.method == 'POST':
            if p.tipe != 'TABEL':
                raise ValidationError({'detail': 'Parameter ini bertipe area, bukan tabel.'})
            berkas = request.FILES.get('berkas')
            if berkas is None:
                raise ValidationError({'detail': 'Pilih berkas CSV atau Excel.'})
            try:
                if berkas.name.lower().endswith(('.xlsx', '.xls')):
                    df = pd.read_excel(berkas)
                else:
                    mentah = berkas.read()
                    try:
                        teks = mentah.decode('utf-8-sig')
                    except UnicodeDecodeError:
                        teks = mentah.decode('latin-1')
                    df = pd.read_csv(io.StringIO(teks), sep=None, engine='python', dtype=str)
            except Exception as e:
                raise ValidationError({'detail': f'Berkas tidak dapat dibaca: {e}'}) from e
            hasil = _simpan_tabel(p, df)
            _picu_parameter(p, p, _cakupan(p), _cakupan(p))
            catat(request, f"Mengunggah tabel nilai parameter tambahan '{p.nama}'", 'Parameter tambahan',
                  [f'Berkas {berkas.name}'])
        baris = p.nilai_wilayah.select_related('provinsi', 'kabupaten').order_by('kabupaten__kode_bps', 'provinsi__kode_bps')
        return Response({**hasil, 'baris': [
            {'kode': (b.kabupaten or b.provinsi).kode_bps, 'wilayah': (b.kabupaten or b.provinsi).nama, 'nilai': b.nilai}
            for b in baris
        ]})


KOLOM_KODE = {'kode', 'kodebps', 'kodewilayah', 'kdkab', 'kdprov', 'idkab', 'idprov'}
KOLOM_NAMA = {'nama', 'wilayah', 'namawilayah', 'kabupaten', 'kabupatenkota', 'kabkota', 'kota', 'provinsi'}
KOLOM_NILAI = {'nilai', 'value', 'angka'}


def _simpan_tabel(p, df):
    kolom = {re.sub(r'[^a-z]', '', str(k).lower()): k for k in df.columns}
    kode = next((kolom[k] for k in kolom if k in KOLOM_KODE), None)
    nama = next((kolom[k] for k in kolom if k in KOLOM_NAMA), None)
    nilai = next((kolom[k] for k in kolom if k in KOLOM_NILAI), None) or next(
        (k for k in df.columns if k not in (kode, nama) and pd.to_numeric(df[k], errors='coerce').notna().any()), None)
    if nilai is None or (kode is None and nama is None):
        raise ValidationError({'detail': 'Tabel wajib memuat kolom kode atau nama wilayah, dan kolom nilai.'})
    kabupaten = p.tingkat == 'KABUPATEN'
    wilayah = KabupatenKota.objects.all() if kabupaten else Provinsi.objects.all()
    provinsi = list(p.provinsi.values_list('id', flat=True))
    if kabupaten and provinsi:
        wilayah = wilayah.filter(provinsi_id__in=provinsi)
    per_kode = {w.kode_bps.replace('.', ''): w for w in wilayah}
    per_nama = {kunci_nama(w.nama): w for w in wilayah}
    simpan, gagal = {}, []
    for _, r in df.iterrows():
        angka = pd.to_numeric(r[nilai].replace(',', '.') if isinstance(r[nilai], str) else r[nilai], errors='coerce')
        label = str(r[nama] if nama is not None else r[kode])
        w = None
        if kode is not None and pd.notna(r[kode]):
            mentah = r[kode]
            teks = str(int(mentah)) if isinstance(mentah, float) and mentah.is_integer() else str(mentah)
            w = per_kode.get(re.sub(r'\D', '', teks))
        if w is None and nama is not None:
            w = per_nama.get(kunci_nama(r[nama]))
        if w is None or pd.isna(angka):
            gagal.append(label if w is None else f'{label} (nilai bukan angka)')
            continue
        simpan[w.id] = NilaiWilayahParameter(
            parameter=p, nilai=float(angka), **({'kabupaten': w} if kabupaten else {'provinsi': w}))
    if not simpan:
        raise ValidationError({'detail': 'Tidak ada baris yang cocok dengan wilayah terdaftar.', 'tidak_cocok': gagal[:50]})
    with transaction.atomic():
        p.nilai_wilayah.all().delete()
        NilaiWilayahParameter.objects.bulk_create(simpan.values())
    return {'cocok': len(simpan), 'tidak_cocok': gagal[:50], 'jumlah_tidak_cocok': len(gagal)}
