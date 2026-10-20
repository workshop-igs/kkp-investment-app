#!/usr/bin/env bash
set -euo pipefail
cd /home/deploy/kkp
git pull --ff-only
cd Backend
source venv_django/bin/activate
pip install -q -r requirements.lock.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
cd ../Frontend
npm ci --silent
npm run build
sudo systemctl restart kkp-gunicorn kkp-asisten kkp-celery kkp-celerybeat
echo "Deploy selesai: $(git rev-parse --short HEAD)"
