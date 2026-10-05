from django.core.management.base import BaseCommand
from django.db import transaction

from inti.geospasial import BATAS_KEWENANGAN_PROVINSI_M, provinsi_dari_geometri
from pipeline.models import ProyekInvestasi


class Command(BaseCommand):
    help = 'Bandingkan kolom provinsi tiap proyek dengan geometrinya (bawaan: laporan saja).'

    def add_arguments(self, parser):
        parser.add_argument(
            'kode',
            nargs='*',
            help='Kode proyek yang akan diperbaiki. Wajib bila --terapkan dipakai.',
        )
        parser.add_argument(
            '--terapkan',
            action='store_true',
            help='Tulis perubahan ke basis data untuk kode proyek yang disebutkan.',
        )

    def handle(self, *args, **opsi):
        terapkan = opsi['terapkan']
        kode_diminta = set(opsi['kode'])

        if terapkan and not kode_diminta:
            self.stderr.write(
                self.style.ERROR(
                    '--terapkan wajib disertai daftar kode proyek. Menimpa seluruh '
                    'tabel sekaligus akan merusak proyek yang provinsinya sudah benar '
                    'tetapi jauh dari daratan (mis. Kepulauan Seribu).'
                )
            )
            return

        proyek = ProyekInvestasi.objects.exclude(geometry=None).select_related('provinsi')
        if kode_diminta:
            proyek = proyek.filter(kode_proyek__in=kode_diminta)

        batas_km = BATAS_KEWENANGAN_PROVINSI_M / 1000.0
        lebar = '{:<11}{:<22}{:<22}{:<24}{:>9}'
        self.stdout.write(
            lebar.format('KODE', 'TERCATAT', 'MENURUT GEOMETRI', 'METODE', 'JARAK KM')
        )
        self.stdout.write('-' * 88)

        beda, sama, diubah = [], 0, 0
        for p in proyek.order_by('kode_proyek'):
            w = provinsi_dari_geometri(p.geometry)
            tercatat = p.provinsi.nama if p.provinsi_id else '(kosong)'
            menurut = w['provinsi'].nama if w['provinsi'] else '(perairan nasional)'
            jarak = '-' if w['jarak_km'] is None else f'{w["jarak_km"]:.2f}'

            cocok = (w['provinsi'].id if w['provinsi'] else None) == p.provinsi_id
            if cocok:
                sama += 1
            else:
                beda.append((p, w))

            self.stdout.write(
                lebar.format(
                    p.kode_proyek, tercatat[:21], menurut[:21], str(w['metode'])[:23], jarak
                )
                + ('' if cocok else self.style.WARNING('  <- beda'))
            )

            if terapkan and not cocok and p.kode_proyek in kode_diminta:
                with transaction.atomic():
                    p.provinsi = w['provinsi']
                    p._history_catatan = (
                        f'Provinsi diperbaiki dari "{tercatat}" menjadi "{menurut}" '
                        f'berdasarkan geometri area ({w["metode"]}).'
                    )
                    p.save()
                diubah += 1

        self.stdout.write('')
        self.stdout.write(f'Cocok        : {sama}')
        self.stdout.write(f'Berbeda      : {len(beda)}')
        if terapkan:
            self.stdout.write(self.style.SUCCESS(f'Diperbaiki   : {diubah}'))
        elif beda:
            self.stdout.write('')
            self.stdout.write(
                'Tidak ada yang diubah. Periksa dulu baris yang berbeda satu per satu — '
                f'proyek berjarak lebih dari {batas_km:.0f} km dari daratan dilaporkan '
                'sebagai perairan nasional, dan untuk gugusan pulau terluar isian yang '
                'sekarang bisa jadi justru yang benar.'
            )
            self.stdout.write('Bila sudah yakin:')
            self.stdout.write(
                '  python manage.py periksa_wilayah_proyek --terapkan '
                + ' '.join(p.kode_proyek for p, _ in beda[:5])
            )
