import glob
import json
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-dev-only-change-in-production')
DEBUG = os.getenv('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

try:
    site_packages = BASE_DIR / 'venv_django' / 'Lib' / 'site-packages'
    gdal_dll = glob.glob(str(site_packages / 'fiona.libs' / 'gdal*.dll'))[0]
    geos_dll = glob.glob(str(site_packages / 'fiona.libs' / 'geos_c*.dll'))[0]

    GDAL_LIBRARY_PATH = gdal_dll
    GEOS_LIBRARY_PATH = geos_dll
except IndexError:
    pass

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',
    'rest_framework',
    'rest_framework_gis',
    'corsheaders',
    'django_filters',
    'oauth2_provider',
    'django_celery_beat',
    'inti',
    'inventarisasi',
    'analitik',
    'ketenagakerjaan',
    'pipeline',
    'penarikan_data',
    'integrasi',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'oauth2_provider.middleware.OAuth2TokenMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'inti.audit.JejakAktivitasMiddleware',
]

ROOT_URLCONF = 'kkp_investasi.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'kkp_investasi.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': os.getenv('DB_NAME', 'kkp_investasi'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'CONN_MAX_AGE': 600,
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {
            'connect_timeout': 10,
        },
    }
}

BPS_API_KEY = os.getenv('BPS_API_KEY', '')

CACHE_URL = os.getenv('CACHE_URL', '')
if CACHE_URL:
    CACHES = {
        'default': {
            'BACKEND': 'inti.cache.RedisTahanGagal',
            'LOCATION': CACHE_URL,
            'OPTIONS': {
                'socket_connect_timeout': 0.2,
                'socket_timeout': 1.0,
            },
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'rlaut-cache',
            'OPTIONS': {'MAX_ENTRIES': 2000},
        }
    }

CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Jakarta'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'id'
TIME_ZONE = 'Asia/Jakarta'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = [
        'https://investasi-ruanglaut.kkp.go.id',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'oauth2_provider.contrib.rest_framework.OAuth2Authentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.getenv('THROTTLE_ANON', '1200/hour'),
        'user': os.getenv('THROTTLE_USER', '6000/hour'),
        'peta': os.getenv('THROTTLE_PETA', '6000/hour'),
        'asisten': os.getenv('THROTTLE_ASISTEN', '120/hour'),
    },
    'DEFAULT_RENDERER_CLASSES': (
        [
            'rest_framework.renderers.JSONRenderer',
            'rest_framework.renderers.BrowsableAPIRenderer',
        ]
        if DEBUG
        else ['rest_framework.renderers.JSONRenderer']
    ),
}

OAUTH2_PROVIDER = {
    'SCOPES': {
        'read': 'Read scope',
        'write': 'Write scope',
        'admin': 'Admin scope',
    },
    'DEFAULT_SCOPES': ['read', 'write'],
    'ACCESS_TOKEN_EXPIRE_SECONDS': 3600,
    'REFRESH_TOKEN_EXPIRE_SECONDS': 86400,
    'OAUTH2_VALIDATOR_CLASS': 'kkp_investasi.validator_oauth.EmailOrUsernameOAuth2Validator',
    'ROTATE_REFRESH_TOKEN': True,
    'REFRESH_TOKEN_GRACE_PERIOD_SECONDS': 60,
}

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

FIELD_ENCRYPTION_KEY = os.getenv('FIELD_ENCRYPTION_KEY', '')

SRGI_2013_SRID = 9779

DEFAULT_SRID = 4326

DATA_DIR = BASE_DIR / 'data'
EXPORT_DIR = BASE_DIR / 'exports'

TINGKAT_LOG = os.getenv('DJANGO_LOG_LEVEL', 'DEBUG' if DEBUG else 'INFO')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'colored': {
            'format': '\033[90m{asctime}\033[0m {levelname} \033[36m{module}\033[0m {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'colored' if DEBUG else 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'rlaut.log',
            'formatter': 'verbose',
            'encoding': 'utf-8',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'inti': {
            'handlers': ['console', 'file'],
            'level': TINGKAT_LOG,
            'propagate': False,
        },
        'analitik': {
            'handlers': ['console', 'file'],
            'level': TINGKAT_LOG,
            'propagate': False,
        },
        'inventarisasi': {
            'handlers': ['console', 'file'],
            'level': TINGKAT_LOG,
            'propagate': False,
        },
        'ketenagakerjaan': {
            'handlers': ['console', 'file'],
            'level': TINGKAT_LOG,
            'propagate': False,
        },
        'pipeline': {
            'handlers': ['console', 'file'],
            'level': TINGKAT_LOG,
            'propagate': False,
        },
        'penarikan_data': {
            'handlers': ['console', 'file'],
            'level': TINGKAT_LOG,
            'propagate': False,
        },
        'integrasi': {
            'handlers': ['console', 'file'],
            'level': TINGKAT_LOG,
            'propagate': False,
        },
    },
}

ASISTEN_LLM_URL = os.getenv('ASISTEN_LLM_URL', '')
ASISTEN_LLM_MODEL = os.getenv('ASISTEN_LLM_MODEL', '')
ASISTEN_LLM_KUNCI = os.getenv('ASISTEN_LLM_KUNCI', '')
ASISTEN_LLM_TIMEOUT = float(os.getenv('ASISTEN_LLM_TIMEOUT', '120'))
ASISTEN_LLM_EKSTRA = json.loads(os.getenv('ASISTEN_LLM_EKSTRA') or '{}')
ASISTEN_BATAS_HASIL = int(os.getenv('ASISTEN_BATAS_HASIL', '12000'))
