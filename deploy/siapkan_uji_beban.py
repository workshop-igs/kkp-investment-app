import json
import secrets
import sys
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from oauth2_provider.models import AccessToken, Application

from analitik.models import LokasiPotensial
from inti.models import ProfilPengguna, Provinsi

AWALAN = 'uji_beban_'
mode = sys.argv[-1] if sys.argv[-1] in ('buat', 'hapus') else 'buat'

if mode == 'hapus':
    print('akun uji dihapus:', User.objects.filter(username__startswith=AWALAN).delete()[0])
else:
    jumlah = 60
    token = []
    aplikasi = Application.objects.first()
    for n in range(jumlah):
        u, _ = User.objects.get_or_create(username=f'{AWALAN}{n}', defaults={'email': f'{AWALAN}{n}@contoh.invalid'})
        ProfilPengguna.objects.update_or_create(user=u, defaults={'akses_portofolio': True})
        token.append(AccessToken.objects.create(
            user=u, token=f'ub-{secrets.token_urlsafe(24)}', application=aplikasi,
            expires=timezone.now() + timedelta(hours=2), scope='read write').token)
    area = [
        {'geometry': json.loads(lok.geometry.geojson), 'sektor': lok.sektor.kode,
         'sub_sektor': lok.rincian.get('sub_sektor_kode')}
        for lok in LokasiPotensial.objects.filter(tampil=True).exclude(sektor=None).select_related('sektor').order_by('?')[:40]
    ]
    kotak = [list(p.geometry.extent) for p in Provinsi.objects.exclude(geometry=None).only('geometry')]
    provinsi = list(Provinsi.objects.values_list('id', flat=True))
    with open('/tmp/uji_beban_data.json', 'w') as f:
        json.dump({'token': token, 'area': area, 'kotak': kotak, 'provinsi': provinsi}, f)
    print(f'{jumlah} akun uji, {len(area)} contoh area, {len(kotak)} kotak provinsi -> /tmp/uji_beban_data.json')
