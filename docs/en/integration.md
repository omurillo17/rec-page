# Integration

**English** · [Español](../integracion.md)

The kit **does not replace** the app's authentication. The steps are always the same:

1. Publish the app's training folder at a public or protected path.
2. Load `seventeen-training.js` (or the React adapter).
3. Place `<seventeen-training manifest="…" module="…">` in each module.
4. Mark the elements the tours explain with `data-training="…"`.
5. Run `training validate --input <folder>` in CI.

## Plain HTML and JavaScript

Copy `packages/web-component/dist/seventeen-training.js` to the app's static files
(or install `@seventeen-training/web` and serve that file):

```html
<script type="module" src="/vendor/seventeen-training.js"></script>

<div class="page-head">
  <h1>Clientes</h1>
  <seventeen-training manifest="/training/manifest.json" module="clientes" app-version="1.2.0" label="Ayuda del módulo"></seventeen-training>
  <button data-training="client-create">+ Nuevo cliente</button>
</div>

<script type="module">
  // Optional: your own anonymous analytics.
  document.addEventListener('training-tour-end', (e) => console.log(e.detail.completed));
</script>
```

Imperative API, for example, to open the help from your own menu:

```js
const help = document.querySelector('seventeen-training');
help.open();                          // module list
help.openTutorial('registrar-cliente');
help.startTour('registrar-cliente');  // returns a promise with { completed }
```

There is also an element-free API: `import { loadManifest, selectContent, loadTour, startTour } from '/vendor/seventeen-training.js'`.

Full example: [apps/demo-html](../../apps/demo-html).

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

`TrainingHelp` accepts a `ref` for the element (`ref.current.open()`). The Web Component is
downloaded as a separate chunk via `import()` after the first render, so it does not slow down
the app. Full example: [apps/demo-react](../../apps/demo-react).

## Next.js (App Router)

`@seventeen-training/react` ships with `'use client'`. It can be used from a Server Component
as long as you don't pass it functions. On the server it produces an inert `<seventeen-training …>`;
the browser activates it after hydration.

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

Filter the manifest **on the server**, using your auth system's session:

```ts
// app/api/training/manifest/route.ts
import { readFile } from 'node:fs/promises';
import { parseManifest, selectContent } from '@seventeen-training/core';
import { auth } from '@/auth'; // your existing system (NextAuth, Clerk, custom…)

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

For protected content, create `app/api/training/files/[...path]/route.ts`. It must serve only
paths referenced by tutorials or tours visible to the session, with `Range` support (the
equivalent logic is in the Django example). For public content, `public/training/` is
enough.

If you need callbacks (`onTourEnd`), use `TrainingHelp` inside a component marked `'use client'`.

> Verified: server rendering with `react-dom/server` (test `packages/react/test/ssr.test.tsx`)
> and the Vite demo. No Next.js project is included in this repository.

## Django (templates)

```django
{% load static %}
<script type="module" src="{% static 'training-kit/seventeen-training.js' %}"></script>

<seventeen-training manifest="{% url 'training-manifest' %}" module="clientes" app-version="{{ app_version }}"></seventeen-training>
<button data-training="client-create">+ Nuevo cliente</button>
```

The `training-manifest` and `training-file` views use `@login_required`, filter by the user's
actual groups, authorize each file, and support `Range` and `X-Accel-Redirect`.
Full project with tests: [examples/django-integration](../../examples/django-integration).

## Other frameworks (Vue, Angular, Svelte, Blazor, PHP…)

Any framework that can emit HTML can use the Web Component:

- **Vue 3:** mark the tag as a custom element
  (`compilerOptions.isCustomElement = (t) => t === 'seventeen-training'`) and import the script
  in `onMounted`.
- **Angular:** add `CUSTOM_ELEMENTS_SCHEMA` to the component and load the script in `angular.json` (`scripts`).
- **Svelte, Astro, PHP, Rails, Blazor:** use the tag and the `<script type="module">` as-is.

Always pass values as text attributes. Actions are listened to as DOM events.

## Hosting the assets

| Scenario | Where | How |
|---|---|---|
| Non-sensitive content | `public/training/` or `static/training/` | The app's static server. It must support `Range` (Nginx, Apache, Vite, WhiteNoise and CDNs do). |
| Internal or sensitive content | Outside the public folders | An authenticated view that serves only authorized files. In production, delegate file delivery to the web server with `X-Accel-Redirect` (Nginx) or `X-Sendfile` (Apache). |
| Large videos in object storage | Private bucket | The app generates short-lived signed URLs **on the server** when building the manifest. Never store signed URLs in the repository's `manifest.json` (the CLI detects them). |

Nginx with `X-Accel-Redirect`:

```nginx
location /protected-training/ {
  internal;                                  # only reachable after the app authorizes it
  alias /srv/app/training_content/;
}
```

Use the same origin as the app for the manifest and the assets. That way the session cookie
is sent automatically (`credentials: 'same-origin'`) and there is no need for CORS or exposing tokens.
