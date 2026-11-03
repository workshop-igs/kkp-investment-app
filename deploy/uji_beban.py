import argparse
import json
import random
import statistics
import threading
import time
import urllib.error
import urllib.request

parser = argparse.ArgumentParser(description='Uji beban KKP Investment App. Jalankan di server, ke gunicorn langsung.')
parser.add_argument('--alamat', default='http://127.0.0.1:8001')
parser.add_argument('--domain', default='', help='nama domain situs (header Host) bila --alamat langsung ke gunicorn')
parser.add_argument('--data', default='/tmp/uji_beban_data.json', help='hasil deploy/siapkan_uji_beban.py')
parser.add_argument('--skenario', default='campur', choices=['profil', 'peta', 'analisis', 'campur'])
parser.add_argument('--pengguna', type=int, default=50)
parser.add_argument('--detik', type=int, default=60)
arg = parser.parse_args()

with open(arg.data) as f:
    DATA = json.load(f)
KEPALA = {'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json',
          **({'Host': arg.domain} if arg.domain else {})}
LAYER = ['analitik/lokasi-potensial', 'inventarisasi/zonasi', 'inventarisasi/kkprl', 'inventarisasi/infrastruktur']
KATA = ['lombok', 'bali', 'pelabuhan', 'makassar', 'kupang', '713', 'ambon', 'surabaya']


def minta(jalur, ip, token=None, isi=None):
    kepala = {**KEPALA, 'X-Forwarded-For': ip, 'Accept-Encoding': 'gzip'}
    if token:
        kepala['Authorization'] = f'Bearer {token}'
    data = json.dumps(isi).encode() if isi is not None else None
    req = urllib.request.Request(arg.alamat + '/api/v1/' + jalur, data=data, headers=kepala,
                                 method='POST' if data else 'GET')
    mulai = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            r.read()
            kode = r.status
    except urllib.error.HTTPError as e:
        kode = e.code
    except Exception:
        kode = 0
    return kode, time.perf_counter() - mulai


def peta(ip, token):
    x0, y0, x1, y1 = random.choice(DATA['kotak'])
    lebar = random.choice([0.3, 0.8, 2.0])
    cx, cy = random.uniform(x0, x1), random.uniform(y0, y1)
    bbox = f'{cx - lebar:.4f},{cy - lebar / 2:.4f},{cx + lebar:.4f},{cy + lebar / 2:.4f}'
    if random.random() < 0.15:
        return 'cari', minta(f'inti/cari/?q={random.choice(KATA)}', ip)
    return 'layer peta', minta(f'{random.choice(LAYER)}/peta/?bbox={bbox}', ip, token)


def profil(ip, token):
    return 'data profil', minta(f"inti/provinsi/{random.choice(DATA['provinsi'])}/profil-investasi/", ip)


def analisis(ip, token):
    a = random.choice(DATA['area'])
    langkah = random.choice(['screening', 'analisis', 'laporan-spasial'])
    isi = {'geometry': a['geometry'], 'sektor': a['sektor'], 'sub_sektor': a['sub_sektor']}
    if langkah == 'analisis':
        isi.update({'capex_idr': 5e9, 'annual_revenue_idr': 2e9, 'annual_opex_idr': 1e9, 'wacc_pct': 12,
                    'lifetime_yr': 10, 'revenue_growth_pct': 3, 'opex_growth_pct': 3, 'tenaga_kerja_estimasi': None})
    if langkah == 'laporan-spasial':
        isi = {'geometry': a['geometry']}
    return langkah, minta(f'analitik/{langkah}/', ip, token, isi)


def campur(ip, token):
    r = random.random()
    return peta(ip, token) if r < 0.75 else profil(ip, token) if r < 0.9 else analisis(ip, token)


AKSI = {'profil': profil, 'peta': peta, 'analisis': analisis, 'campur': campur}[arg.skenario]
hasil = []
kunci = threading.Lock()
selesai_pada = time.time() + arg.detik


def pengguna(n):
    ip = f'10.{n // 65536 % 256}.{n // 256 % 256}.{n % 256}'
    token = DATA['token'][n % len(DATA['token'])]
    while time.time() < selesai_pada:
        jenis, (kode, durasi) = AKSI(ip, token)
        with kunci:
            hasil.append((jenis, kode, durasi))
        time.sleep(random.uniform(1.0, 3.0))


utas = [threading.Thread(target=pengguna, args=(i + 1,)) for i in range(arg.pengguna)]
t0 = time.time()
for u in utas:
    u.start()
    time.sleep(0.02)
for u in utas:
    u.join()
lama = time.time() - t0


def ringkas(baris):
    waktu = sorted(d for _, k, d in baris if k == 200)
    gagal = {}
    for _, k, _ in baris:
        if k != 200:
            gagal[k] = gagal.get(k, 0) + 1
    if not waktu:
        return f'0 berhasil, gagal {gagal}'
    p = lambda q: waktu[min(len(waktu) - 1, int(len(waktu) * q))]  # noqa: E731
    return (f'{len(waktu)} berhasil | gagal {sum(gagal.values())} {gagal or ""} | median {statistics.median(waktu):.2f} dtk '
            f'| p90 {p(0.9):.2f} | p99 {p(0.99):.2f} | maks {waktu[-1]:.2f}')


print(f'skenario {arg.skenario} | pengguna serentak {arg.pengguna} | {lama:.0f} dtk | '
      f'{len(hasil)} permintaan ({len(hasil) / lama:.1f}/dtk)')
for jenis in sorted({j for j, _, _ in hasil}):
    print(f'   {jenis:<16} {ringkas([h for h in hasil if h[0] == jenis])}')
