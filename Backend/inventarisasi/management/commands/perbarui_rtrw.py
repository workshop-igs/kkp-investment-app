import hashlib
import json
import os
import re
import shutil
import tempfile
from datetime import date, datetime

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from inventarisasi.management.commands.tarik_rtrw_provinsi import FOLDER_DRIVE, _isi_folder, halaman_folder
from penarikan_data.models import LogPenarikan


def tanggal_ubah(teks, hari_ini):
    for pola, isi in (('%b %d, %Y', teks), ('%b %d %Y', f'{teks} {hari_ini.year}')):
        try:
            return datetime.strptime(isi, pola).date().isoformat()
        except ValueError:
            pass
    return hari_ini.isoformat()


def isi_berkas(fid, hari_ini):
    hasil = []
    for bagian in halaman_folder(fid).split('class="flip-entry"')[1:]:
        id_ = re.search(r'id="entry-([A-Za-z0-9_-]+)"', bagian).group(1)
        if 'drive/folders/' in bagian:
            hasil += isi_berkas(id_, hari_ini)
        else:
            ubah = re.search(r'flip-entry-last-modified"><div>([^<]*)<', bagian)
            hasil.append(f'{id_}@{tanggal_ubah(ubah.group(1) if ubah else "", hari_ini)}')
    return hasil


class Command(BaseCommand):
    help = ('Periksa folder RTRW Provinsi KKP. Provinsi yang berkasnya berubah sejak pemeriksaan terakhir dimuat ulang '
            'beserta matriks KKPRL dan bangunan eksistingnya; pemeriksaan pertama hanya mencatat sidik berkas.')

    def add_arguments(self, parser):
        parser.add_argument('--simpan-di', default=os.path.join(tempfile.gettempdir(), 'kkp-rtrw'))

    def handle(self, *args, **opsi):
        hari_ini = date.today()
        sidik = {}
        for folder, fid, nama in _isi_folder(FOLDER_DRIVE):
            m = re.match(r'\[(\d{2})00\]', nama)
            if folder and m:
                isi = '\n'.join(sorted(isi_berkas(fid, hari_ini)))
                sidik[m.group(1)] = hashlib.sha1(isi.encode()).hexdigest()[:16]
        if not sidik:
            raise CommandError('Folder RTRW kosong atau tidak terbaca; zonasi lama dipertahankan.')
        lama = (LogPenarikan.objects.filter(api_config__kode='KKP-RTRW', result='SUCCESS',
                                            response_summary__has_key='sidik')
                .order_by('-started_at').values_list('response_summary', flat=True).first())
        if lama is None:
            self.stdout.write(f'Pemeriksaan pertama: sidik {len(sidik)} provinsi dicatat tanpa memuat ulang.')
            return json.dumps({'sidik': sidik, 'dimuat': []})
        berubah = sorted(k for k, v in sidik.items() if lama['sidik'].get(k) != v)
        for kode in berubah:
            self.stdout.write(self.style.MIGRATE_HEADING(f'Provinsi {kode}: berkas RTRW berubah, dimuat ulang.'))
            shutil.rmtree(os.path.join(opsi['simpan_di'], f'{kode}00'), ignore_errors=True)
            call_command('tarik_rtrw_provinsi', provinsi=[kode], simpan_di=opsi['simpan_di'])
            call_command('tarik_matriks_kkprl', provinsi=[kode], simpan_di=opsi['simpan_di'])
            call_command('tarik_bangunan_eksisting', provinsi=kode)
        self.stdout.write(self.style.SUCCESS(f"Diperiksa {len(sidik)} provinsi; dimuat ulang: {', '.join(berubah) or 'tidak ada'}."))
        return json.dumps({'sidik': sidik, 'dimuat': berubah})
