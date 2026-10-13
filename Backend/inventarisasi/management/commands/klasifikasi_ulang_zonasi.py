import collections

from django.core.management.base import BaseCommand
from django.db import transaction

from inventarisasi.klasifikasi import jenis_kawasan, sub_zona
from inventarisasi.models import ZonasiRuangLaut


class Command(BaseCommand):
    help = 'Labeli ulang jenis kawasan & sub zona dari keterangan yang tersimpan.'

    def add_arguments(self, parser):
        parser.add_argument('--uji-coba', action='store_true',
                            help='Tampilkan perubahan tanpa menyimpan.')
        parser.add_argument('--sumber', default=None,
                            help='Batasi pada satu sumber_data saja.')

    def handle(self, *args, **options):
        qs = ZonasiRuangLaut.objects.filter(ranah='LAUT')
        if options['sumber']:
            qs = qs.filter(sumber_data=options['sumber'])

        berubah = []
        rekap = collections.Counter()
        for o in qs.only('id', 'keterangan', 'nama_zona', 'jenis_zona', 'sub_zona'):
            acuan = ' '.join(x for x in (o.keterangan, o.nama_zona) if x)
            jenis_baru = jenis_kawasan(acuan) if o.jenis_zona == 'ZU' else o.jenis_zona
            sub_baru = sub_zona(acuan, jenis_baru)
            if jenis_baru != o.jenis_zona or sub_baru != o.sub_zona:
                rekap['%s -> %s' % (o.sub_zona, sub_baru)] += 1
                o.jenis_zona = jenis_baru
                o.sub_zona = sub_baru
                berubah.append(o)

        self.stdout.write('Diperiksa: %d | berubah: %d' % (qs.count(), len(berubah)))
        for pindah, n in rekap.most_common(15):
            self.stdout.write('   %-42s %d' % (pindah, n))

        if options['uji_coba']:
            self.stdout.write(self.style.WARNING('Uji coba — tidak ada yang disimpan.'))
            return

        with transaction.atomic():
            ZonasiRuangLaut.objects.bulk_update(berubah, ['jenis_zona', 'sub_zona'], batch_size=500)
        self.stdout.write(self.style.SUCCESS('Tersimpan.'))
