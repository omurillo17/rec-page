# Integración
[English](en/integration.md) · **Español**

El kit **no sustituye** la autenticación de la app. Los pasos son siempre los mismos:

1. Publica la carpeta de capacitación de la app en una ruta pública o protegida.
2. Carga `seventeen-training.js` (o el adaptador React).
3. Coloca `<seventeen-training manifest="…" module="…">` en cada módulo.
4. Marca los elementos que explican los recorridos con `data-training="…"`.
5. Ejecuta `training validate --input <carpeta>` en CI.

## HTML y JavaScript tradicional

Copia `packages/web-component/dist/seventeen-training.js` a los archivos estáticos de la app
(o instala `@seventeen-training/web` y sirve ese archivo):

```html
<script type="module" src="/vendor/seventeen-training.js"></script>

<div class="page-head">
  <h1>Clientes</h1>
  <seventeen-training manifest="/training/manifest.json" module="clientes" app-version="1.2.0" label="Ayuda del módulo"></seventeen-training>
  <button data-training="client-create">+ Nuevo cliente</button>
</div>

<script type="module">
  // Opcional: analítica propia y anónima.
  document.addEventListener('training-tour-end', (e) => console.log(e.detail.completed));
</script>
```

API imperativa, por ejemplo, para abrir la ayuda desde un menú propio:

```js
const help = document.querySelector('seventeen-training');
help.open();                          // lista del módulo
help.openTutorial('registrar-cliente');
help.startTour('registrar-cliente');  // devuelve una promesa con { completed }
```

También existe una API sin elemento: `import { loadManifest, selectContent, loadTour, startTour } from '/vendor/seventeen-training.js'`.

Ejemplo completo: [apps/demo-html](../apps/demo-html).

## React

```bash
pnpm add @seventeen-training/react
```

```tsx
import { TrainingHelp } from '@seventeen-training/react';

export function ClientesHeader() {
  return (
    <div className="page-head">
      <h1>Clientes</h1>
      <TrainingHelp
        manifest="/training/manifest.json"
        module="clientes"
        appVersion={import.meta.env.VITE_APP_VERSION}
        label="Ayuda del módulo"
        onTourEnd={(r) => console.log(r.completed)}
      />
      <button data-training="client-create">+ Nuevo cliente</button>
    </div>
  );
}
```

`TrainingHelp` acepta `ref` para el elemento (`ref.current.open()`). El Web Component se
descarga como chunk aparte con `import()` después del primer render, por lo que no retrasa
la app. Ejemplo completo: [apps/demo-react](../apps/demo-react).

## Next.js (App Router)

`@seventeen-training/react` lleva `'use client'`. Se puede usar desde un Server Component
siempre que no le pases funciones. En el servidor produce `<seventeen-training …>` inerte; el
navegador lo activa después de la hidratación.

```tsx
// app/clientes/page.tsx (Server Component)
import { TrainingHelp } from '@seventeen-training/react';

export default function ClientesPage() {
  return (
    <header>
      <h1>Clientes</h1>
      <TrainingHelp manifest="/api/training/manifest" module="clientes" appVersion={process.env.APP_VERSION} />
    </header>
  );
}
```

Filtra el manifiesto **en el servidor**, con la sesión de tu sistema de auth:

```ts
// app/api/training/manifest/route.ts
import { readFile } from 'node:fs/promises';
import { parseManifest, selectContent } from '@seventeen-training/core';
import { auth } from '@/auth'; // tu sistema actual (NextAuth, Clerk, propio…)

export async function GET() {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  const manifest = parseManifest(JSON.parse(await readFile('training/manifest.json', 'utf8')));
  const { tutorials, tours } = selectContent(manifest, { roles: session.user.roles });
  return Response.json(
    { ...manifest, tutorials, tours, assetsBase: '/api/training/files/' },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
```

Para contenido protegido, guarda los archivos **fuera de `public/`** (por ejemplo en `training/`) y
sírvelos con `serveTrainingFile` (`@seventeen-training/core/server`). Esta función admite `Range`
(para adelantar el video) y devuelve 404 a rutas fuera de la carpeta (`..`, rutas absolutas,
enlaces simbólicos) y a tipos de archivo desconocidos. **No autentica**: revisa la sesión antes.

```ts
// app/api/training/files/[...path]/route.ts
import { serveTrainingFile } from '@seventeen-training/core/server';
import { auth } from '@/auth';

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await auth())) return new Response(null, { status: 401 });
  return serveTrainingFile(request, 'training', (await params).path);
}
```

Si algunos videos son solo para ciertos roles, antes de servir comprueba que la ruta pertenezca a
un tutorial visible para la sesión (`selectContent`), como hace el ejemplo de Django.
Con `training build`, apunta `outDir` a esa carpeta y `publicPath` a `/api/training/files/…`.
Para contenido público, basta con `public/training/`.

Si necesitas callbacks (`onTourEnd`), usa `TrainingHelp` dentro de un componente con `'use client'`.

> Verificado: render en servidor con `react-dom/server` (prueba `packages/react/test/ssr.test.tsx`)
> y la demo de Vite. No se incluyó un proyecto Next.js en este repositorio.

## Django (templates)

```django
{% load static %}
<script type="module" src="{% static 'training-kit/seventeen-training.js' %}"></script>

<seventeen-training manifest="{% url 'training-manifest' %}" module="clientes" app-version="{{ app_version }}"></seventeen-training>
<button data-training="client-create">+ Nuevo cliente</button>
```

Las vistas `training-manifest` y `training-file` usan `@login_required`, filtran por los
grupos reales del usuario, autorizan cada archivo y admiten `Range` y `X-Accel-Redirect`.
Proyecto completo y con pruebas: [examples/django-integration](../examples/django-integration).

## Otros frameworks (Vue, Angular, Svelte, Blazor, PHP…)

Cualquier framework que pueda emitir HTML puede usar el Web Component:

- **Vue 3:** marca la etiqueta como elemento personalizado
  (`compilerOptions.isCustomElement = (t) => t === 'seventeen-training'`) e importa el script
  en `onMounted`.
- **Angular:** agrega `CUSTOM_ELEMENTS_SCHEMA` al componente y carga el script en `angular.json` (`scripts`).
- **Svelte, Astro, PHP, Rails, Blazor:** usa la etiqueta y el `<script type="module">` tal cual.

Pasa siempre los valores como atributos de texto. Las acciones se escuchan como eventos DOM.

## Alojamiento de los recursos

| Escenario | Dónde | Cómo |
|---|---|---|
| Contenido no sensible | `public/training/` o `static/training/` | Servidor estático de la app. Debe admitir `Range` (Nginx, Apache, Vite, WhiteNoise y los CDN lo hacen). |
| Contenido interno o sensible | Fuera de las carpetas públicas | Vista autenticada que sirve solo los archivos autorizados. En producción, delega el envío al servidor web con `X-Accel-Redirect` (Nginx) o `X-Sendfile` (Apache). |
| Videos pesados en almacenamiento de objetos | Bucket privado | La app genera URLs firmadas **en el servidor**, con vida corta, al construir el manifiesto. Nunca guardes URLs firmadas en `manifest.json` del repositorio (la CLI lo detecta). |

Nginx con `X-Accel-Redirect`:

```nginx
location /protected-training/ {
  internal;                                  # solo accesible tras autorización de la app
  alias /srv/app/training_content/;
}
```

Usa el mismo origen que la app para el manifiesto y los recursos. Así la cookie de sesión
se envía sola (`credentials: 'same-origin'`) y no hace falta CORS ni exponer tokens.
