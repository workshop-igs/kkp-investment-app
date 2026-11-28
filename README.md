# KKP Investment App

Platform Manajemen Investasi Ruang Laut — WebGIS untuk analisis kesesuaian lokasi, sebaran wilayah potensial, dan profil investasi kelautan per provinsi.

## Stack

- **Backend**: Python 3.13, Django 5.2, Django REST Framework, GeoDjango, Celery + Redis
- **Basis data**: PostgreSQL 18 + PostGIS (termasuk `postgis_raster`)
- **Frontend**: React 18, Vite, Leaflet, Tailwind CSS
- **Layanan peta**: MapServer (WMS/WFS/WCS di `/ows`)

## Struktur

```
Backend/
  kkp_investasi/    settings, urls, celery
  inti/             wilayah, akun, autentikasi, layanan peta
  inventarisasi/    tata ruang, KKPRL, infrastruktur, ekosistem
  analitik/         screening, skor zona, Peta Sebaran, profil investasi
  pipeline/         proyek investasi
  ketenagakerjaan/  statistik BPS
  penarikan_data/   jadwal dan log penarikan data
  integrasi/        sumber data eksternal
Frontend/
  src/pages/        halaman
  src/components/   komponen peta, laporan, admin
  src/utils/        PDF dan format
deploy/             systemd, nginx, deploy.sh, uji beban
```

## Menjalankan di lokal

Butuh PostgreSQL + PostGIS, Redis, GDAL, Python 3.13, dan Node.js 22.

```bash
cd Backend
python -m venv venv_django
source venv_django/bin/activate
pip install -r requirements.lock.txt
cp .env.example .env            # isi DB_*, DJANGO_SECRET_KEY
python manage.py migrate
python manage.py siapkan_data_awal
python manage.py siapkan_aplikasi_oauth
python manage.py runserver
```

Worker latar (terminal terpisah):

```bash
celery -A kkp_investasi worker -l info
celery -A kkp_investasi beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

Frontend:

```bash
cd Frontend
npm ci
npm run dev                     # /api dan /o diteruskan ke 127.0.0.1:8000
```

Data spasial bisa diisi dengan memulihkan salinan basis data yang diserahkan, atau ditarik ulang dengan perintah `manage.py tarik_*`.

## Produksi

Langkah lengkap ada di dokumen Panduan Setup Produksi. Contoh konfigurasi systemd dan nginx ada di folder `deploy/`; `deploy/deploy.sh` dipakai untuk pembaruan (pull, migrate, build, restart).
