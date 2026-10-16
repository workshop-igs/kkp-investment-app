import io
import json
import re
from datetime import timedelta

import pandas as pd
from django.contrib.auth.models import User
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.cache import cache
from django.db import connection, transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound, ValidationError
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
from analitik.services import pengaturan
from analitik.services.konstanta import EKOSISTEM_PESISIR
from analitik.services.parameter_tambahan import kunci_nama
from analitik.tasks import jadwalkan_hitung_ulang
from inti.models import (
    KabupatenKota,
    LogAktivitas,
    Provinsi,
    SektorInvestasi,
    SumberData,
)
from inventarisasi.models import ZonasiRuangLaut
from ketenagakerjaan.models import KalibrasiPelatihanSektor, MatriksKeahlianSektor
from ketenagakerjaan.proyeksi import MATRIKS_KEAHLIAN
from pipeline.models import ProyekInvestasi

from .kesehatan import periksa_semua
from .serializers import SektorInvestasiSerializer, SumberDataSerializer
from .serializers_admin import (
    SUB_ZONA_BERKETENTUAN,
    AdminLogAktivitasSerializer,
    AdminProyekSerializer,
    AdminUserSerializer,
    KetentuanSektorSerializer,
    KompetensiSektorSerializer,
    ParameterTambahanSerializer,
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

    def destroy(self, request, *args, **kwargs):
        sasaran = self.get_object()
        if sasaran.pk == request.user.pk:
            raise ValidationError({'detail': 'Anda tidak dapat menghapus akun Anda sendiri.'})
        if sasaran.is_superuser and not request.user.is_superuser:
            raise ValidationError({'detail': 'Akun superadmin hanya dapat dihapus oleh superadmin.'})
        # Proyek dan log aktivitas tetap tersimpan: relasinya ke akun di-set kosong (SET_NULL).
        sasaran.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# Pengguna dihitung aktif bila ada permintaan darinya (termasuk denyut tiap menit dari tab yang terbuka)
# dalam rentang ini.
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
        _picu_parameter(None, p, 'tidak ada', _cakupan(p))

    def perform_update(self, serializer):
        lama = ParameterTambahan.objects.get(pk=serializer.instance.pk)
        cakupan_lama = _cakupan(lama)
        p = serializer.save()
        _picu_parameter(lama, p, cakupan_lama, _cakupan(p))

    def perform_destroy(self, instance):
        cakupan = _cakupan(instance)
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
        with connection.cursor() as c:
            c.execute(
                "SELECT json_build_object('type', 'FeatureCollection', 'features', COALESCE(json_agg(json_build_object("
                "'type', 'Feature', 'properties', json_build_object('nama', nama), 'geometry', "
                "ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.0005), 5)::json)), '[]'::json)) "
                'FROM analitik_area_parameter WHERE parameter_id = %s',
                [p.id],
            )
            geojson = c.fetchone()[0]
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
