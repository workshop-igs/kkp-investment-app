from django.core.management.base import BaseCommand

from inti.models import Provinsi
from penarikan_data.bps import DOMAIN_NASIONAL, BPSTidakTersedia, data_komoditas, tahun_tersedia
from penarikan_data.models import ProduksiPerikananBPS

VARIABEL = [('BUDIDAYA', 1513, 1514), ('TANGKAP_LAUT', 1515, 1516)]
JUMLAH_TAHUN = 8


class Command(BaseCommand):
    help = 'Tarik produksi dan nilai produksi perikanan per provinsi dan komoditas utama dari BPS (sumber data KKP).'

    def handle(self, *args, **options):
        provinsi = {p.kode_bps.zfill(2): p for p in Provinsi.objects.all()}
        for kelompok, var_ton, var_nilai in VARIABEL:
            daftar_tahun = tahun_tersedia(DOMAIN_NASIONAL, var_ton, batas=JUMLAH_TAHUN)
            if not daftar_tahun:
                self.stderr.write(f'{kelompok}: daftar tahun BPS tidak terbaca; data lama dipertahankan.')
            for th in daftar_tahun:
                try:
                    ton = data_komoditas(var_ton, th['th_id'])
                    nilai = data_komoditas(var_nilai, th['th_id'])
                except BPSTidakTersedia as e:
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
