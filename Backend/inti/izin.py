from django.core.exceptions import ObjectDoesNotExist
from rest_framework.permissions import BasePermission

LEVEL = {'DASAR': 'Pengguna Dasar', 'PENUH': 'Tim KKP', 'ADMIN': 'Administrator'}


def level(user):
    if user.is_staff:
        return 'ADMIN'
    try:
        return 'PENUH' if user.profil.akses_portofolio else 'DASAR'
    except ObjectDoesNotExist:
        return 'DASAR'


class AksesPortofolio(BasePermission):
    message = 'Dashboard Nasional dan Proyek Investasi memerlukan izin akses dari administrator.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and level(request.user) != 'DASAR')
