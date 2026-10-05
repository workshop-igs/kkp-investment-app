import html
import re

import httpx
from django.core.management.base import BaseCommand
from django.db.models import Count

from analitik.services.profil_investasi import _sumber_utama_semua
from inti.models import Provinsi
from inventarisasi.models import RegulasiTataRuang, ZonasiRuangLaut

DASAR = 'https://peraturan.bpk.go.id'
TENTANG = {'KKP-RTRW': 'rencana tata ruang wilayah', 'KKP-RZWP3K': 'rencana zonasi wilayah pesisir'}
KARTU = re.compile(r'href="(/Details/(\d+)/[^"]+)">\s*([^<]+?)\s*</a>.*?href="/Details/\2/[^"]+">\s*([^<]+?)\s*</a>', re.S)
JUDUL = re.compile(r'Peraturan Daerah\s*\(perda\)\s*(Provinsi .+?)\s+(?:Nomor|No\.)\s*(\d+)\s+Tahun\s+(\d{4})', re.I)


def _baku(teks):
    teks = teks.lower().replace('daerah istimewa', 'di').replace('daerah khusus ibukota', 'dki')
    teks = re.sub(r'\s*-\s*', '-', teks)
    return re.sub(r'\s+', ' ', teks).strip()


def _rapikan(teks):
    teks = re.sub(r'\s+', ' ', html.unescape(teks).replace('�', '–')).strip()
    return teks.title().replace(' Dan ', ' dan ') if teks.isupper() else teks


def _kandidat(klien, sumber, provinsi, tahun):
    kata = f'{TENTANG[sumber]} provinsi {provinsi.nama}' + (f' tahun {tahun}' if tahun else '')
    r = klien.get(f'{DASAR}/Search', params={'keywords': kata, 'tentang': '', 'nomor': ''})
    r.raise_for_status()
    hasil = []
    for kartu in r.text.split('card-body p-xl-10')[1:]:
        m = KARTU.search(kartu)
        j = m and JUDUL.search(html.unescape(m.group(3)))
        if not j or _baku(j.group(1)) != f'provinsi {_baku(provinsi.nama)}':
            continue
        tentang = _baku(m.group(4))
        if not tentang.startswith(TENTANG[sumber]) or 'perubahan' in tentang:
            continue
        hasil.append({
            'tahun': int(j.group(3)),
            'judul': f'Peraturan Daerah Provinsi {provinsi.nama} Nomor {j.group(2)} Tahun {j.group(3)}',
            'tentang': _rapikan(m.group(4)),
            'tautan': DASAR + m.group(1),
        })
    return hasil


class Command(BaseCommand):
    help = 'Cocokkan Perda RTRW/RZWP-3-K sumber zonasi utama tiap provinsi dengan JDIH BPK (peraturan.bpk.go.id).'

    def handle(self, *args, **options):
        utama = _sumber_utama_semua()
        with httpx.Client(timeout=40, headers={'User-Agent': 'Mozilla/5.0'}, follow_redirects=True) as klien:
            for provinsi in Provinsi.objects.filter(id__in=utama).order_by('nama'):
                sumber = utama[provinsi.id]
                if sumber not in TENTANG:
                    RegulasiTataRuang.objects.filter(provinsi=provinsi).delete()
                    continue
                tahun = (
                    ZonasiRuangLaut.objects.filter(provinsi=provinsi, sumber_data=sumber, tahun_penetapan__isnull=False)
                    .values('tahun_penetapan').annotate(n=Count('id')).order_by('-n')
                    .values_list('tahun_penetapan', flat=True).first()
                )
                try:
                    pilih = None
                    for t in ([tahun, tahun + 1, tahun - 1] if tahun else [None]):
                        cocok = [k for k in _kandidat(klien, sumber, provinsi, t) if t is None or k['tahun'] == t]
                        if cocok:
                            pilih = max(cocok, key=lambda k: k['tahun'])
                            break
                except httpx.HTTPError as e:
                    self.stderr.write(f'{provinsi.nama}: JDIH BPK tidak terjangkau ({e}); data lama dipertahankan.')
                    continue
                if not pilih:
                    RegulasiTataRuang.objects.filter(provinsi=provinsi).delete()
                    self.stdout.write(f'{provinsi.nama}: tidak ada Perda yang cocok dengan tahun data {tahun}.')
                    continue
                RegulasiTataRuang.objects.filter(provinsi=provinsi).exclude(sumber_data=sumber).delete()
                RegulasiTataRuang.objects.update_or_create(
                    provinsi=provinsi, sumber_data=sumber,
                    defaults={k: pilih[k] for k in ('judul', 'tentang', 'tautan')},
                )
                self.stdout.write(f'{provinsi.nama}: {pilih["judul"]} tentang {pilih["tentang"]}')
