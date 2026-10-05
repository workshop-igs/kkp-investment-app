import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

BASE = 'https://webapi.bps.go.id/v1/api'

HEADER = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    'Accept': 'application/json',
}

WAKTU_HABIS = 20

CACHE_DETIK = 60 * 60 * 24

DOMAIN_NASIONAL = '0000'

VARIABEL_NASIONAL = {
    'tpt': {
        'wajib': [['tingkat'], ['pengangguran'], ['terbuka']],
        'larang': [
            'setengah', 'pendidikan', 'umur', 'jenis kelamin',
            'daerah tempat tinggal',
        ],
    },
    'pengangguran': {
        'wajib': [['angkatan kerja']],
        'larang': [
            'bukan', 'tingkat', 'persentase', 'golongan umur',
            'kelompok umur', 'pendidikan', 'jenis kelamin',
        ],
        'turvar': ['jumlah pengangguran'],
    },
}


def peringkat_variabel(katalog: List[Dict[str, Any]], spec: Dict[str, Any]) -> List[int]:
    kandidat = []
    for v in katalog:
        judul = (v.get('title') or '').lower()
        if not judul or v.get('var_id') is None:
            continue
        if any(k in judul for k in spec['larang']):
            continue
        if not all(any(k in judul for k in kelompok) for kelompok in spec['wajib']):
            continue
        per_kabupaten = 'kabupaten' in judul or 'kab/kota' in judul
        kandidat.append((0 if per_kabupaten else 1, len(judul), v['var_id']))

    kandidat.sort()
    return [var_id for *_, var_id in kandidat]


class BPSTidakTersedia(Exception):
    pass


class DomainTidakDikenal(BPSTidakTersedia):
    pass


def _minta(path: str) -> Dict[str, Any]:
    kunci = getattr(settings, 'BPS_API_KEY', '')
    if not kunci:
        raise BPSTidakTersedia('BPS_API_KEY belum diisi di .env')

    url = f'{BASE}/{path}/key/{kunci}'
    simpanan = f'bps:{path}'
    tersimpan = cache.get(simpanan)
    if tersimpan is not None:
        return tersimpan

    try:
        r = requests.get(url, headers=HEADER, timeout=WAKTU_HABIS)
        if r.status_code == 404:
            raise DomainTidakDikenal(
                'BPS tidak mengenal domain ini (HTTP 404) — kemungkinan besar '
                'wilayahnya belum masuk katalog WebAPI.'
            )
        r.raise_for_status()
        d = r.json()
    except requests.RequestException as e:
        raise BPSTidakTersedia(f'Gagal menghubungi BPS: {e}') from e
    except ValueError as e:
        raise BPSTidakTersedia('BPS membalas dengan isi yang bukan JSON') from e

    if str(d.get('status')).upper() != 'OK':
        raise BPSTidakTersedia(f"BPS menolak permintaan: {d.get('message') or d.get('status')}")

    cache.set(simpanan, d, CACHE_DETIK)
    return d


def _isi(d: Dict[str, Any]) -> List[Dict[str, Any]]:
    data = d.get('data')
    if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list):
        return data[1]
    return []


BATAS_HALAMAN_KATALOG = 40

BATAS_HALAMAN_SUBJEK = 6

POLA_SUBJEK_KERJA = re.compile(r'tenaga kerja|ketenagakerjaan', re.IGNORECASE)


def _halaman(path: str, batas: int) -> List[Dict[str, Any]]:
    hasil: List[Dict[str, Any]] = []
    for halaman in range(1, batas + 1):
        try:
            d = _minta(f'{path}/page/{halaman}')
        except BPSTidakTersedia:
            if halaman == 1:
                raise
            break
        isi = _isi(d)
        if not isi:
            break
        hasil += isi
        info = d.get('data', [{}])[0] if isinstance(d.get('data'), list) else {}
        if halaman >= (info.get('pages') or 1):
            break
    return hasil


def subjek_ketenagakerjaan(domain: str) -> Optional[int]:
    for s in _halaman(f'list/model/subject/domain/{domain}', BATAS_HALAMAN_SUBJEK):
        if POLA_SUBJEK_KERJA.search(s.get('title') or ''):
            return s.get('sub_id')
    return None


def daftar_variabel(domain: str) -> List[Dict[str, Any]]:
    sub_id = subjek_ketenagakerjaan(domain)
    path = (
        f'list/model/var/domain/{domain}/subject/{sub_id}'
        if sub_id is not None
        else f'list/model/var/domain/{domain}'
    )
    return _halaman(path, BATAS_HALAMAN_KATALOG)


JUMLAH_TAHUN_DITARIK = 2


def tahun_tersedia(domain: str, var_id: int, batas: int = 1) -> List[Dict[str, Any]]:
    try:
        d = _minta(f'list/model/th/domain/{domain}/var/{var_id}')
    except BPSTidakTersedia:
        return []
    isi = [t for t in _isi(d) if t.get('th_id') is not None]
    isi.sort(key=lambda t: int(t.get('th') or 0), reverse=True)
    return isi[:batas]


def _pilih_turvar(
    daftar: List[Dict[str, Any]], pola: Optional[List[str]]
) -> Optional[str]:
    nilai = {str(t.get('val')): str(t.get('label') or '').lower() for t in daftar}
    if not nilai or set(nilai) == {'0'}:
        return '0'
    if not pola:
        return '0' if '0' in nilai else None
    for p in pola:
        for val, label in nilai.items():
            if p in label and 'bukan' not in label:
                return val
    return None


def data_per_wilayah(
    domain: str, var_id: int, th_id: int, pola_turvar: Optional[List[str]] = None
) -> Dict[str, Any]:
    try:
        d = _minta(f'list/model/data/lang/ind/domain/{domain}/var/{var_id}/th/{th_id}')
    except BPSTidakTersedia:
        return {}

    turvar = _pilih_turvar(d.get('turvar') or [], pola_turvar)
    if turvar is None:
        return {}

    wilayah = {str(v.get('val')): v.get('label') for v in (d.get('vervar') or [])}
    isi = d.get('datacontent') or {}

    hasil: Dict[str, Any] = {}
    for kunci in sorted(isi):
        for kode, label in wilayah.items():
            if kunci.startswith(f'{kode}{var_id}{turvar}{th_id}'):
                hasil.setdefault(kode, {
                    'wilayah': label, 'nilai': isi[kunci]})
                break
    return hasil


def data_komoditas(var_id: int, th_id: int) -> Dict[tuple, Any]:
    d = _minta(f'list/model/data/lang/ind/domain/{DOMAIN_NASIONAL}/var/{var_id}/th/{th_id}')
    komoditas = {str(t.get('val')): t.get('label') for t in d.get('turvar') or []}
    isi = d.get('datacontent') or {}
    hasil = {}
    for v in d.get('vervar') or []:
        for kode, label in komoditas.items():
            nilai = isi.get(f"{v.get('val')}{var_id}{kode}{th_id}0")
            if nilai is not None:
                hasil[(str(v.get('val')), label)] = nilai
    return hasil


TOLERANSI_TAHUN_DATA = 1


def _nama_baku(teks) -> str:
    t = re.sub(r'^\d+\s*', '', str(teks or '').strip().lower())
    t = re.sub(r'^(kabupaten|kab\.?)\s+', '', t).replace('kep.', 'kepulauan')
    return re.sub(r'[^a-z0-9]', '', t)


def cocokkan_kabupaten(per_wilayah: Dict[str, Any], nama_provinsi: str, daftar_kabupaten) -> Dict[str, Any]:
    per_kode = {k: (k, nama, jenis) for k, nama, jenis in daftar_kabupaten}
    per_nama = {_nama_baku(nama): (k, nama, jenis) for k, nama, jenis in daftar_kabupaten}
    provinsi = _nama_baku(nama_provinsi)
    hasil = {}
    for kode, isi in per_wilayah.items():
        baku = _nama_baku(isi.get('wilayah'))
        kab = per_kode.get(str(kode)) or (per_nama.get(baku) if baku != provinsi else None)
        if kab:
            hasil[kab[0]] = {'wilayah': ('Kabupaten ' if kab[2] == 'KAB' else '') + kab[1], 'nilai': isi.get('nilai')}
    return hasil


def tahun_angka(tahun: str) -> Optional[int]:
    digit = ''.join(c for c in str(tahun or '') if c.isdigit())[:4]
    return int(digit) if len(digit) == 4 else None


def data_masih_layak(tahun: str, tahun_acuan: Optional[int] = None) -> bool:
    angka = tahun_angka(tahun)
    if angka is None:
        return False
    return (tahun_acuan or datetime.now().year) - angka <= TOLERANSI_TAHUN_DATA


def _kemutakhiran(tahun: str, tahun_acuan: int) -> Dict[str, Any]:
    angka = tahun_angka(tahun)
    if angka is None:
        return {'kemutakhiran': 'tidak diketahui', 'selisih_tahun': None}
    selisih = tahun_acuan - angka
    if selisih <= 0:
        nilai = 'tahun berjalan'
    elif selisih <= TOLERANSI_TAHUN_DATA:
        nilai = 'satu tahun sebelum'
    else:
        nilai = 'usang'
    return {'kemutakhiran': nilai, 'selisih_tahun': selisih}


def statistik_ketenagakerjaan(
    kode_provinsi: str, tahun_analisis: Optional[int] = None, kode_kabupaten: Optional[str] = None
) -> Dict[str, Any]:
    from penarikan_data.models import StatistikKetenagakerjaanBPS

    kode = f'{str(kode_provinsi).zfill(2)[:2]}00'

    tahun_acuan = tahun_analisis or datetime.now().year

    hasil: Dict[str, Any] = {
        'tersedia': False,
        'domain': DOMAIN_NASIONAL,
        'kode_wilayah': kode,
        'wilayah': '',
        'sumber': 'Badan Pusat Statistik - WebAPI (disimpan lokal)',
        'tahun_acuan': tahun_acuan,
        'tahun_minimum': tahun_acuan - TOLERANSI_TAHUN_DATA,
        'indikator': {},
        'catatan': '',
    }

    baris = list(StatistikKetenagakerjaanBPS.objects.filter(domain=DOMAIN_NASIONAL))
    per_indikator: Dict[str, List[Any]] = {}
    for b in baris:
        per_indikator.setdefault(b.indikator, []).append(b)

    for nama, grup in per_indikator.items():
        grup.sort(key=lambda b: tahun_angka(b.tahun) or 0, reverse=True)
        pilih = next((b for b in grup if kode in (b.per_wilayah or {})), None)
        if pilih is None:
            continue
        w = pilih.per_wilayah[kode]
        hasil['wilayah'] = hasil['wilayah'] or str(w.get('wilayah') or '').title()
        hasil['indikator'][nama] = {
            'var_id': pilih.var_id,
            'tahun': pilih.tahun,
            'nilai': w.get('nilai'),
            'tingkat': 'provinsi',
            'wilayah': str(w.get('wilayah') or '').title(),
            **_kemutakhiran(pilih.tahun, tahun_acuan),
        }

    if kode_kabupaten:
        terbaru = sorted(StatistikKetenagakerjaanBPS.objects.filter(domain=kode),
                         key=lambda b: tahun_angka(b.tahun) or 0, reverse=True)
        for b in terbaru:
            w = (b.per_wilayah or {}).get(str(kode_kabupaten))
            prov = hasil['indikator'].get(b.indikator)
            if w is None or (prov or {}).get('tingkat') == 'kabupaten':
                continue
            hasil['indikator'][b.indikator] = {
                'var_id': b.var_id,
                'tahun': b.tahun,
                'nilai': w.get('nilai'),
                'tingkat': 'kabupaten',
                'wilayah': w.get('wilayah'),
                'provinsi': prov and {k: prov[k] for k in ('nilai', 'tahun', 'wilayah')},
                **_kemutakhiran(b.tahun, tahun_acuan),
            }

    hasil['tersedia'] = bool(hasil['indikator'])
    if hasil['tersedia']:
        diperiksa = [b.diperiksa_pada for b in baris if b.diperiksa_pada]
        if diperiksa:
            hasil['diperiksa_pada'] = min(diperiksa).date().isoformat()
    else:
        hasil['catatan'] = (
            f'Statistik ketenagakerjaan provinsi {kode} belum ditarik ke basis '
            f'data. Jalankan: manage.py tarik_statistik_bps'
        )
    return hasil
