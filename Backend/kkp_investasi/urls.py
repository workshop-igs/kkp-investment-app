from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('o/', include('oauth2_provider.urls', namespace='oauth2_provider')),
    path('api/v1/inti/', include('inti.urls')),
    path('api/v1/inventarisasi/', include('inventarisasi.urls')),
    path('api/v1/analitik/', include('analitik.urls')),
    path('api/v1/ketenagakerjaan/', include('ketenagakerjaan.urls')),
    path('api/v1/pipeline/', include('pipeline.urls')),
    path('api/v1/integrasi/', include('integrasi.urls')),
]
