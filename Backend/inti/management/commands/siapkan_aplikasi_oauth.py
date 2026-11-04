from django.core.management.base import BaseCommand
from oauth2_provider.models import get_application_model

NAMA_APLIKASI = 'KKP Investment Dashboard (SPA)'


class Command(BaseCommand):
    help = 'Daftarkan/segarkan OAuth2 Application untuk dashboard SPA.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--rotate',
            action='store_true',
            help='Terbitkan ulang client_id. Semua sesi frontend yang berjalan akan perlu login ulang.',
        )

    def handle(self, *args, **options):
        Application = get_application_model()

        aplikasi = Application.objects.filter(name=NAMA_APLIKASI).first()

        if aplikasi and options['rotate']:
            aplikasi.delete()
            self.stdout.write(self.style.WARNING('client_id lama dicabut.'))
            aplikasi = None

        if aplikasi is None:
            aplikasi = Application.objects.create(
                name=NAMA_APLIKASI,
                client_type=Application.CLIENT_PUBLIC,
                authorization_grant_type=Application.GRANT_PASSWORD,
                client_secret='',
                skip_authorization=True,
            )
            self.stdout.write(self.style.SUCCESS(f'Application "{NAMA_APLIKASI}" dibuat.'))
        else:
            berubah = False
            if aplikasi.client_type != Application.CLIENT_PUBLIC:
                aplikasi.client_type = Application.CLIENT_PUBLIC
                berubah = True
            if aplikasi.authorization_grant_type != Application.GRANT_PASSWORD:
                aplikasi.authorization_grant_type = Application.GRANT_PASSWORD
                berubah = True
            if berubah:
                aplikasi.save()
                self.stdout.write(self.style.WARNING('Konfigurasi aplikasi dikoreksi.'))
            else:
                self.stdout.write(f'Application "{NAMA_APLIKASI}" sudah ada.')

        self.stdout.write('')
        self.stdout.write(f'  client_id : {aplikasi.client_id}')
        self.stdout.write('  client_type : public (tanpa secret)')
        self.stdout.write('  grant : password')
        self.stdout.write('')
        self.stdout.write(
            'Frontend mengambil client_id ini otomatis dari GET /api/v1/core/auth/config/ '
            '— tidak perlu disalin manual.'
        )
