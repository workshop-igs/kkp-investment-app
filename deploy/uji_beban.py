import argparse
import random
import statistics
import threading
import time
import urllib.error
import urllib.request

parser = argparse.ArgumentParser(description='Uji beban unduhan PDF Profil Investasi (bagian server: data profil).')
parser.add_argument('--alamat', default='http://127.0.0.1:8001')
parser.add_argument('--domain', default='', help='nama domain situs (header Host) bila --alamat langsung ke gunicorn')
parser.add_argument('--pengguna', type=int, default=50)
parser.add_argument('--detik', type=int, default=60)
parser.add_argument('--provinsi', default='', help='daftar id provinsi dipisah koma; kosong = ambil dari API')
parser.add_argument('--jenis', default='PERIKANAN_TANGKAP,PERIKANAN_BUDIDAYA,PARIWISATA_BAHARI,GARAM')
arg = parser.parse_args()


KEPALA = {'X-Forwarded-Proto': 'https', **({'Host': arg.domain} if arg.domain else {})}


def minta(jalur, ip):
    req = urllib.request.Request(arg.alamat + jalur, headers={**KEPALA, 'X-Forwarded-For': ip, 'Accept-Encoding': 'gzip'})
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


if arg.provinsi:
    provinsi = arg.provinsi.split(',')
else:
    import json
    with urllib.request.urlopen(urllib.request.Request(arg.alamat + '/api/v1/inti/provinsi/?page_size=100', headers=KEPALA)) as r:
        isi = json.loads(r.read())
    provinsi = [str(p['id']) for p in (isi['results'] if isinstance(isi, dict) else isi)]
jenis = [j for j in arg.jenis.split(',') if j]

hasil = []
kunci = threading.Lock()
selesai_pada = time.time() + arg.detik


def pengguna(n):
    ip = f'10.{n // 65536 % 256}.{n // 256 % 256}.{n % 256}'
    while time.time() < selesai_pada:
        p = random.choice(provinsi)
        jalur = f'/api/v1/inti/provinsi/{p}/profil-investasi/'
        if jenis and random.random() < 0.3:
            jalur += f'?jenis={random.choice(jenis)}'
        kode, durasi = minta(jalur, ip)
        with kunci:
            hasil.append((kode, durasi))
        time.sleep(random.uniform(0.5, 2.0))


utas = [threading.Thread(target=pengguna, args=(i + 1,)) for i in range(arg.pengguna)]
t0 = time.time()
for u in utas:
    u.start()
    time.sleep(0.02)
for u in utas:
    u.join()
lama = time.time() - t0

waktu = sorted(d for k, d in hasil if k == 200)
gagal = {}
for k, _ in hasil:
    if k != 200:
        gagal[k] = gagal.get(k, 0) + 1


def persentil(p):
    return waktu[min(len(waktu) - 1, int(len(waktu) * p))] if waktu else float('nan')


print(f'pengguna serentak {arg.pengguna} | durasi {lama:.0f} dtk | permintaan {len(hasil)} | '
      f'berhasil {len(waktu)} | gagal {sum(gagal.values())} {gagal or ""}')
if waktu:
    print(f'throughput {len(waktu) / lama:.1f} permintaan/dtk | waktu tanggap median {statistics.median(waktu):.2f} dtk | '
          f'p90 {persentil(0.9):.2f} | p99 {persentil(0.99):.2f} | maks {waktu[-1]:.2f}')
