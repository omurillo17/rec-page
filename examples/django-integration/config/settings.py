"""Minimal Django project showing how to host Seventeen Training Kit content behind Django auth."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-not-secret")  # set a real one in production
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "crm",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": ["django.template.context_processors.request", "django.contrib.auth.context_processors.auth"]},
    }
]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
LANGUAGE_CODE = "es"
TIME_ZONE = "UTC"
USE_TZ = True

STATIC_URL = "static/"
# The kit is ONE static ES module. In your project, copy dist/seventeen-training.js into your
# static folder (or install the npm package and collect it); here we point at the monorepo build.
STATICFILES_DIRS = [("training-kit", REPO_ROOT / "packages" / "web-component" / "dist")]

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "clientes"

# Training content lives OUTSIDE static/ and media/: it is only reachable through views that
# check the session and the user's groups. Never put private training videos in a public folder.
TRAINING_ROOT = Path(os.environ.get("TRAINING_ROOT", BASE_DIR / "training_content"))
# In production let nginx stream files after Django authorizes them (X-Accel-Redirect):
#   location /protected-training/ { internal; alias /srv/app/training_content/; }
TRAINING_X_ACCEL_PREFIX = os.environ.get("TRAINING_X_ACCEL_PREFIX", "")  # e.g. "/protected-training/"
APP_VERSION = "1.2.0"
