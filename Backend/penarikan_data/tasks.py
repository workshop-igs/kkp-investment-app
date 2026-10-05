from celery import shared_task


@shared_task
def periksa_statistik_bps():
    from django.core.management import call_command

    call_command('tarik_statistik_bps', jika_jatuh_tempo=True)
    return 'Pemeriksaan statistik BPS selesai.'
