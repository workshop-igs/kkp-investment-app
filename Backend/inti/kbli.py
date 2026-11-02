import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def katalog():
    isi = json.loads(Path(__file__).with_name('kbli_2025.json').read_text(encoding='utf-8'))
    return {x['kode']: x for x in isi}


def ringkas(kode):
    x = katalog().get(kode or '')
    return {'kode': x['kode'], 'judul': x['judul']} if x else None


def cari(teks, batas=30):
    teks = (teks or '').strip().lower()
    if not teks:
        return []
    if teks.isdigit():
        return [ringkas(k) for k in katalog() if k.startswith(teks)][:batas]
    kata = teks.split()
    judul, uraian = [], []
    for x in katalog().values():
        if all(k in x['judul'].lower() for k in kata):
            judul.append(ringkas(x['kode']))
        elif all(k in x['uraian'].lower() for k in kata):
            uraian.append(ringkas(x['kode']))
    return (judul + uraian)[:batas]
