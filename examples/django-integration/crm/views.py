from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def clientes(request):
    return render(request, "crm/clientes.html", {"app_version": settings.APP_VERSION})
