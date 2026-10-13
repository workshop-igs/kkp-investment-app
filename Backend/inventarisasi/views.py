from rest_framework import viewsets

from inti.peta_bbox import PetaBBoxMixin

from .models import (
    KKPRL,
    InfrastrukturPendukung,
    PotensiInvestasi,
    ProgramKKP,
    SumberDayaAlam,
    UnsurRuangLaut,
    ZonasiRuangLaut,
)
from .serializers import (
    InfrastrukturPendukungSerializer,
    KKPRLSerializer,
    PotensiInvestasiSerializer,
    ProgramKKPSerializer,
    SumberDayaAlamSerializer,
    UnsurRuangLautSerializer,
    ZonasiRuangLautSerializer,
)


class PotensiInvestasiViewSet(PetaBBoxMixin, viewsets.ModelViewSet):
    queryset = PotensiInvestasi.objects.select_related('provinsi', 'sektor').all()
    serializer_class = PotensiInvestasiSerializer
    filterset_fields = ['provinsi', 'sektor', 'tingkat_potensi']
    search_fields = ['nama']
    ordering_fields = ['skor_kelayakan', 'nilai_potensi_miliar']

    BATAS_FITUR = 500

    PETA_KOLOM = (
        'nama', 'deskripsi', 'tingkat_potensi', 'sektor__nama', 'sektor__kode',
        'provinsi__nama', 'luas_ha', 'nilai_potensi_miliar', 'potensi_sumber_daya',
        'jarak_pelabuhan_km', 'akses_jalan', 'akses_listrik', 'akses_air_bersih',
        'sumber_data',
    )

    def peta_queryset_tambahan(self, qs, request):
        kode = (request.query_params.get('sektor') or '').strip().upper()
        return qs.filter(sektor__kode=kode) if kode else qs

    def properti_peta(self, r):
        return {
            'nama': r['nama'],
            'deskripsi': r['deskripsi'],
            'tingkat': r['tingkat_potensi'],
            'tingkat_label': self.label_peta('tingkat_potensi', r['tingkat_potensi']),
            'sektor': r['sektor__nama'],
            'sektor_kode': r['sektor__kode'],
            'provinsi': r['provinsi__nama'],
            'luas_ha': r['luas_ha'],
            'nilai_miliar': r['nilai_potensi_miliar'],
            'sumber_daya': r['potensi_sumber_daya'],
            'jarak_pelabuhan_km': r['jarak_pelabuhan_km'],
            'akses_jalan': r['akses_jalan'],
            'akses_listrik': r['akses_listrik'],
            'akses_air_bersih': r['akses_air_bersih'],
            'sumber': r['sumber_data'],
        }

class ZonasiRuangLautViewSet(PetaBBoxMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ZonasiRuangLaut.objects.select_related('provinsi').all()
    serializer_class = ZonasiRuangLautSerializer
    filterset_fields = ['provinsi', 'jenis_zona', 'sub_zona']

    PETA_KOLOM = (
        'nama_zona', 'jenis_zona', 'sub_zona', 'nomor_regulasi',
        'provinsi__nama', 'sumber_data',
    )

    def properti_peta(self, r):
        return {
            'nama': r['nama_zona'],
            'jenis': self.label_peta('jenis_zona', r['jenis_zona']),
            'sub_zona': self.label_peta('sub_zona', r['sub_zona']),
            'jenis_kode': r['jenis_zona'],
            'kategori': r['sub_zona'],
            'regulasi': r['nomor_regulasi'],
            'provinsi': r['provinsi__nama'],
            'sumber': r['sumber_data'],
        }

    def peta_queryset_tambahan(self, qs, request):
        tingkat = request.query_params.get('tingkat')
        if tingkat:
            qs = qs.filter(tingkat_acuan=tingkat)
        ranah = request.query_params.get('ranah') or 'LAUT'
        if ranah != 'SEMUA':
            qs = qs.filter(ranah=ranah)
        kategori = request.query_params.get('kategori')
        return qs.filter(sub_zona=kategori) if kategori else qs


class KKPRLViewSet(PetaBBoxMixin, viewsets.ReadOnlyModelViewSet):
    SERTAKAN_TITIK = True

    SKALA = [
        (30.0, 0.0, 2500),
        (20.0, 0.0, 2500),
        (10.0, 0.0, 2500),
        (5.0, 0.0, 2500),
        (2.0, 0.0, 2500),
        (0.5, 0.0, 2500),
    ]
    BATAS_FITUR = 2500
    BATAS_JAUH = None

    queryset = KKPRL.objects.select_related('provinsi', 'sektor').all()
    serializer_class = KKPRLSerializer
    filterset_fields = ['provinsi', 'sektor', 'status']
    search_fields = ['nomor_izin', 'nama_pemohon']

    def peta_queryset_tambahan(self, qs, request):
        jenis = request.query_params.get('jenis')
        if jenis:
            qs = qs.filter(jenis_dokumen=jenis)
        sektor = request.query_params.get('sektor')
        if sektor == 'LAINNYA':
            return qs.filter(sektor__isnull=True)
        return qs.filter(sektor__kode=sektor) if sektor else qs

    PETA_KOLOM = (
        'nomor_izin', 'jenis_dokumen', 'nama_pemohon', 'jenis_kegiatan',
        'status', 'provinsi__nama', 'keterangan', 'sumber_data', 'sektor__kode', 'sektor__nama',
    )

    def properti_peta(self, r):
        return {
            'nomor_izin': r['nomor_izin'],
            'jenis_dokumen': r['jenis_dokumen'],
            'pemohon': r['nama_pemohon'],
            'kegiatan': r['jenis_kegiatan'],
            'status': r['status'],
            'provinsi': r['provinsi__nama'],
            'keterangan': r['keterangan'],
            'sumber': r['sumber_data'],
            'sektor': r['sektor__kode'] or 'LAINNYA',
            'sektor_nama': r['sektor__nama'] or 'Kegiatan lain',
        }


class UnsurRuangLautViewSet(PetaBBoxMixin, viewsets.ReadOnlyModelViewSet):
    SKALA_RINGAN = [
        (30.0, 0.02, 2000),
        (20.0, 0.01, 2000),
        (10.0, 0.005, 2000),
        (5.0, 0.002, 2000),
        (2.0, 0.0005, 2000),
        (0.5, 0.0002, 2000),
    ]

    BATAS_FITUR = 2000

    def _skala(self, lebar):
        for ambang, toleransi, batas in self.SKALA_RINGAN:
            if lebar >= ambang:
                return toleransi, batas
        return 0.0, self.BATAS_FITUR

    queryset = UnsurRuangLaut.objects.select_related('provinsi').all()
    serializer_class = UnsurRuangLautSerializer
    filterset_fields = ['kelompok', 'provinsi', 'kode_lapisan']
    search_fields = ['nama', 'jenis']

    def peta_queryset_tambahan(self, qs, request):
        kelompok = request.query_params.get('kelompok')
        return qs.filter(kelompok=kelompok) if kelompok else qs

    PETA_KOLOM = (
        'nama', 'jenis', 'kelompok', 'kode_lapisan', 'keterangan',
        'nomor_regulasi', 'provinsi__nama', 'luas_ha', 'sumber_data',
    )

    def properti_peta(self, r):
        from inventarisasi.klasifikasi import jenis_unsur, sub_zona

        return {
            'nama': r['nama'],
            'jenis': r['jenis'],
            'jenis_kode': jenis_unsur(r['jenis'], r['nama']),
            'kategori': sub_zona(f"{r['nama']} {r['jenis']}", ''),
            'kelompok': r['kelompok'],
            'kelompok_label': self.label_peta('kelompok', r['kelompok']),
            'lapisan': r['kode_lapisan'],
            'keterangan': r['keterangan'],
            'regulasi': r['nomor_regulasi'],
            'provinsi': r['provinsi__nama'],
            'luas_ha': r['luas_ha'] or None,
            'sumber': r['sumber_data'],
        }


class InfrastrukturPendukungViewSet(PetaBBoxMixin, viewsets.ReadOnlyModelViewSet):
    SERTAKAN_TITIK = True

    SKALA = [
        (30.0, 0.02, 3000),
        (20.0, 0.01, 3000),
        (10.0, 0.005, 3000),
        (5.0, 0.002, 3000),
        (2.0, 0.0005, 3000),
        (0.5, 0.0002, 3000),
    ]
    BATAS_FITUR = 3000

    queryset = InfrastrukturPendukung.objects.select_related('provinsi').all()
    serializer_class = InfrastrukturPendukungSerializer
    filterset_fields = ['kategori', 'provinsi', 'kode_lapisan']
    search_fields = ['nama', 'kelas', 'pengelola']

    def peta_queryset_tambahan(self, qs, request):
        kategori = request.query_params.get('kategori')
        return qs.filter(kategori=kategori) if kategori else qs

    PETA_KOLOM = (
        'nama', 'kategori', 'kelas', 'pengelola', 'status', 'keterangan',
        'provinsi__nama', 'sumber_data',
    )

    def properti_peta(self, r):
        return {
            'nama': r['nama'],
            'kategori': r['kategori'],
            'kategori_label': self.label_peta('kategori', r['kategori']),
            'kelas': r['kelas'],
            'pengelola': r['pengelola'],
            'status': r['status'],
            'keterangan': r['keterangan'],
            'provinsi': r['provinsi__nama'],
            'sumber': r['sumber_data'],
        }


class ProgramKKPViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProgramKKP.objects.all()
    serializer_class = ProgramKKPSerializer
    filterset_fields = ['status', 'sektor']


class SumberDayaAlamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SumberDayaAlam.objects.select_related('provinsi').all()
    serializer_class = SumberDayaAlamSerializer
    filterset_fields = ['provinsi', 'jenis']
