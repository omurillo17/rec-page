# rec-page · Seventeen Training Kit

[English](README.md) · **Español**

Graba videos de tu aplicación web a partir de un guion JSON: el kit abre la app real en Chrome
headless, sigue los pasos (clics, formularios, navegación), toma capturas, mide los elementos a resaltar,
agrega voz, subtítulos y capítulos, y renderiza MP4. Al cambiar la interfaz, `training build` vuelve a
grabar solo lo que cambió.

Sirve para:

- **Capacitación:** botón **Ayuda** en cada módulo con videotutoriales y recorridos interactivos (Driver.js).
- **Demos de venta y presentaciones** de tu producto, siempre al día con la interfaz.
- **Videos de novedades** (qué cambió en esta versión) y **onboarding** de usuarios nuevos.
- **Capturas para documentación**, con las coordenadas de cada elemento medidas.

Con [Claude Code](#plugin-para-claude-code-cualquier-proyecto), un agente prepara una base demo con datos ficticios,
explora la app, escribe los guiones y genera los videos.

- **No es un LMS.** Cada aplicación conserva su autenticación, sus permisos y su contenido
  (manifiesto, recorridos, videos), versionado junto con su código.
- **Un Web Component** (`<seventeen-training>`) funciona en HTML, Django, React/Next.js y en
  cualquier otro framework. El adaptador React solo lo envuelve.
- **Videos generados desde un guion JSON y capturas reales** con Remotion + FFmpeg, sin claves
  ni APIs de pago. Producen MP4, subtítulos WebVTT sincronizados, miniatura y capítulos.
- **CLI** `training` para validar contenido (esquemas, referencias, MP4, WebVTT, secretos)
  y para generar o previsualizar videos.

```html
<script type="module" src="/static/training-kit/seventeen-training.js"></script>
<seventeen-training manifest="/training/manifest.json" module="clientes"></seventeen-training>
```

## Inicio rápido

Requisitos: Node.js ≥ 20 y pnpm 10. Python ≥ 3.10 solo para el ejemplo de Django.
La voz automática usa las voces de Windows (SAPI); en macOS o Linux graba el audio y usa `narration.audio`.

```bash
pnpm install
```

```bash
pnpm test
```

`pnpm test` compila todos los paquetes y ejecuta las pruebas automatizadas.

```bash
pnpm dev:html
```

Abre http://localhost:5173. Pulsa **Ayuda del módulo**, reproduce un video o inicia un recorrido.
La demo con React se inicia con `pnpm dev:react` (http://localhost:5174).

## Estructura

| Ruta | Responsabilidad |
|---|---|
| [packages/content-schema](packages/content-schema) | Esquemas Zod y tipos: manifiesto, recorridos y guion de video. Genera JSON Schema para el editor. |
| [packages/core](packages/core) | Lógica sin DOM: carga y validación del manifiesto, filtrado por módulo/estado/rol, compatibilidad de versión, recomendaciones, parser WebVTT. |
| [packages/web-component](packages/web-component) | `<seventeen-training>`: botón, diálogo, reproductor HTML5 (capítulos, velocidad, transcripción, subtítulos) y recorridos con Driver.js. Un solo archivo ES. |
| [packages/react](packages/react) | `<TrainingHelp>` para React y Next.js (compatible con SSR). |
| [packages/video-renderer](packages/video-renderer) | Plantillas Remotion (intro, demostración, pasos, resultado, errores y cierre) y API de render en Node. |
| [tools/training-cli](tools/training-cli) | `training validate \| list \| render \| preview`. |
| [apps/demo-html](apps/demo-html) | Demo en HTML y JavaScript: módulo Clientes, contenido de capacitación y guiones de video. |
| [apps/demo-react](apps/demo-react) | Demo en React con su propio contenido. |
| [examples/django-integration](examples/django-integration) | Proyecto Django: manifiesto filtrado por grupos y archivos protegidos (con Range y X-Accel-Redirect). |
| [docs](docs) | Arquitectura, contenido, integración, seguridad, videos y actualización. |

No existe `examples/generic-javascript`: [apps/demo-html](apps/demo-html) ya es ese ejemplo.

## Plugin para Claude Code (cualquier proyecto)

`skills/videos-capacitacion/` contiene la skill que aplica este kit a **cualquier app**: monta una base demo
con datos ficticios, explora las pantallas, escribe las lecciones (pasos de captura + escenas) y ejecuta
`training build`.

**Como plugin (cualquier máquina).** Este repo es también un marketplace de Claude Code. En Claude Code:

```
/plugin install rec-page --marketplace omurillo17/rec-page
```

La primera vez que se use, la skill compila el kit (`pnpm install && pnpm build`) dentro de la carpeta
del plugin.

**Desde este checkout.** Copia la skill a tu carpeta de skills de usuario (vuelve a ejecutarlo tras actualizar):

```bash
pnpm skills:install
```

Luego, en cualquier proyecto, pide en Claude Code: *"genera los videos de capacitación de esta app"*.
Con otros agentes (por ejemplo Antigravity), indícales que sigan `skills/videos-capacitacion/SKILL.md`.

## Documentación

1. [Arquitectura y contratos](docs/arquitectura.md)
2. [Formato del contenido](docs/contenido.md): manifiesto, recorridos y guiones
3. [Integración](docs/integracion.md): Next.js, React, Django, HTML y otros frameworks
4. [Seguridad](docs/seguridad.md)
5. [Generación de videos](docs/videos.md): requisitos y licencias
6. [Actualización sin romper aplicaciones](docs/actualizacion.md)

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm build` | Compila paquetes y CLI. |
| `pnpm test` | Compila y ejecuta las pruebas (Vitest). |
| `pnpm typecheck` | Verifica los tipos de todos los paquetes. |
| `pnpm training validate --input apps/demo-html/public/training` | Valida el contenido de una aplicación. |
| `pnpm training list --input apps/demo-html/public/training` | Lista módulos, tutoriales y recorridos. |
| `pnpm training render --input <guion.json> --out <carpeta>` | Genera MP4, VTT y JPG. |
| `pnpm training preview --input <guion.json>` | Abre Remotion Studio con el guion. |
| `pnpm training narrate --input <guion.json>` | Voz local de Windows (solo escenas con texto nuevo). |
| `pnpm training build --input <carpeta>` | **Pipeline completo e incremental**: servidor demo, capturas, voz, render y archivo de datos para la app. Ver [docs/videos.md](docs/videos.md). |
| `pnpm --filter demo-html capture` | Toma capturas reales de la demo en ejecución, con coordenadas medidas. |

## Licencia

[MIT](LICENSE) © Seventeen Corp.

Dependencias con licencia propia, que solo afectan a quien **genera** videos (el componente que llega al
navegador solo incluye Zod y Driver.js, ambos MIT):

- **Remotion** es *source-available*: gratis para personas, organizaciones sin fines de lucro y empresas de
  hasta 3 empleados. Una empresa más grande necesita una Company License ([remotion.dev/license](https://www.remotion.dev/license)).
- **FFmpeg**, incluido por Remotion, es GPL. Usarlo para producir videos no obliga a nada; no redistribuyas
  `node_modules` en instaladores.

Detalle en [docs/videos.md](docs/videos.md).



## Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md). Se aceptan issues y pull requests en español o inglés.
