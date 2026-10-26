from django.core.management.base import BaseCommand, CommandError

from inti.models import Provinsi
from penarikan_data.bps import DOMAIN_NASIONAL, BPSTidakTersedia, data_komoditas, kode_bps, tahun_tersedia
from penarikan_data.models import ProduksiPerikananBPS

VARIABEL = [('BUDIDAYA', 1513, 1514), ('TANGKAP_LAUT', 1515, 1516)]
JUMLAH_TAHUN = 8


class Command(BaseCommand):
    help = 'Tarik produksi dan nilai produksi perikanan per provinsi dan komoditas utama dari BPS (sumber data KKP).'

    def handle(self, *args, **options):
        provinsi = {kode_bps(p.kode_bps): p for p in Provinsi.objects.all()}
        gagal = []
        for kelompok, var_ton, var_nilai in VARIABEL:
            daftar_tahun = tahun_tersedia(DOMAIN_NASIONAL, var_ton, batas=JUMLAH_TAHUN)
            if not daftar_tahun:
                gagal.append(kelompok)
                self.stderr.write(f'{kelompok}: daftar tahun BPS tidak terbaca; data lama dipertahankan.')
            for th in daftar_tahun:
                try:
                    ton = data_komoditas(var_ton, th['th_id'])
                    nilai = data_komoditas(var_nilai, th['th_id'])
                except BPSTidakTersedia as e:
                    gagal.append(f'{kelompok} {th["th"]}')
                    self.stderr.write(f'{kelompok} {th["th"]}: {e}; data lama dipertahankan.')
                    continue
                jumlah = 0
                for (wilayah, komoditas), produksi in ton.items():
                    p = provinsi.get(wilayah[:2])
                    if not p:
                        continue
                    ProduksiPerikananBPS.objects.update_or_create(
                        provinsi=p, kelompok=kelompok, komoditas=komoditas, tahun=int(th['th']),
                        defaults={'produksi_ton': produksi, 'nilai_ribu_rp': nilai.get((wilayah, komoditas))},
                    )
                    jumlah += 1
                self.stdout.write(f'{kelompok} {th["th"]}: {jumlah} baris provinsi × komoditas.')
        if gagal:
            raise CommandError(f'Sebagian data BPS belum tertarik: {", ".join(gagal)}.')
