from django.urls import include, path
from oauth2_provider.urls import base_urlpatterns

urlpatterns = [
    path('o/', include((base_urlpatterns, 'oauth2_provider'), namespace='oauth2_provider')),
    path('api/v1/inti/', include('inti.urls')),
    path('api/v1/inventarisasi/', include('inventarisasi.urls')),
    path('api/v1/analitik/', include('analitik.urls')),
    path('api/v1/ketenagakerjaan/', include('ketenagakerjaan.urls')),
    path('api/v1/pipeline/', include('pipeline.urls')),
    path('api/v1/integrasi/', include('integrasi.urls')),
]
