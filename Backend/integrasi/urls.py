from django.urls import path

from .views import status_integrasi

urlpatterns = [
    path('status/', status_integrasi, name='status-integrasi'),
]
