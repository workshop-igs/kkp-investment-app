import json
import os
import re
import tempfile
from collections import Counter
from pathlib import Path

import pdfplumber
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from analitik.models import KetentuanRuang
from inti.models import Provinsi, SektorInvestasi
from inventarisasi.klasifikasi import (
    KATA_SEKTOR,
    PENANDA_MATRIKS,
    jenis_kawasan,
    rincian_kegiatan,
    status_rincian,
    sub_zona,
    syarat_rincian,
)
from inventarisasi.management.commands.tarik_rtrw_provinsi import FOLDER_DRIVE, _isi_folder, _unduh
from inventarisasi.models import MatriksKKPRL, ZonasiRuangLaut

MATRIKS = {
    '17': (r'PERDA NO 3 POVIBNSI', 114, 153),
    '18': (r'PERDA LAMPUNG NO 14', 153, 201),
    '31': (r'Nomor 7 Tahun 2024', 429, 454),
    '32': (r'Perda No 9 Tahun 2022', 346, 375),
    '33': (r'Perda 8 tahun 2024', 259, 310),
    '34': (r'Perda DIY Nomor 10', 243, 251),
    '35': (r'LAMPIRAN PERDA 10 TAHUN 2023', 49, 135),
    '36': (r'02\. LAMPIRAN PERDA RTRW BANTEN', 40, 119),
    '51': (r'PERDA No\. 2 Tahun 2023', 200, 264),
    '52': (r'Matriks KKPRL', 2, 62),
    '61': (r'4\. LAMPIRAN IX', 1, 18),
    '63': (r'Lampiran IX\.1', 1, 57),
    '64': (r'Lampiran XII Tabel KKPRL', 1, 192),
    '72': (r'^LAMPIRAN PERDA NOMOR 1 TAHUN 2023', 83, 203),
    '73': (r'SALINAN PERDA NOMOR 3 TAHUN 2022', 167, 248),
    '82': (r'LAMPIRAN XVIII TABEL KESESUAIAN', 1, 69),
}
TRANSKRIPSI = Path(__file__).resolve().parents[2] / 'data' / 'matriks_kkprl_transkripsi.json'
STATUS = ('DIIZINKAN', 'BERSYARAT', 'TIDAK_DIIZINKAN')
AWALAN_ZONA = {
    'W': 'Zona Pariwisata', 'PT': 'Zona Perikanan Tangkap', 'PB': 'Zona Perikanan Budi Daya',
    'BD': 'Zona Perikanan Budi Daya', 'PL': 'Zona Pelabuhan Laut', 'PU': 'Zona Pelabuhan Laut',
    'PP': 'Zona Pelabuhan Perikanan', 'P': 'Zona Permukiman', 'PM': 'Zona Permukiman', 'ID': 'Zona Industri',
    'I': 'Zona Industri', 'EN': 'Zona Energi', 'FU': 'Zona Fasilitas Umum', 'DA': 'Zona Dumping Area',
    'HK': 'Zona Pertahanan dan Keamanan', 'PK': 'Zona Pertahanan dan Keamanan', 'JP': 'Zona Perdagangan dan Jasa',
    'BU': 'Zona Bandar Udara', 'GR': 'Zona Pergaraman', 'TB': 'Zona Pertambangan', 'PEP': 'Zona Ekosistem Pesisir',
}

KODE = re.compile(r'^[A-Z][A-Za-z]{0,6}(?:[-–.][A-Za-z0-9]{1,6}){0,3}[-–. ]?\d{1,4}[A-Za-z]?$')
DAFTAR = ('boleh', 'bersyarat', 'tidak')
KATA_KEPALA = re.compile(r'boleh|syarat|khusus|tambahan|kode|zona|lokasi|koordinat|perairan|kab|toponimi|luas|lon|lat|'
                         r'bujur|lintang|bt|ls|pola|kegiatan|pemanfaatan|kota|^\d{1,2}$|^\(?[xy]\)?$', re.I)
JUDUL = re.compile(r'\b(ZONA|KAWASAN|SUB[ -]?ZONA|Zona|Kawasan|Sub[ -]?[Zz]ona)\b')
PELURU = '·•●▪◦‣∙'
PELURU_TUNGGAL = set(PELURU) | {'−', '–', '-'}
GENERIK = re.compile(r'kkpr|tabel|matriks|arahan|lampiran|untuk kegiatan', re.I)
PERDA = re.compile(r'PERATURAN DAERAH\s+((?:PROVINSI|DAERAH ISTIMEWA)\s+.+?)\s+NOMOR\s*:?\s*(\d+)\s+TAHUN\s*:?\s*(\d{4})', re.S)


def bersih(t):
    return re.sub(r'[ \t]+', ' ', (t or '').replace('\xad', '')).strip()


def kunci(teks):
    return re.sub(r'[^a-z0-9]', '', teks.lower())


def peran(teks):
    k = re.sub(r'\s+', ' ', (teks or '').lower()).strip()
    if not k:
        return None
    if 'kode' in k:
        return 'kode'
    if 'tidak' in k and ('boleh' in k or 'izin' in k):
        return 'tidak'
    if ('boleh' in k or 'izin' in k) and re.search(r'syarat|setelah|izin', k):
        return 'bersyarat'
    if 'khusus' in k or 'tambahan' in k:
        return 'khusus'
    if 'boleh' in k or 'diizinkan' in k:
        return 'boleh'
    if re.search(r'\blong|bujur|\(x\)|\bbt\b|\bx\b', k):
        return 'x'
    if re.search(r'\blat\b|lintang|\(y\)|\bls\b|\blu\b|\by\b', k):
        return 'y'
    if re.search(r'rencana pola|rincian pola|pola ruang', k) and not re.search(r'lokasi|provinsi|perairan|objek|luas', k):
        return 'pola'
    if re.search(r'^(zona|sub ?zona|kegiatan|kawasan)\b', k) and not re.search(r'perairan|lokasi|kab', k):
        return 'zona'
    return None


def judul_di_atas(hal, atas):
    if atas <= 5:
        return ''
    teks = hal.crop((0, max(0, atas - 120), hal.width, atas)).extract_text() or ''
    for b in reversed([b.strip() for b in teks.split('\n') if b.strip()]):
        if JUDUL.search(b) and len(b) < 120 and '°' not in b and not re.search(r'kode zona|diperbolehkan', b, re.I):
            return b
    return ''


def koordinat(t, selatan):
    t = (t or '').replace('\n', ' ').strip()
    m = re.match(r'^(-?\d{1,3})[.,](\d+)$', t)
    if m:
        return float(f'{m.group(1)}.{m.group(2)}')
    m = re.match(r"^(\d{1,3})\s*[°ºo]\s*(\d{1,2})\s*['’]\s*([\d.,]+)\s*[\"”]?\s*([A-Z]{0,2})", t)
    if not m:
        return None
    v = int(m.group(1)) + int(m.group(2)) / 60 + float(m.group(3).replace(',', '.').rstrip('.')) / 3600
    return -v if m.group(4) in ('S', 'LS', 'W', 'BB') or (not m.group(4) and selatan) else v


def kepala(tbl, baris):
    judul, awal = '', 0
    lebar = tbl.bbox[2] - tbl.bbox[0]
    while awal < len(baris):
        terisi = [i for i, c in enumerate(baris[awal]) if c]
        sel = tbl.rows[awal].cells
        if len(terisi) == 1 and sel[terisi[0]] and sel[terisi[0]][2] - sel[terisi[0]][0] > lebar * 0.5 \
                and JUDUL.search(baris[awal][terisi[0]].strip()) and '°' not in baris[awal][terisi[0]]:
            judul = re.sub(r'\s+', ' ', baris[awal][terisi[0]]).strip()
            awal += 1
        else:
            break
    for n in range(awal, min(awal + 9, len(baris))):
        roles = {peran(' '.join(filter(None, kol))) for kol in zip(*baris[awal:n + 1])}
        if 'tidak' in roles and ({'boleh', 'bersyarat'} & roles):
            break
    else:
        return None, 0, judul
    akhir = n + 1
    while akhir < len(baris) and all(len(c or '') < 30 for c in baris[akhir]) and (
            not any(baris[akhir]) or any(KATA_KEPALA.search(c or '') for c in baris[akhir] if c)):
        akhir += 1
    rentang = {}
    for i in range(len(baris[0])):
        teks_kolom = ' '.join(filter(None, (r[i] for r in baris[awal:akhir])))
        p = peran(teks_kolom)
        kotak = [tbl.rows[j].cells[i] for j in range(awal, akhir) if tbl.rows[j].cells[i] and baris[j][i]]
        if p and kotak:
            x0, _, x1, _ = min(kotak, key=lambda b: b[2] - b[0])
            rentang.setdefault(p, []).append((x0, x1, teks_kolom.lower()))
    return rentang, akhir, judul


def ke_peran(rentang, x):
    for p, daftar in rentang.items():
        if any(x0 - 1 <= x <= x1 + 1 for x0, x1, _ in daftar):
            return p
    return None


def buang_judul(hal, kotak, teks):
    try:
        kata = hal.crop(kotak, strict=False).extract_words()
    except ValueError:
        return teks
    garis = []
    for w in sorted(kata, key=lambda w: (w['top'], w['x0'])):
        if garis and w['top'] - garis[-1][0] <= 2:
            garis[-1][1].append(w)
        else:
            garis.append((w['top'], [w]))
    indentasi = [g[1] for _, g in garis if len(g) > 1 and g[0]['text'] in PELURU_TUNGGAL]
    if not indentasi:
        return teks
    batas = min(w['x0'] for w in indentasi) - 6
    judul = {' '.join(w['text'] for w in g) for _, g in garis if g[0]['text'] not in PELURU_TUNGGAL and g[0]['x0'] < batas}
    return '\n'.join(b for b in teks.split('\n') if b.strip() not in judul)


def kode_baris(hal, rentang, blok, aktif_awal, entri):
    milik = {k: e for e in entri for k in e['kode_zona']}
    selatan = any(re.search(r'\bls\b|\(s\)', t) for *_, t in rentang.get('y', []))
    garis = []
    for w in sorted(hal.extract_words(), key=lambda w: (w['top'], w['x0'])):
        if garis and w['top'] - garis[-1][0] <= 3:
            garis[-1][1].append(w)
        else:
            garis.append((w['top'], [w]))
    for top, kata in garis:
        def ambil(p, kata=kata):
            return ' '.join(w['text'] for w in sorted(kata, key=lambda w: w['x0'])
                            if ke_peran(rentang, (w['x0'] + w['x1']) / 2) == p)
        kode = re.sub(r'\s+', '', ambil('kode'))
        xy = [koordinat(ambil('x'), False), koordinat(ambil('y'), selatan)]
        if not KODE.match(kode) or None in xy:
            continue
        sasaran = milik.get(kode) or next((e for t, e in reversed(blok) if t <= top + 2), aktif_awal)
        if sasaran is not None and None in sasaran['kode_zona'].get(kode, [None]):
            sasaran['kode_zona'][kode] = xy


def ekstrak(pdf, awal, akhir):
    entri, aktif, rentang = [], None, None
    nama = {'judul': '', 'pola': '', 'zona': ''}
    kode_tunda = ''
    for h in range(awal - 1, min(akhir, len(pdf.pages))):
        hal = pdf.pages[h]
        baris_pertama = True
        aktif_awal, blok = aktif, []
        tabel = [t for t in hal.find_tables() if t.bbox[2] - t.bbox[0] >= hal.width * 0.5]
        for tbl in sorted(tabel, key=lambda t: (round(t.bbox[1]), t.bbox[0])):
            baris = tbl.extract()
            if not baris:
                continue
            r_baru, mulai, judul = kepala(tbl, baris)
            if r_baru and {'boleh', 'tidak'} & set(r_baru):
                rentang = r_baru
            else:
                mulai = 0
            if rentang is None:
                continue
            judul = judul or judul_di_atas(hal, tbl.bbox[1])
            if judul and judul != nama['judul']:
                nama, aktif = {'judul': judul, 'pola': judul, 'zona': ''}, None
            selatan = any(re.search(r'\bls\b|\(s\)', t) for *_, t in rentang.get('y', []))
            for k in range(mulai, len(baris)):
                sel = tbl.rows[k].cells
                isi = {}
                for c, teks in enumerate(baris[k]):
                    p = ke_peran(rentang, (sel[c][0] + sel[c][2]) / 2) if teks and sel[c] else None
                    if p in DAFTAR:
                        teks = buang_judul(hal, sel[c], teks)
                    if p:
                        isi[p] = (isi.get(p, '') + '\n' + teks).strip()
                if not isi or all(re.fullmatch(r'\d{1,2}', v) for v in isi.values()):
                    continue
                zona, pola = ('' if '°' in isi.get(p, '') else re.sub(
                    r'(?<=[a-z]{3}) ([a-z])\b', r'\1', re.sub(r'^[\d.\s]+$', '', bersih(isi.get(p, '')).replace('\n', ' ')))
                              for p in ('zona', 'pola'))
                daftar = {p: bersih(isi.get(p, '')) for p in (*DAFTAR, 'khusus')}
                ada_daftar = any(daftar[p] for p in DAFTAR)
                ada_kode = bool(re.sub(r'\s+', '', isi.get('kode', '')))
                sel_asli = any('\n' in (isi.get(p) or '') for p in DAFTAR)
                pola_baru = bool(pola and pola != nama['pola'])
                terpotong = bool(zona) and not pola_baru and (
                    (k == len(baris) - 1 and nama['zona'].startswith(zona)) or (baris_pertama and zona[0] in '(abcdefghijklmnopqrstuvwxyz'))
                ganti = pola_baru or bool(
                    zona and zona != nama['zona'] and not terpotong and len(zona) < 80 and ('pola' not in rentang or ada_kode))
                if pola:
                    nama['pola'] = pola
                if zona and not terpotong:
                    nama['zona'] = zona
                elif pola and ganti:
                    nama['zona'] = ''
                if aktif is None or ganti or (ada_daftar and ada_kode and sel_asli and not baris_pertama
                                              and any(aktif[p] for p in DAFTAR)):
                    aktif = {'pola': nama['pola'], 'zona': nama['zona'], 'halaman': h + 1, 'kode_zona': {},
                             **{p: '' for p in (*DAFTAR, 'khusus')}}
                    entri.append(aktif)
                    blok.append((tbl.rows[k].bbox[1], aktif))
                for p, v in daftar.items():
                    if v and v not in aktif[p]:
                        aktif[p] = (aktif[p] + '\n' + v).strip()
                if ada_daftar or ada_kode:
                    baris_pertama = False
                kode = re.sub(r'\s+', '', isi.get('kode', ''))
                if re.fullmatch(r'[A-Z][A-Za-z0-9-]*-', kode):
                    kode_tunda = kode
                    continue
                if re.fullmatch(r'\d{1,4}', kode) and kode_tunda:
                    kode = kode_tunda + kode
                kode_tunda = ''
                if kode and KODE.match(kode):
                    aktif['kode_zona'][kode] = [koordinat(isi.get('x'), False), koordinat(isi.get('y'), selatan)]
        if rentang and 'kode' in rentang:
            kode_baris(hal, rentang, blok, aktif_awal, entri)
    return [e for e in entri if any(e[p] for p in DAFTAR)]


def butir(teks):
    teks = re.sub(f'\\s*[{PELURU}]\\s*', '\n•', teks or '')
    teks = re.sub(r'(?m)^\s*[−–-]\s+', '•', teks)
    hasil = []
    for b in teks.split('\n'):
        b = b.strip()
        if not b:
            continue
        if b.startswith('•') or re.match(r'^\(?[a-z0-9]{1,2}[.)]\s', b) or not hasil:
            hasil.append(b)
        else:
            hasil[-1] += ' ' + b
    if len(hasil) == 1 and ';' in hasil[0]:
        hasil = hasil[0].split(';')
    bersih_ = []
    for b in hasil:
        b = re.sub(r'\s+', ' ', re.sub(r'^[•\s]+|[\s;,.:]+$', '', b)).strip()
        if len(b) > 2 and b not in bersih_:
            bersih_.append(b)
    return bersih_


def nama_dasar(e):
    pola, zona = (re.sub(r'^\s*(?:[0-9]{1,2}|[A-Za-z])[.)]\s*', '', e[k]).strip(' -') for k in ('pola', 'zona'))
    pola = re.sub(r'^KKPRL?\s+(?=(?:zona|kawasan)\b)', '', pola, flags=re.I)
    if len(zona) > 60:
        zona = ''
    if GENERIK.search(pola) or len(pola) > 80 or len(pola) < 8 or pola[:1].islower() \
            or re.match(r'(?:sub ?)?(?:zona|kawasan)\b', zona, re.I) or (zona and re.match(r'zona\b', pola, re.I)):
        pola = ''
    nama = f'{pola} - {zona}' if pola and zona and kunci(zona) not in kunci(pola) else (pola or zona)
    return re.sub(r'\s+', ' ', nama)


def nama_blok(e, dipakai):
    nama = nama_dasar(e)
    if not nama or dipakai[nama] > 1:
        awalan = Counter(re.sub(r'^(?:KPU|KK)[-–]', '', re.split(r'[-–. ]?\d+[A-Za-z]?$', k)[0]).split('-')[0]
                         for k in e['kode_zona'])
        terbanyak = awalan.most_common(1)[0][0] if awalan else ''
        nama = AWALAN_ZONA.get(terbanyak) or ('Kawasan Konservasi' if any(k.startswith('KK') for k in e['kode_zona'])
                                              else nama)
    if nama.isupper():
        nama = re.sub(r'\s*\([A-Z]+\)', '', nama.split(' DI ')[0]).title()
    return nama[:255]


def cari_berkas(fid, pola, jalur=()):
    for folder, id_, nama in _isi_folder(fid):
        if folder and not nama.lower().endswith('.gdb'):
            hasil = cari_berkas(id_, pola, (*jalur, nama))
            if hasil:
                return hasil
        elif not folder and re.search(pola, nama, re.I):
            return (*jalur, nama), id_
    return None


class Command(BaseCommand):
    help = ('Tarik matriks kesesuaian kegiatan pemanfaatan ruang laut (KKPRL) dari lampiran Perda RTRW Provinsi di '
            'folder Google Drive KKP: daftar kegiatan diperbolehkan, bersyarat, dan tidak diperbolehkan per zona, '
            'ditautkan ke poligon zona dan diturunkan menjadi ketentuan per jenis investasi.')

    def add_arguments(self, parser):
        parser.add_argument('--provinsi', action='append', help='Kode BPS provinsi, mis. 31 (boleh berulang).')
        parser.add_argument('--ketentuan-saja', action='store_true',
                            help='Turunkan ulang ketentuan per jenis investasi dari matriks tersimpan, tanpa mengunduh.')
        parser.add_argument('--simpan-di', default=os.path.join(tempfile.gettempdir(), 'kkp-rtrw'),
                            help='Folder unduhan (dipakai ulang bila berkasnya sudah ada).')

    def handle(self, *args, **opsi):
        if opsi['ketentuan_saja']:
            provinsi = Provinsi.objects.filter(matriks_kkprl__isnull=False).distinct()
            if opsi['provinsi']:
                provinsi = provinsi.filter(kode_bps__in=opsi['provinsi'])
            for p in provinsi:
                blok = list(p.matriks_kkprl.all())
                with transaction.atomic():
                    jumlah = self._ketentuan(p, blok, blok[0].sumber)
                self.stdout.write(f'  {p.nama}: {jumlah} ketentuan per jenis investasi')
            return
        transkripsi = json.loads(TRANSKRIPSI.read_text(encoding='utf-8'))
        diminta = set(opsi['provinsi'] or [*MATRIKS, *transkripsi])
        for kode in sorted(diminta & set(transkripsi)):
            provinsi = Provinsi.objects.filter(kode_bps=kode).first()
            data = transkripsi[kode]
            self.stdout.write(self.style.MIGRATE_HEADING(f'{provinsi.nama}: transkripsi {data["berkas"]}'))
            sumber = f'{data["perda"]}, {PENANDA_MATRIKS} ({data.get("cara", "transkripsi lampiran pindaian")})'
            blok = [(MatriksKKPRL(
                provinsi=provinsi, nama_zona=b['nama_zona'], sub_zona=sub_zona(b['nama_zona'], jenis_kawasan(b['nama_zona'])),
                kode_zona=list(b.get('kode_zona', [])), diperbolehkan=b['diperbolehkan'], bersyarat=b['bersyarat'],
                tidak_diperbolehkan=b['tidak_diperbolehkan'], ketentuan_khusus=b.get('ketentuan_khusus', ''),
                sumber=sumber[:255], halaman=b['halaman'],
            ), b['kode_zona'] if isinstance(b.get('kode_zona'), dict) else {}) for b in data['blok']]
            self._simpan(provinsi, blok, sumber)
        if not diminta & set(MATRIKS):
            return
        for folder, fid, nama in _isi_folder(FOLDER_DRIVE):
            m = re.match(r'\[(\d{2})00\]', nama)
            if not (folder and m) or m.group(1) not in diminta or m.group(1) not in MATRIKS:
                continue
            provinsi = Provinsi.objects.filter(kode_bps=m.group(1)).first()
            pola, awal, akhir = MATRIKS[m.group(1)]
            cocok = cari_berkas(fid, pola)
            if provinsi is None or cocok is None:
                self.stdout.write(self.style.WARNING(f'{nama}: lampiran matriks tidak ditemukan, dilewati.'))
                continue
            tujuan = os.path.join(opsi['simpan_di'], m.group(1) + '00', cocok[0][-1])
            if not os.path.exists(tujuan):
                os.makedirs(os.path.dirname(tujuan), exist_ok=True)
                _unduh(cocok[1], tujuan)
            self.stdout.write(self.style.MIGRATE_HEADING(f'{nama}: {cocok[0][-1]} hal. {awal}-{akhir}'))
            with pdfplumber.open(tujuan) as pdf:
                entri = ekstrak(pdf, awal, akhir)
                perda = self._perda(pdf, awal, provinsi, cocok[0][-1])
            sumber = f'{perda}, {PENANDA_MATRIKS}'
            dipakai = Counter(nama_dasar(e) for e in entri)
            blok = []
            for e in entri:
                nama_zona = nama_blok(e, dipakai)
                blok.append((MatriksKKPRL(
                    provinsi=provinsi, nama_zona=nama_zona,
                    sub_zona=sub_zona(f"{nama_zona} {e['zona']}", jenis_kawasan(nama_zona)),
                    kode_zona=sorted(e['kode_zona']), diperbolehkan=butir(e['boleh']), bersyarat=butir(e['bersyarat']),
                    tidak_diperbolehkan=butir(e['tidak']), ketentuan_khusus=re.sub(r'\s*\n\s*', ' ', e['khusus']).strip(),
                    sumber=sumber[:255], halaman=e['halaman'],
                ), e['kode_zona']))
            self._simpan(provinsi, blok, sumber)

    def _perda(self, pdf, awal, provinsi, berkas):
        for h in [*range(awal - 1, min(awal + 2, len(pdf.pages))), *range(min(3, len(pdf.pages)))]:
            m = PERDA.search(pdf.pages[h].extract_text() or '')
            if m:
                wilayah = re.sub(r'\s+', ' ', m.group(1)).title()
                return f'Perda {wilayah} No. {m.group(2)}/{m.group(3)}'
        m = re.search(r'(?:PERDA|NOMOR)\D{0,6}?(\d{1,2})\s+TAHUN\s+(\d{4})', berkas, re.I)
        return f'Perda Provinsi {provinsi.nama} No. {m.group(1)}/{m.group(2)}' if m else f'Perda RTRW {provinsi.nama}'

    def _simpan(self, provinsi, blok, sumber):
        with transaction.atomic():
            ZonasiRuangLaut.objects.filter(provinsi=provinsi).update(matriks=None, kode_perda='')
            MatriksKKPRL.objects.filter(provinsi=provinsi).delete()
            MatriksKKPRL.objects.bulk_create([m for m, _ in blok])
            tertaut, diperinci = self._tautkan(provinsi, blok)
            per_jenis = self._tautkan_jenis(provinsi, [m for m, _ in blok])
            aturan = self._ketentuan(provinsi, [m for m, _ in blok], sumber)
        self.stdout.write(self.style.SUCCESS(
            f'  {len(blok)} blok zona, {sum(len(m.kode_zona) for m, _ in blok)} kode zona ({tertaut} tertaut ke poligon), '
            f'{per_jenis} zona lain tertaut menurut jenis zona, {aturan} ketentuan per jenis investasi, '
            f'{diperinci} Kawasan Perikanan diperinci; sumber {sumber.split(",")[0]}'
        ))

    def _tautkan_jenis(self, provinsi, blok):
        per_jenis = {}
        for m in blok:
            per_jenis.setdefault(m.sub_zona, []).append(m)
        tunggal = {sub: daftar[0] for sub, daftar in per_jenis.items() if len(daftar) == 1 and sub != 'LAINNYA'}
        zona = list(ZonasiRuangLaut.objects.filter(
            provinsi=provinsi, tingkat_acuan='RTRW_PROVINSI', ranah='LAUT', matriks__isnull=True, sub_zona__in=tunggal))
        for z in zona:
            z.matriks = tunggal[z.sub_zona]
        ZonasiRuangLaut.objects.bulk_update(zona, ['matriks'], batch_size=500)
        return len(zona)

    def _tautkan(self, provinsi, blok):
        titik = [(kode, xy[0], xy[1], m) for m, kode_zona in blok for kode, xy in kode_zona.items() if None not in xy]
        if not titik:
            return 0, 0
        with connection.cursor() as c:
            c.execute(
                """
                SELECT t.i, z.id FROM unnest(%s::int[], %s::float8[], %s::float8[], %s::text[]) AS t(i, x, y, sub)
                CROSS JOIN LATERAL (
                    SELECT DISTINCT ON (z.sumber_data) z.id, z.sumber_data
                    FROM inventarisasi_zonasi_ruang_laut z,
                         (VALUES (ST_SetSRID(ST_Point(t.x, t.y), 4326)), (ST_SetSRID(ST_Point(t.x, -t.y), 4326))) p(g)
                    WHERE z.provinsi_id = %s AND z.tingkat_acuan = 'RTRW_PROVINSI' AND z.ranah = 'LAUT'
                      AND ST_DWithin(z.geometry, p.g, 0.002)
                    ORDER BY z.sumber_data, ST_Intersects(z.geometry, p.g) DESC,
                             (z.sub_zona = t.sub OR split_part(z.sub_zona, '_', 1) = split_part(t.sub, '_', 1)
                              OR z.sub_zona || t.sub IN ('PERTAMBANGANENERGI', 'ENERGIPERTAMBANGAN',
                                                         'MANGROVEEKOSISTEM_PESISIR', 'EKOSISTEM_PESISIRMANGROVE')) DESC,
                             ST_Distance(z.geometry, p.g)
                ) z
                """,
                [list(range(len(titik))), [t[1] for t in titik], [t[2] for t in titik], [t[3].sub_zona for t in titik],
                 provinsi.id],
            )
            per_zona = {}
            for i, zid in c.fetchall():
                per_zona.setdefault(zid, []).append(titik[i])
        zona = list(ZonasiRuangLaut.objects.filter(id__in=per_zona))
        diperinci = 0
        for z in zona:
            kode = per_zona[z.id]
            terbanyak = Counter(t[3].id for t in kode).most_common(1)[0][0]
            z.matriks = next(t[3] for t in kode if t[3].id == terbanyak)
            z.kode_perda = ', '.join(sorted({t[0] for t in kode}))
            jenis = {t[3].sub_zona for t in kode} & {'PERIKANAN_TANGKAP', 'PERIKANAN_BUDIDAYA'}
            if z.sub_zona == 'PERIKANAN' and len(jenis) == 1:
                z.sub_zona, z.nama_zona = z.matriks.sub_zona, z.matriks.nama_zona
                diperinci += 1
            z.keterangan = re.sub(r';?\s*Kode zona Perda: [^;]*', '', z.keterangan).strip('; ')
        ZonasiRuangLaut.objects.bulk_update(zona, ['matriks', 'kode_perda', 'sub_zona', 'nama_zona', 'keterangan'],
                                            batch_size=500)
        return len({t[0] for v in per_zona.values() for t in v}), diperinci

    def _ketentuan(self, provinsi, blok, sumber):
        acuan = {}
        for m in blok:
            lama = acuan.get(m.sub_zona)
            if m.sub_zona not in ('KONSERVASI', 'LAINNYA') and (lama is None or len(m.kode_zona) > len(lama.kode_zona)):
                acuan[m.sub_zona] = m
        sektor = {s.kode: s for s in SektorInvestasi.objects.filter(kode__in=KATA_SEKTOR)}
        rincian = {sub: {k: rincian_kegiatan(m, k) for k in sektor} for sub, m in acuan.items()}
        status = {sub: {k: status_rincian(r) for k, r in per_sektor.items()} for sub, per_sektor in rincian.items()}
        label = dict(KetentuanRuang.STATUS_CHOICES)
        aturan = [
            KetentuanRuang(
                sektor=sektor[k], sub_zona=sub, provinsi=provinsi, status=st,
                syarat=syarat_rincian(rincian[sub][k], acuan[sub].ketentuan_khusus) if st == 'BERSYARAT' else '',
                sumber=f'{sumber} ({acuan[sub].nama_zona})'[:255],
            )
            for sub, per_sektor in status.items() for k, st in per_sektor.items() if st
        ]
        tangkap, budidaya = status.get('PERIKANAN_TANGKAP'), status.get('PERIKANAN_BUDIDAYA')
        if tangkap and budidaya and 'PERIKANAN' not in status:
            for k in sektor:
                a, b = tangkap[k], budidaya[k]
                if a and b:
                    st = a if a == b else 'BERSYARAT'
                    aturan.append(KetentuanRuang(
                        sektor=sektor[k], sub_zona='PERIKANAN', provinsi=provinsi, status=st,
                        syarat=(f'Kawasan Perikanan pada {sumber.split(",")[0]} terbagi atas zona perikanan tangkap '
                                f'({label[a].lower()}) dan zona perikanan budi daya ({label[b].lower()}); '
                                'status pasti mengikuti kode zona di lokasi.') if st == 'BERSYARAT' else '',
                        sumber=f'{sumber} (Kawasan Perikanan)'[:255],
                    ))
        KetentuanRuang.objects.filter(provinsi=provinsi, sumber__contains=PENANDA_MATRIKS).delete()
        KetentuanRuang.objects.bulk_create(aturan)
        return len(aturan)
