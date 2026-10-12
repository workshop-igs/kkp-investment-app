import json

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from rest_framework.test import APIRequestFactory, force_authenticate

from analitik.views import RunAnalysisView
from pipeline.models import ProyekInvestasi


def _geometri(proyek, aj):
    if aj.get('geometry'):
        return aj['geometry']
    return json.loads(proyek.geometry.geojson) if proyek.geometry else None


def _muatan(proyek, aj):
    fin = aj.get('finansial') or {}
    wajib = {
        'capex_idr': fin.get('capex_idr'),
        'annual_revenue_idr': fin.get('annual_revenue_idr'),
        'annual_opex_idr': fin.get('annual_opex_idr'),
        'wacc_pct': fin.get('wacc_pct'),
        'lifetime_yr': fin.get('project_lifetime_yr'),
    }
    geom = _geometri(proyek, aj)
    if not geom:
        return None, 'tanpa geometri'
    kurang = [k for k, v in wajib.items() if v in (None, '')]
    if kurang:
        return None, 'masukan finansial kurang: ' + ','.join(kurang)

    data = {
        'geometry': geom,
        'sektor': aj.get('sektor') or proyek.sektor or 'DEFAULT',
        'revenue_growth_pct': fin.get('revenue_growth_pct', 0.0),
        'opex_growth_pct': fin.get('opex_growth_pct', 0.0),
        **wajib,
    }

    tk = aj.get('ketenagakerjaan') or {}
    if tk.get('asal_angka') == 'dimasukkan pengguna' and tk.get('total_tenaga_kerja'):
        data['tenaga_kerja_estimasi'] = tk['total_tenaga_kerja']

    return data, None


def _ringkas(aj):
    kel = aj.get('kelayakan') or {}
    fin = aj.get('finansial') or {}
    sen = fin.get('sensitivitas') or {}
    return {
        'keputusan': kel.get('keputusan') or aj.get('overall_feasibility') or '-',
        'skor': kel.get('skor_ahp_total') if kel else aj.get('ahp_score'),
        'langkah': [r.get('perubahan_pct') for r in (sen.get('pendapatan') or [])],
    }


class Command(BaseCommand):
    help = 'Jalankan ulang analisis kelayakan proyek investasi dengan mesin yang berlaku sekarang.'

    def add_arguments(self, parser):
        parser.add_argument('--terapkan', action='store_true', help='Tulis hasilnya ke basis data.')
        parser.add_argument('--proyek', type=int, help='Hanya satu proyek, menurut id.')

    def handle(self, *args, **options):
        terapkan = options['terapkan']
        pengguna = get_user_model().objects.filter(is_superuser=True).first()
        if pengguna is None:
            raise CommandError('Tidak ada superuser untuk menjalankan analisis.')

        factory = APIRequestFactory()
        view = RunAnalysisView.as_view()
        antrean = ProyekInvestasi.objects.order_by('id')
        if options.get('proyek'):
            antrean = antrean.filter(pk=options['proyek'])

        berhasil = gagal = berubah = 0
        self.stdout.write(f'{"ID":>4}  {"PROYEK":<30} {"KEPUTUSAN":<26} {"SKOR":<16} SENSITIVITAS')
        self.stdout.write('-' * 112)

        for proyek in antrean:
            aj = proyek.analisis_json or {}
            sebelum = _ringkas(aj)
            data, alasan = _muatan(proyek, aj)
            if data is None:
                gagal += 1
                self.stdout.write(f'{proyek.id:>4}  {proyek.nama[:30]:<30} DILEWATI - {alasan}')
                continue

            permintaan = factory.post('/api/v1/analitik/run-analysis/', data, format='json')
            force_authenticate(permintaan, user=pengguna)
            jawab = view(permintaan)
            if jawab.status_code != 200:
                gagal += 1
                rinci = jawab.data.get('detail') if hasattr(jawab, 'data') else jawab.status_code
                self.stdout.write(
                    self.style.ERROR(
                        f'{proyek.id:>4}  {proyek.nama[:30]:<30} GAGAL {jawab.status_code} - {rinci}'
                    )
                )
                continue

            hasil = {**jawab.data, 'geometry': data['geometry']}
            sesudah = _ringkas(hasil)

            if terapkan:
                proyek.analisis_json = hasil
                proyek.skor_kelayakan = (hasil.get('kelayakan') or {}).get('skor_ahp_total') or 0
                proyek.proyeksi_tenaga_kerja = (
                    (hasil.get('ketenagakerjaan') or {}).get('total_tenaga_kerja') or 0
                )
                if hasil.get('area_ha'):
                    proyek.luas_ha = hasil['area_ha']
                proyek.save(
                    update_fields=[
                        'analisis_json', 'skor_kelayakan', 'proyeksi_tenaga_kerja', 'luas_ha'
                    ]
                )

            berhasil += 1
            pindah = sebelum['keputusan'] != sesudah['keputusan']
            berubah += 1 if pindah else 0
            kep = f'{sebelum["keputusan"]} -> {sesudah["keputusan"]}'
            skor = f'{sebelum["skor"] or 0:.3f} -> {sesudah["skor"] or 0:.3f}'
            langkah = f'{sebelum["langkah"] or "-"} -> {sesudah["langkah"]}'
            baris = f'{proyek.id:>4}  {proyek.nama[:30]:<30} {kep:<26} {skor:<16} {langkah}'
            self.stdout.write(self.style.WARNING(f'{baris} *') if pindah else baris)

        self.stdout.write('-' * 112)
        self.stdout.write(
            f'berhasil {berhasil} | dilewati/gagal {gagal} | keputusan berubah {berubah} (*) | '
            + ('DITULIS ke basis data' if terapkan else 'PRATINJAU, tidak ada yang ditulis')
        )
