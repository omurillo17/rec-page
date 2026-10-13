# Integración con Django

Proyecto Django mínimo que integra el kit **sin tocar la autenticación**: usa `django.contrib.auth`,
los grupos de Django y vistas protegidas.

| Archivo | Qué muestra |
|---|---|
| `crm/templates/crm/clientes.html` | El botón de ayuda en un template: `<script type="module">` y `<seventeen-training manifest="{% url 'training-manifest' %}" module="clientes">`. |
| `crm/training_views.py` | `manifest`: `@login_required`, filtra tutoriales y recorridos con los **grupos reales** del usuario y responde con `Cache-Control: private, no-store`. `training_file`: sirve solo archivos referenciados por contenido visible para ese usuario, evita path traversal, admite `Range` (seek del video) y `X-Accel-Redirect` en producción. |
| `training_content/` | Contenido de esta app, **fuera** de `static/`: manifiesto (con `buscar-cliente` restringido al grupo `supervisores`), recorridos y videos. |
| `crm/tests.py` | 7 pruebas: login obligatorio, filtro por grupos, 404 para archivos restringidos o no referenciados, path traversal, Range 206/416 y WebVTT. |
| `config/settings.py` | `TRAINING_ROOT`, `TRAINING_X_ACCEL_PREFIX` y `STATICFILES_DIRS` con el archivo del kit. |

## Ejecutar

Desde la raíz del monorepo, compila el kit una vez con `pnpm install` y `pnpm build`. Luego:

```bash
cd examples/django-integration
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py createsuperuser
.venv/Scripts/python manage.py runserver
```

En Linux o macOS, usa `.venv/bin/python`. Abre http://127.0.0.1:8000 e inicia sesión. Para ver
el contenido restringido, crea el grupo `supervisores` en el admin o la shell y agrega al usuario.

Pruebas:

```bash
.venv/Scripts/python manage.py test crm
```

## En tu proyecto

1. Copia `packages/web-component/dist/seventeen-training.js` a tus archivos estáticos
   (por ejemplo, `static/training-kit/`).
2. Copia `crm/training_views.py` y sus dos rutas. Ajusta `_roles(user)` a tu modelo de
   permisos (grupos, permisos de Django o tu propio esquema).
3. Pon tu contenido en una carpeta fuera de `static/` y `media/`, y define `TRAINING_ROOT`.
4. En producción, configura Nginx y `TRAINING_X_ACCEL_PREFIX` para que Django solo autorice y
   Nginx envíe los archivos:

   ```nginx
   location /protected-training/ {
     internal;
     alias /srv/app/training_content/;
   }
   ```

5. Agrega `training validate --input training_content` a tu CI.

> `FileResponse` de Django no admite `Range`; por eso la vista lo implementa para desarrollo.
> En producción, Nginx lo hace solo con `X-Accel-Redirect`.
