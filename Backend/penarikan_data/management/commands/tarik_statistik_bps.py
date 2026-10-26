import json
import time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from inti.models import KabupatenKota, Provinsi
from penarikan_data.bps import (
    DOMAIN_NASIONAL,
    JUMLAH_TAHUN_DITARIK,
    VARIABEL_NASIONAL,
    BPSTidakTersedia,
    DomainTidakDikenal,
    cocokkan_kabupaten,
    daftar_variabel,
    data_masih_layak,
    data_per_wilayah,
    kode_bps,
    peringkat_variabel,
    tahun_angka,
    tahun_tersedia,
)
from penarikan_data.models import StatistikKetenagakerjaanBPS

BATAS_KANDIDAT = 3


class Command(BaseCommand):
    help = 'Tarik statistik ketenagakerjaan BPS ke basis data; dijadwalkan ulang oleh perbarui_sumber_data.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--paksa',
            action='store_true',
            help='Tarik ulang datanya meskipun tahun BPS belum berubah.',
        )

    def handle(self, *args, **opsi):
        mulai = time.time()
        rekap = {'baru': 0, 'diperbarui': 0, 'tetap': 0}
        galat = ''
        for domain, provinsi in [(DOMAIN_NASIONAL, None)] + [(f'{kode_bps(p.kode_bps)}00', p) for p in Provinsi.objects.order_by('kode_bps')]:
            self.stdout.write(self.style.MIGRATE_HEADING(
                f'Domain {domain} — ' + (f'TPT per kabupaten/kota {provinsi.nama}' if provinsi
                                         else 'TPT & jumlah penganggur per provinsi')
            ))
            try:
                for k, v in self._tarik(domain, opsi['paksa'], provinsi).items():
                    rekap[k] += v
            except BPSTidakTersedia as e:
                if provinsi and isinstance(e, DomainTidakDikenal):
                    self.stdout.write('  domain belum ada di WebAPI BPS, dilewati; laporan memakai angka provinsi.')
                    continue
                galat = galat or f'{domain}: {e}'
                self.stderr.write(f'  gagal: {str(e)[:140]}')

        if galat:
            raise CommandError(f'Sebagian statistik BPS belum tertarik ({galat[:300]}); data lama dipertahankan.')
        self.stdout.write(self.style.SUCCESS(
            f"Selesai dalam {time.time() - mulai:.0f}s — {rekap['baru']} baris baru, "
            f"{rekap['diperbarui']} diperbarui, {rekap['tetap']} tidak berubah."
        ))
        return json.dumps(rekap)

    def _tarik(self, domain, paksa: bool, provinsi=None):
        variabel = {'tpt': VARIABEL_NASIONAL['tpt']} if provinsi else VARIABEL_NASIONAL
        daftar_kab = list(KabupatenKota.objects.filter(provinsi=provinsi).values_list('kode_bps', 'nama', 'jenis')) if provinsi else []
        tersimpan = {}
        tersimpan_th = {}
        for b in StatistikKetenagakerjaanBPS.objects.filter(domain=domain):
            tersimpan_th[(b.indikator, str(b.tahun))] = b
            ada = tersimpan.get(b.indikator)
            if ada is None or (tahun_angka(b.tahun) or 0) > (tahun_angka(ada.tahun) or 0):
                tersimpan[b.indikator] = b

        perlu_katalog = paksa or any(nama not in tersimpan for nama in variabel)
        katalog = daftar_variabel(domain) if perlu_katalog else []

        rekap = {'baru': 0, 'diperbarui': 0, 'tetap': 0}
        sekarang = timezone.now()

        for nama, spec in variabel.items():
            for var_id, tahun in self._kandidat(domain, katalog, spec, tersimpan.get(nama), paksa):
                ditulis = 0
                for th in tahun:
                    lama = tersimpan_th.get((nama, str(th['th'])))

                    if lama and not paksa and var_id == lama.var_id:
                        lama.diperiksa_pada = sekarang
                        lama.save(update_fields=['diperiksa_pada'])
                        rekap['tetap'] += 1
                        ditulis += 1
                        continue

                    nilai = data_per_wilayah(domain, var_id, th['th_id'], spec.get('turvar'))
                    if provinsi:
                        nilai = cocokkan_kabupaten(nilai, provinsi.nama, daftar_kab)
                    if not nilai:
                        continue

                    _, dibuat = StatistikKetenagakerjaanBPS.objects.update_or_create(
                        domain=domain,
                        indikator=nama,
                        tahun=str(th['th']),
                        defaults={
                            'var_id': var_id,
                            'th_id': th['th_id'],
                            'per_wilayah': nilai,
                            'diperiksa_pada': sekarang,
                        },
                    )
                    rekap['baru' if dibuat else 'diperbarui'] += 1
                    ditulis += 1

                if ditulis:
                    break

        return rekap

    def _kandidat(self, domain, katalog, spec, baris, paksa):
        if baris and not paksa and data_masih_layak(baris.tahun):
            nomor = [baris.var_id]
        else:
            nomor = peringkat_variabel(katalog, spec) if katalog else []
            if baris and baris.var_id not in nomor:
                nomor.append(baris.var_id)
            nomor = nomor[:BATAS_KANDIDAT]

        hasil = []
        for peringkat, var_id in enumerate(nomor):
            tahun = tahun_tersedia(domain, var_id, JUMLAH_TAHUN_DITARIK)
            if not tahun:
                continue
            layak = 0 if data_masih_layak(tahun[0]['th']) else 1
            hasil.append((layak, peringkat, var_id, tahun))

        hasil.sort()
        return [(var_id, tahun) for *_, var_id, tahun in hasil]
