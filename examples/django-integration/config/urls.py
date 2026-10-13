from django.contrib.auth import views as auth_views
from django.urls import path

from crm import training_views, views

urlpatterns = [
    path("", views.clientes, name="clientes"),
    path("login/", auth_views.LoginView.as_view(), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("training/manifest.json", training_views.manifest, name="training-manifest"),
    path("training/files/<path:path>", training_views.training_file, name="training-file"),
]
