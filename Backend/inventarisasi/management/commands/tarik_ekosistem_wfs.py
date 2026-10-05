import time

import httpx
from django.core.management.base import BaseCommand
from django.db import transaction

from inti.models import Provinsi
from inventarisasi.models import SumberDayaAlam

from ._geometri import jadikan_multipolygon

WFS = 'https://portaldata.kkp.go.id/gis/wms'
TANDA = 'KKP-EKOSISTEM'

LAPISAN = [
    ('demo:MANGROVE', 'MANGROVE', 'Kondisi_Tutupan_Terumbu_Karang', 'Luas_Ha', 'Tahun'),
]

KONDISI = {
    'mangrove lebat': 'Baik',
    'mangrove sedang': 'Sedang',
    'mangrove jarang': 'Rusak',
}


def _beririsan(wilayah, geom):
    try:
        return wilayah.intersects(geom)
    except Exception:
        try:
            return wilayah.intersects(geom.buffer(0))
        except Exception:
            return False


def _ambil(lapisan, bbox, percobaan=3):
    galat = None
    for ke in range(percobaan):
        try:
            r = httpx.get(
                WFS,
                params={
                    'service': 'WFS',
                    'version': '1.1.0',
                    'request': 'GetFeature',
                    'typeName': lapisan,
                    'outputFormat': 'application/json',
                    'srsName': 'EPSG:4326',
                    'maxFeatures': 30000,
                    'BBOX': '%f,%f,%f,%f,EPSG:4326' % bbox,
                },
                timeout=180.0,
            )
            r.raise_for_status()
            return r.json().get('features', []), None
        except Exception as exc:
            galat = exc
            if ke < percobaan - 1:
                time.sleep(2**ke)
    return None, galat


class Command(BaseCommand):
    help = 'Tarik sebaran & kondisi mangrove dari WFS KKP. Terumbu karang & lamun: tarik_ekosistem_sidako.'

    def add_arguments(self, parser):
        parser.add_argument('--provinsi', help='Kode BPS provinsi, mis. 35.')
        parser.add_argument('--lanjutkan', action='store_true', help='Lewati provinsi yang sudah terisi.')
        parser.add_argument('--hapus', action='store_true', help='Hapus hasil tarikan ini saja.')

    def handle(self, *args, **opsi):
        if opsi['hapus']:
            n = SumberDayaAlam.objects.filter(sumber_data=TANDA).delete()[0]
            self.stdout.write(self.style.SUCCESS(f'{n} baris bertanda {TANDA} dihapus.'))
            return

        provinsi = Provinsi.objects.exclude(geometry=None).order_by('kode_bps')
        if opsi['provinsi']:
            provinsi = provinsi.filter(kode_bps=str(opsi['provinsi']).zfill(2))
        daftar = list(provinsi)
        if not daftar:
            self.stderr.write('Tidak ada provinsi bergeometri yang cocok.')
            return

        mulai = time.time()
        total = dilewati = 0
        gagal = []

        for i, prov in enumerate(daftar, 1):
            if opsi['lanjutkan'] and SumberDayaAlam.objects.filter(
                sumber_data=TANDA, provinsi_id=prov.id
            ).exists():
                dilewati += 1
                continue

            bbox = prov.geometry.extent
            wilayah = prov.geometry if prov.geometry.valid else prov.geometry.buffer(0)
            baris = []
            catatan = []

            for lapisan, jenis, kol_kondisi, kol_luas, kol_tahun in LAPISAN:
                fitur, galat = _ambil(lapisan, bbox)
                if fitur is None:
                    catatan.append(f'{lapisan.split(":")[-1]}: {type(galat).__name__}')
                    continue

                for f in fitur:
                    geom_json = f.get('geometry')
                    if not geom_json:
                        continue
                    try:
                        geom = jadikan_multipolygon(geom_json)
                    except Exception:
                        continue
                    if geom is None or geom.empty:
                        continue

                    if not _beririsan(wilayah, geom):
                        continue

                    p = f.get('properties') or {}
                    mentah = (p.get(kol_kondisi) or '').strip() if kol_kondisi else ''
                    baris.append(
                        SumberDayaAlam(
                            provinsi_id=prov.id,
                            jenis=jenis,
                            nama=(p.get('Wilayah') or p.get('Kabupaten_Kota') or jenis.title()),
                            geometry=geom,
                            luas_ha=float(p.get(kol_luas) or 0),
                            kondisi=KONDISI.get(mentah.lower(), ''),
                            tahun_data=self._tahun(p.get(kol_tahun)),
                            sumber_data=TANDA,
                            detail_json={
                                'lapisan': lapisan,
                                'kondisi_asal': mentah,
                                'provinsi_atribut': p.get('Provinsi'),
                            },
                        )
                    )

            if baris:
                with transaction.atomic():
                    SumberDayaAlam.objects.filter(sumber_data=TANDA, provinsi_id=prov.id).delete()
                    SumberDayaAlam.objects.bulk_create(baris, batch_size=2000)
                total += len(baris)

            berkondisi = sum(1 for b in baris if b.kondisi)
            if baris or catatan:
                pesan = f'  [{i}/{len(daftar)}] {prov.nama:28s} {len(baris):6d} objek'
                if berkondisi:
                    pesan += f' ({berkondisi} berkondisi)'
                self.stdout.write(pesan)
            if catatan:
                gagal.append(f'{prov.nama}: {"; ".join(catatan)}')

        lewat = time.time() - mulai
        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'Selesai dalam {lewat:.0f} dtk — {total} objek ekosistem tersimpan'
                + (f', {dilewati} provinsi dilewati' if dilewati else '')
            )
        )
        if gagal:
            self.stdout.write(
                self.style.WARNING(
                    f'{len(gagal)} provinsi punya lapisan yang gagal ditarik '
                    f'(lapisan lain tetap masuk): {gagal[0]}'
                    + (f' … +{len(gagal) - 1} lainnya' if len(gagal) > 1 else '')
                )
            )

    @staticmethod
    def _tahun(nilai):
        try:
            return int(str(nilai)[:4])
        except (TypeError, ValueError):
            return None
