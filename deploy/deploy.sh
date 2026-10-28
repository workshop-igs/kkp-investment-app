#!/usr/bin/env bash
set -euo pipefail
cd /home/deploy/kkp
for coba in 1 2 3 4 5; do
  GIT_SSH_COMMAND='ssh -o ConnectTimeout=15' git pull --ff-only && break
  [ "$coba" -lt 5 ] || exit 1
  echo "git pull gagal (percobaan $coba), diulang dalam 10 detik"
  sleep 10
done
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
