import logging
import re
from datetime import datetime

from django.contrib.gis.db.models.functions import AsGeoJSON, PointOnSurface
from django.db.models.functions import Coalesce
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import KabupatenKota, Provinsi, SektorInvestasi, SumberData
from .peta_bbox import jawaban_peta
from .serializers import (
    KabupatenKotaSerializer,
    ProvinsiListSerializer,
    ProvinsiSerializer,
    SektorInvestasiSerializer,
    SumberDataSerializer,
)

logger = logging.getLogger('inti')

CACHE_PROVINSI_DETIK = 3600


class ProvinsiViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Provinsi.objects.all()
    serializer_class = ProvinsiSerializer
    filterset_fields = ['kode_bps', 'nama']
    search_fields = ['nama']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProvinsiListSerializer
        return ProvinsiSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == 'list':
            return qs.defer('geometry', 'geometry_tampilan')
        return qs

    throttle_scope = 'peta'

    @action(
        detail=False,
        methods=['get'],
        url_path='peta',
        permission_classes=[permissions.AllowAny],
        throttle_classes=[ScopedRateThrottle],
    )
    def peta(self, request):
        return jawaban_peta(
            request, 'provinsi:peta', self._bangun_peta, CACHE_PROVINSI_DETIK
        )

    @action(detail=True, methods=['get'], url_path='profil-investasi', permission_classes=[permissions.AllowAny])
    def profil_investasi(self, request, pk=None):
        from django.core.cache import cache
        from django.db.models import Max

        from analitik.services.profil_investasi import profil_provinsi
        from inventarisasi.models import RegulasiTataRuang
        from penarikan_data.models import ProduksiPerikananBPS

        provinsi = self.get_object()
        sektor = None
        if request.query_params.get('jenis'):
            sektor = SektorInvestasi.objects.filter(kode=request.query_params['jenis']).first()
            if sektor is None:
                return Response({'detail': 'Jenis investasi tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)
        versi = '-'.join(
            str(int(t.timestamp())) if t else '0'
            for t in (
                ProduksiPerikananBPS.objects.aggregate(t=Max('diperbarui_pada'))['t'],
                RegulasiTataRuang.objects.aggregate(t=Max('ditarik_pada'))['t'],
            )
        )
        kunci = f'profil-provinsi:{provinsi.pk}:{sektor.kode if sektor else "semua"}:{versi}'
        profil = cache.get(kunci)
        if profil is None:
            profil = profil_provinsi(provinsi, sektor)
            cache.set(kunci, profil, 6 * 3600)
        return Response(profil)

    def _bangun_peta(self):
        import json as _json

        from django.db.models import Count, Sum

        from inventarisasi.models import (
            KKPRL,
            InfrastrukturPendukung,
            SumberDayaAlam,
            ZonasiRuangLaut,
        )
        from pipeline.models import ProyekInvestasi

        proyek = {
            r['provinsi_id']: r
            for r in ProyekInvestasi.objects.values('provinsi_id').annotate(
                jumlah=Count('id'),
                nilai=Sum('nilai_investasi_miliar'),
                realisasi=Sum('nilai_realisasi_miliar'),
                tenaga_kerja=Sum('proyeksi_tenaga_kerja'),
                luas=Sum('luas_ha'),
            )
        }

        pasar_kerja = peta_pasar_kerja()

        kkprl = {
            r['provinsi_id']: r
            for r in KKPRL.objects.filter(status='AKTIF')
            .values('provinsi_id')
            .annotate(jumlah=Count('id'), luas=Sum('luas_ha'))
        }
        zonasi = {
            r['provinsi_id']: r
            for r in ZonasiRuangLaut.objects.values('provinsi_id').annotate(
                jumlah=Count('id'), luas=Sum('luas_ha')
            )
        }

        ekosistem = {}
        for r in SumberDayaAlam.objects.values('provinsi_id', 'jenis').annotate(
            luas=Sum('luas_ha')
        ):
            ekosistem.setdefault(r['provinsi_id'], {})[r['jenis']] = r['luas'] or 0

        PELABUHAN = ('PELABUHAN_PERIKANAN', 'PELABUHAN_UMUM', 'PELABUHAN_PENYEBERANGAN')
        TENAGA = ('JARINGAN_LISTRIK', 'PEMBANGKIT_LISTRIK')
        infrastruktur = {}
        for r in InfrastrukturPendukung.objects.values('provinsi_id', 'kategori').annotate(
            jumlah=Count('id')
        ):
            d = infrastruktur.setdefault(
                r['provinsi_id'], {'pelabuhan': 0, 'kawasan_industri': 0, 'tenaga_listrik': 0}
            )
            if r['kategori'] in PELABUHAN:
                d['pelabuhan'] += r['jumlah']
            elif r['kategori'] == 'KAWASAN_INDUSTRI':
                d['kawasan_industri'] += r['jumlah']
            elif r['kategori'] in TENAGA:
                d['tenaga_listrik'] += r['jumlah']

        qs = (
            Provinsi.objects.exclude(geometry=None)
            .order_by('kode_bps')
            .annotate(geo=AsGeoJSON(Coalesce('geometry_tampilan', 'geometry'), precision=6))
        )

        fitur = []
        for p in qs.defer('geometry', 'geometry_tampilan'):
            pr = proyek.get(p.id, {})
            fitur.append(
                {
                    'type': 'Feature',
                    'geometry': _json.loads(p.geo),
                    'properties': {
                        'id': p.id,
                        'kode_bps': p.kode_bps,
                        'nama': p.nama,
                        'luas_laut_km2': p.luas_laut_km2,
                        'investasi': {
                            'jumlah_proyek': pr.get('jumlah', 0) or 0,
                            'nilai_rencana_miliar': round(float(pr.get('nilai') or 0), 1),
                            'nilai_realisasi_miliar': round(float(pr.get('realisasi') or 0), 1),
                            'tenaga_kerja': int(pr.get('tenaga_kerja') or 0),
                            'luas_proyek_ha': round(float(pr.get('luas') or 0), 1),
                        },
                        'ruang_laut': {
                            'kkprl_jumlah': (kkprl.get(p.id, {}).get('jumlah') or 0),
                            'kkprl_luas_ha': round(
                                float(kkprl.get(p.id, {}).get('luas') or 0), 1
                            ),
                            'zona_jumlah': (zonasi.get(p.id, {}).get('jumlah') or 0),
                            'zona_luas_ha': round(
                                float(zonasi.get(p.id, {}).get('luas') or 0), 1
                            ),
                        },
                        'ekosistem': {
                            'mangrove_ha': round(
                                float(ekosistem.get(p.id, {}).get('MANGROVE') or 0), 1
                            ),
                            'terumbu_karang_ha': round(
                                float(ekosistem.get(p.id, {}).get('TERUMBU_KARANG') or 0), 1
                            ),
                        },
                        'infrastruktur': infrastruktur.get(
                            p.id,
                            {'pelabuhan': 0, 'kawasan_industri': 0, 'tenaga_listrik': 0},
                        ),
                        'tenaga_kerja': pasar_kerja.get(p.kode_bps, KOSONG_KERJA),
                    },
                }
            )

        muatan = {
            'type': 'FeatureCollection',
            'features': fitur,
            'meta': {'jumlah': len(fitur)},
        }
        return muatan


KOSONG_KERJA = {'tahun': None, 'tpt_persen': None, 'penganggur_orang': None}


def peta_pasar_kerja() -> dict:
    from penarikan_data.bps import (
        DOMAIN_NASIONAL,
        TOLERANSI_TAHUN_DATA,
        tahun_angka,
    )
    from penarikan_data.models import StatistikKetenagakerjaanBPS

    tahun_acuan = datetime.now().year
    tahun_minimum = tahun_acuan - TOLERANSI_TAHUN_DATA

    baris = sorted(
        StatistikKetenagakerjaanBPS.objects.filter(domain=DOMAIN_NASIONAL),
        key=lambda b: tahun_angka(b.tahun) or 0,
        reverse=True,
    )

    hasil: dict = {}
    for b in baris:
        if (tahun_angka(b.tahun) or 0) < tahun_minimum:
            continue
        medan = {'tpt': 'tpt_persen', 'pengangguran': 'penganggur_orang'}.get(b.indikator)
        if medan is None:
            continue
        for kode, w in (b.per_wilayah or {}).items():
            dua = str(kode)[:2]
            catatan = hasil.setdefault(dua, dict(KOSONG_KERJA))
            if catatan[medan] is None:
                catatan[medan] = w.get('nilai')
                catatan['tahun'] = catatan['tahun'] or b.tahun
    return hasil


class KabupatenKotaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        KabupatenKota.objects.select_related('provinsi')
        .defer('geometry', 'provinsi__geometry', 'provinsi__geometry_tampilan')
        .all()
    )
    serializer_class = KabupatenKotaSerializer
    filterset_fields = ['provinsi', 'jenis', 'pesisir']
    search_fields = ['nama']


class SektorInvestasiViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SektorInvestasi.objects.filter(aktif=True)
    serializer_class = SektorInvestasiSerializer


class SumberDataViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SumberData.objects.all()
    serializer_class = SumberDataSerializer


def _sidik_pipeline() -> str:
    from django.db.models import Count, Max

    from pipeline.models import ProyekInvestasi

    agg = ProyekInvestasi.objects.aggregate(n=Count('id'), t=Max('updated_at'))
    return f"{agg['n'] or 0}:{agg['t'].timestamp() if agg['t'] else 0}"


CACHE_DASHBOARD_DETIK = 120


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    from django.core.cache import cache
    from django.db.models import Avg, Count, Sum

    from inventarisasi.models import KKPRL, PotensiInvestasi, ZonasiRuangLaut
    from pipeline.models import ProyekInvestasi

    kunci_cache = f'dashboard:{_sidik_pipeline()}'
    tersimpan = cache.get(kunci_cache)
    if tersimpan is not None:
        return Response(tersimpan)

    proyek_stats = ProyekInvestasi.objects.aggregate(
        total_proyek=Count('id'),
        total_investasi=Sum('nilai_investasi_miliar'),
        total_realisasi=Sum('nilai_realisasi_miliar'),
        total_tk=Sum('proyeksi_tenaga_kerja'),
        total_luas_ha=Sum('luas_ha'),
        avg_skor=Avg('skor_kelayakan'),
    )

    total_proyek = proyek_stats['total_proyek'] or 0
    total_investasi = float(proyek_stats['total_investasi'] or 0)
    total_realisasi = float(proyek_stats['total_realisasi'] or 0)
    total_tk = int(proyek_stats['total_tk'] or 0)
    total_luas_ha = float(proyek_stats['total_luas_ha'] or 0)
    avg_skor = float(proyek_stats['avg_skor'] or 0)

    status_counts = dict(
        ProyekInvestasi.objects.values_list('status').annotate(count=Count('id')).values_list('status', 'count')
    )
    status_values = dict(
        ProyekInvestasi.objects.values_list('status')
        .annotate(total_val=Sum('nilai_investasi_miliar'))
        .values_list('status', 'total_val')
    )

    status_labels = {
        'LOI': 'Letter of Intent',
        'FS': 'Feasibility Study',
        'DEV': 'Development',
        'OP': 'Operational',
    }

    proyek_per_status = [
        {
            'status': k,
            'label': status_labels.get(k, k),
            'count': status_counts.get(k, 0),
            'total_miliar': round(float(status_values.get(k, 0) or 0), 1),
        }
        for k in ['LOI', 'FS', 'DEV', 'OP']
    ]

    sektor_qs = (
        ProyekInvestasi.objects.values('sektor__id', 'sektor__nama', 'sektor__kode', 'sektor__warna')
        .annotate(
            count=Count('id'),
            total_rencana=Sum('nilai_investasi_miliar'),
            total_realisasi=Sum('nilai_realisasi_miliar'),
            total_tk=Sum('proyeksi_tenaga_kerja'),
            total_luas=Sum('luas_ha'),
        )
        .order_by('-total_rencana')
    )

    proyek_per_sektor = [
        {
            'sektor_id': s['sektor__id'],
            'sektor_nama': s['sektor__nama'] or 'Lainnya',
            'sektor_kode': s['sektor__kode'] or '',
            'sektor_warna': s['sektor__warna'] or '#0ea5e9',
            'count': s['count'],
            'total_rencana_miliar': round(float(s['total_rencana'] or 0), 1),
            'total_realisasi_miliar': round(float(s['total_realisasi'] or 0), 1),
            'total_tk': int(s['total_tk'] or 0),
            'total_luas_ha': round(float(s['total_luas'] or 0), 1),
        }
        for s in sektor_qs
    ]

    provinsi_qs = (
        ProyekInvestasi.objects.values('provinsi__id', 'provinsi__nama')
        .annotate(
            count=Count('id'),
            total_rencana=Sum('nilai_investasi_miliar'),
            total_realisasi=Sum('nilai_realisasi_miliar'),
            total_tk=Sum('proyeksi_tenaga_kerja'),
            total_luas=Sum('luas_ha'),
        )
        .order_by('-total_rencana')[:10]
    )

    proyek_per_provinsi = [
        {
            'provinsi_id': p['provinsi__id'],
            'provinsi_nama': p['provinsi__nama'] or 'Lainnya',
            'count': p['count'],
            'total_rencana_miliar': round(float(p['total_rencana'] or 0), 1),
            'total_realisasi_miliar': round(float(p['total_realisasi'] or 0), 1),
            'total_tk': int(p['total_tk'] or 0),
            'total_luas_ha': round(float(p['total_luas'] or 0), 1),
        }
        for p in provinsi_qs
    ]

    potensi_agg = PotensiInvestasi.objects.aggregate(
        total_potensi=Count('id'),
        total_nilai_potensi=Sum('nilai_potensi_miliar'),
        total_luas_potensi=Sum('luas_ha'),
    )
    total_kkprl = KKPRL.objects.count()
    total_zonasi = ZonasiRuangLaut.objects.count()

    map_markers = [
        {
            'id': p.id,
            'kode_proyek': p.kode_proyek,
            'nama': p.nama,
            'investor': p.investor,
            'sektor_nama': p.sektor.nama if p.sektor_id else 'Umum',
            'sektor_warna': getattr(p.sektor, 'warna', '#0ea5e9'),
            'provinsi_nama': p.provinsi.nama if p.provinsi_id else 'Perairan nasional',
            'lokasi_detail': p.lokasi_detail,
            'nilai_investasi_miliar': p.nilai_investasi_miliar,
            'nilai_realisasi_miliar': p.nilai_realisasi_miliar,
            'status': p.status,
            'luas_ha': p.luas_ha,
            'skor_kelayakan': p.skor_kelayakan,
            'proyeksi_tenaga_kerja': p.proyeksi_tenaga_kerja,
            'lat': round(p.titik.y, 6),
            'lng': round(p.titik.x, 6),
        }
        for p in (
            ProyekInvestasi.objects.exclude(geometry=None)
            .select_related('sektor', 'provinsi')
            .annotate(titik=PointOnSurface('geometry'))
            .defer('geometry', 'analisis_json', 'provinsi__geometry')
        )
        if p.titik is not None
    ]

    proyek_unggulan = [
        {
            'id': p.id,
            'kode_proyek': p.kode_proyek,
            'nama': p.nama,
            'investor': p.investor,
            'sektor_nama': p.sektor.nama if p.sektor_id else 'Umum',
            'provinsi_nama': p.provinsi.nama if p.provinsi_id else 'Perairan nasional',
            'nilai_investasi_miliar': p.nilai_investasi_miliar,
            'nilai_realisasi_miliar': p.nilai_realisasi_miliar,
            'status': p.status,
            'skor_kelayakan': p.skor_kelayakan,
            'luas_ha': p.luas_ha,
            'proyeksi_tenaga_kerja': p.proyeksi_tenaga_kerja,
        }
        for p in ProyekInvestasi.objects.select_related('sektor', 'provinsi')
        .defer('geometry', 'analisis_json', 'provinsi__geometry')
        .order_by('-nilai_investasi_miliar')[:6]
    ]

    muatan = {
            'summary': {
                'total_proyek': total_proyek,
                'total_investasi_miliar': round(total_investasi, 1),
                'total_realisasi_miliar': round(total_realisasi, 1),
                'pct_realisasi': round((total_realisasi / total_investasi * 100) if total_investasi > 0 else 0, 1),
                'total_tenaga_kerja': total_tk,
                'total_luas_ha': round(total_luas_ha, 1),
                'avg_skor_kelayakan': round(avg_skor, 2),
                'total_provinsi': Provinsi.objects.count(),
                'total_sektor': SektorInvestasi.objects.filter(aktif=True).count(),
                'potensi': {
                    'total_titik': potensi_agg['total_potensi'] or 0,
                    'total_nilai_miliar': round(float(potensi_agg['total_nilai_potensi'] or 0), 1),
                    'total_luas_ha': round(float(potensi_agg['total_luas_potensi'] or 0), 1),
                    'total_kkprl': total_kkprl,
                    'total_zonasi': total_zonasi,
                },
            },
            'proyek_per_status': proyek_per_status,
            'proyek_per_sektor': proyek_per_sektor,
            'proyek_per_provinsi': proyek_per_provinsi,
            'map_markers': map_markers,
            'proyek_unggulan': proyek_unggulan,
    }

    cache.set(kunci_cache, muatan, CACHE_DASHBOARD_DETIK)
    return Response(muatan)


CACHE_RINGKASAN_PUBLIK_DETIK = 3600


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def ringkasan_publik(request):
    from django.core.cache import cache
    from django.db.models import Count, F, Sum

    from analitik.services.profil_investasi import skor_sesuai
    from inventarisasi.models import KKPRL
    from pipeline.models import ProyekInvestasi

    kunci_cache = f'ringkasan-publik:{_sidik_pipeline()}'
    tersimpan = cache.get(kunci_cache)
    if tersimpan is not None:
        return Response(tersimpan)

    kkprl = KKPRL.objects.filter(status='AKTIF').aggregate(jumlah=Count('id'), luas=Sum('luas_ha'))
    tinggi = skor_sesuai().filter(kelas='TINGGI')
    muatan = {
        'proyek': ProyekInvestasi.objects.count(),
        'kkprl_aktif': kkprl['jumlah'] or 0,
        'kkprl_luas_ha': round(float(kkprl['luas'] or 0)),
        'zona_peluang_tinggi': tinggi.values('zona_id').distinct().count(),
        'peluang_per_jenis': list(
            tinggi.values(kode=F('sektor__kode'), nama=F('sektor__nama'))
            .annotate(zona=Count('zona_id', distinct=True))
            .order_by('-zona')
        ),
    }
    cache.set(kunci_cache, muatan, CACHE_RINGKASAN_PUBLIK_DETIK)
    return Response(muatan)


def _serialize_user(user):
    from .models import ProfilPengguna
    profil = getattr(user, 'profil', None)
    if not profil:
        profil, _ = ProfilPengguna.objects.get_or_create(user=user)

    full_name = f"{user.first_name} {user.last_name}".strip() or user.username

    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': full_name,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'role': 'ADMIN' if user.is_staff else 'PENGGUNA',
        'role_display': 'Administrator' if user.is_staff else 'Pengguna KKP',
        'instansi': profil.instansi or INSTANSI_BAWAAN,
        'telepon': profil.telepon or '',
        'provinsi_id': profil.provinsi_id if profil.provinsi else None,
        'provinsi_nama': profil.provinsi.nama if profil.provinsi else '',
        'terdaftar_pada': user.date_joined.isoformat() if user.date_joined else None,
    }


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_api(request):
    from django.contrib.auth import authenticate, login
    from django.contrib.auth.models import User

    data = request.data or {}
    identifier = (data.get('username') or data.get('email') or '').strip()
    password = (data.get('password') or '').strip()

    if not identifier or not password:
        return Response(
            {'detail': 'Username/email dan kata sandi wajib diisi.'},
            status=400
        )

    user = None
    if '@' in identifier:
        user_obj = User.objects.filter(email__iexact=identifier).first()
        if user_obj:
            user = authenticate(request, username=user_obj.username, password=password)
    else:
        user = authenticate(request, username=identifier, password=password)

    if user is None:
        return Response(
            {'detail': 'Username atau kata sandi tidak valid. Silakan periksa kembali.'},
            status=401
        )

    if not user.is_active:
        return Response(
            {'detail': 'Akun Anda sedang dinonaktifkan oleh administrator.'},
            status=403
        )

    if hasattr(request, 'session'):
        login(request, user)
    elif hasattr(request, '_request') and hasattr(request._request, 'session'):
        login(request._request, user)

    user_data = _serialize_user(user)

    return Response({
        'success': True,
        'message': f'Selamat datang kembali, {user_data["full_name"]}!',
        'user': user_data
    })


INSTANSI_BAWAAN = 'Kementerian Kelautan dan Perikanan'


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_api(request):
    from django.contrib.auth import login
    from django.contrib.auth.models import User
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError

    from .models import ProfilPengguna, Provinsi

    data = request.data or {}
    username = (data.get('username') or '').strip().lower()
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()
    full_name = (data.get('full_name') or '').strip()
    instansi = (data.get('instansi') or '').strip()
    telepon = (data.get('telepon') or '').strip()
    provinsi_id = data.get('provinsi')

    if not username:
        return Response({'detail': 'Username wajib diisi.'}, status=400)
    if len(username) < 3:
        return Response({'detail': 'Username minimal 3 karakter.'}, status=400)
    if not email or '@' not in email:
        return Response({'detail': 'Alamat email yang valid wajib diisi.'}, status=400)
    if not password:
        return Response({'detail': 'Kata sandi wajib diisi.'}, status=400)

    calon = User(username=username, email=email, first_name=(full_name.split(' ', 1)[0] if full_name else ''))
    try:
        validate_password(password, user=calon)
    except DjangoValidationError as e:
        return Response({'detail': ' '.join(e.messages), 'password': e.messages}, status=400)

    if User.objects.filter(username=username).exists():
        return Response({'detail': f'Username "{username}" sudah digunakan. Silakan pilih username lain.'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'detail': f'Email "{email}" sudah terdaftar dalam sistem.'}, status=400)

    name_parts = full_name.split(' ', 1)
    first_name = name_parts[0] if name_parts else username
    last_name = name_parts[1] if len(name_parts) > 1 else ''

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name
    )

    prov_obj = None
    if provinsi_id:
        prov_obj = Provinsi.objects.filter(id=provinsi_id).first()

    profil, _ = ProfilPengguna.objects.get_or_create(user=user)
    profil.instansi = instansi or INSTANSI_BAWAAN
    profil.telepon = telepon
    profil.provinsi = prov_obj
    profil.save()

    if hasattr(request, 'session'):
        login(request, user)
    elif hasattr(request, '_request') and hasattr(request._request, 'session'):
        login(request._request, user)

    user_data = _serialize_user(user)

    return Response({
        'success': True,
        'message': f'Akun berhasil dibuat. Selamat datang di Platform Manajemen Investasi KKP, {user_data["full_name"]}!',
        'user': user_data
    }, status=201)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def auth_config(request):
    from oauth2_provider.models import get_application_model

    aplikasi = get_application_model().objects.filter(
        name='KKP Investment Dashboard (SPA)'
    ).first()

    if aplikasi is None:
        return Response(
            {
                'detail': 'OAuth2 Application belum terdaftar. '
                          'Jalankan: python manage.py setup_oauth_app',
            },
            status=503,
        )

    return Response({
        'client_id': aplikasi.client_id,
        'token_endpoint': '/o/token/',
        'grant_type': 'password',
        'scope': 'read write',
    })


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.AllowAny])
def me_api(request):
    if not request.user or not request.user.is_authenticated:
        if request.method == 'PATCH':
            return Response({'detail': 'Silakan masuk terlebih dahulu.'}, status=401)
        return Response({'authenticated': False, 'user': None}, status=200)

    if request.method == 'GET':
        return Response({'authenticated': True, 'user': _serialize_user(request.user)})

    data = request.data if isinstance(request.data, dict) else {}
    terlarang = sorted(set(data) & MEDAN_PROFIL_TERLARANG)
    if terlarang:
        return Response(
            {'detail': 'Medan berikut hanya dapat diubah administrator: '
                       + ', '.join(terlarang) + '.'},
            status=403,
        )
    tidak_dikenal = sorted(set(data) - MEDAN_PROFIL_BOLEH)
    if tidak_dikenal:
        return Response(
            {'detail': 'Medan tidak dikenal: ' + ', '.join(tidak_dikenal) + '.'},
            status=400,
        )

    from .models import ProfilPengguna

    user = request.user
    profil, _ = ProfilPengguna.objects.get_or_create(user=user)
    galat = {}

    if 'first_name' in data:
        nama = str(data.get('first_name') or '').strip()
        if not nama:
            galat['first_name'] = 'Nama depan wajib diisi.'
        elif len(nama) > 150:
            galat['first_name'] = 'Nama depan paling banyak 150 karakter.'
        else:
            user.first_name = nama
    if 'last_name' in data:
        nama = str(data.get('last_name') or '').strip()
        if len(nama) > 150:
            galat['last_name'] = 'Nama belakang paling banyak 150 karakter.'
        else:
            user.last_name = nama
    if 'telepon' in data:
        telepon = str(data.get('telepon') or '').strip()
        if telepon and not POLA_TELEPON.fullmatch(telepon):
            galat['telepon'] = ('Nomor telepon hanya boleh angka, spasi, tanda +, -, '
                                'dan tanda kurung, 8 sampai 20 karakter.')
        else:
            profil.telepon = telepon
    if 'instansi' in data:
        instansi = str(data.get('instansi') or '').strip()
        if len(instansi) > 255:
            galat['instansi'] = 'Nama instansi paling banyak 255 karakter.'
        else:
            profil.instansi = instansi
    if 'provinsi_id' in data:
        nilai = data.get('provinsi_id')
        if nilai in (None, ''):
            profil.provinsi = None
        else:
            provinsi = Provinsi.objects.filter(pk=nilai).only('id', 'nama').first()
            if provinsi is None:
                galat['provinsi_id'] = 'Provinsi tidak dikenal.'
            else:
                profil.provinsi = provinsi

    if galat:
        return Response({'detail': 'Periksa kembali isian Anda.', 'galat': galat}, status=400)

    user.save(update_fields=['first_name', 'last_name'])
    profil.save()
    return Response({'authenticated': True, 'user': _serialize_user(user)})


MEDAN_PROFIL_BOLEH = frozenset({'first_name', 'last_name', 'telepon', 'instansi', 'provinsi_id'})
MEDAN_PROFIL_TERLARANG = frozenset({
    'role', 'is_staff', 'is_superuser', 'is_active', 'username', 'email',
    'password', 'groups', 'user_permissions',
})

POLA_TELEPON = re.compile(r'[0-9+\-\s()]{8,20}')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def ganti_sandi_api(request):
    from django.contrib.auth import update_session_auth_hash
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError

    data = request.data if isinstance(request.data, dict) else {}
    lama = data.get('sandi_lama') or ''
    baru = data.get('sandi_baru') or ''
    ulang = data.get('sandi_ulang') or ''
    user = request.user

    if not lama or not baru or not ulang:
        return Response({'detail': 'Ketiga isian kata sandi wajib diisi.'}, status=400)
    if not user.check_password(lama):
        return Response(
            {'detail': 'Kata sandi lama tidak sesuai.', 'galat': {'sandi_lama': 'Tidak sesuai.'}},
            status=400,
        )
    if baru != ulang:
        return Response(
            {'detail': 'Konfirmasi kata sandi tidak sama.',
             'galat': {'sandi_ulang': 'Tidak sama dengan kata sandi baru.'}},
            status=400,
        )
    if baru == lama:
        return Response(
            {'detail': 'Kata sandi baru harus berbeda dari yang lama.',
             'galat': {'sandi_baru': 'Sama dengan kata sandi lama.'}},
            status=400,
        )
    try:
        validate_password(baru, user=user)
    except DjangoValidationError as e:
        return Response(
            {'detail': ' '.join(e.messages), 'galat': {'sandi_baru': ' '.join(e.messages)}},
            status=400,
        )

    user.set_password(baru)
    user.save(update_fields=['password'])
    update_session_auth_hash(request, user)

    diakhiri = 0
    try:
        from oauth2_provider.models import get_access_token_model, get_refresh_token_model

        sekarang = getattr(request, 'auth', None)
        id_sekarang = getattr(sekarang, 'pk', None)
        for refresh in get_refresh_token_model().objects.filter(user=user, revoked__isnull=True):
            if id_sekarang and refresh.access_token_id == id_sekarang:
                continue
            refresh.revoke()
            diakhiri += 1
        sisa = get_access_token_model().objects.filter(user=user)
        if id_sekarang:
            sisa = sisa.exclude(pk=id_sekarang)
        diakhiri += sisa.count()
        sisa.delete()
    except Exception as e:
        logger.warning('[Auth] Gagal mengakhiri sesi lain sesudah ganti sandi: %s', e)

    return Response({
        'detail': 'Kata sandi berhasil diganti.',
        'sesi_lain_diakhiri': diakhiri,
    })


AKSI_RIWAYAT = ('MASUK', 'KELUAR', 'DAFTAR', 'UBAH', 'HAPUS', 'ANALISIS', 'DITOLAK')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def aktivitas_saya_api(request):
    from django.db.models import Q

    from .models import LogAktivitas

    baris = (
        LogAktivitas.objects.filter(pengguna=request.user)
        .filter(Q(aksi__in=AKSI_RIWAYAT) | (Q(aksi='BUAT') & ~Q(objek='')))
        .exclude(aksi='DITOLAK', metode='GET')
        .only('waktu', 'aksi', 'objek', 'ringkasan', 'alamat_ip', 'kode_status', 'metode')[:20]
    )
    return Response({'hasil': [
        {
            'waktu': b.waktu.isoformat(),
            'aksi': b.aksi,
            'aksi_label': b.get_aksi_display(),
            'objek': b.objek,
            'ringkasan': b.ringkasan,
            'alamat_ip': b.alamat_ip,
            'kode_status': b.kode_status,
        }
        for b in baris
    ]})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_api(request):
    from django.contrib.auth import logout

    dicabut = False
    token = getattr(request, 'auth', None)

    if token is not None and hasattr(token, 'revoke'):
        try:
            from oauth2_provider.models import get_refresh_token_model

            refresh = get_refresh_token_model().objects.filter(access_token=token).first()
            if refresh is not None:
                refresh.revoke()
            token.revoke()
            dicabut = True
        except Exception as e:
            logger.warning('[Auth] Gagal mencabut token saat logout: %s', e)

    logout(request)
    return Response({
        'success': True,
        'token_dicabut': dicabut,
        'message': 'Anda telah berhasil keluar (log out).',
    })
