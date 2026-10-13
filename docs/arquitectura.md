# Arquitectura

## Principios aplicados

| Principio | Cómo se cumple |
|---|---|
| Cada app conserva su autenticación y autorización | El kit no tiene login, usuarios ni roles propios. Carga el manifiesto con `credentials: 'same-origin'`: la cookie de sesión de la app viaja sola y el kit nunca ve tokens. |
| Contenido y multimedia por app | Cada app tiene su carpeta (por ejemplo, `public/training/` o `training_content/`) con `manifest.json`, `tours/` y `videos/`. Se versiona en el repositorio de la app. |
| Sin dependencias entre apps ni bases de datos | El kit no tiene backend ni base de datos. Solo lee archivos JSON y multimedia desde URLs que cada app elige. |
| El motor no accede a datos empresariales | El kit solo lee el manifiesto, los recorridos y la multimedia. Los recorridos resaltan elementos por selector; no leen valores ni envían formularios. |
| Integración opcional y no bloqueante | Es un `<script type="module">` diferido. El manifiesto se descarga al abrir la ayuda. Un error muestra un aviso dentro del diálogo y emite `training-error`; nunca lanza excepciones hacia la app. |
| Sin infraestructura nueva | El MVP no agrega servicios, colas ni almacenamiento. Remotion solo se usa en la máquina que genera videos. |

## Paquetes y dependencias

```
content-schema  (zod)
      ▲
     core  ──────────────────────────────┐
      ▲                                  │
 web-component (driver.js) ◄── react     video-renderer (remotion) ◄── training-cli
```

- `core` no depende del DOM, React, Next.js ni Django. Funciona en el navegador y en Node
  (por ejemplo, para filtrar el manifiesto en una ruta de Next.js).
- `web-component` se publica como **un solo archivo ES** (`dist/seventeen-training.js`,
  ~143 KB, 41 KB gzip). Incluye core, zod y driver.js. Se usa con una etiqueta `<script>`.
- `react` carga el Web Component con `import()` dentro de `useEffect`. En el servidor
  solo produce la etiqueta HTML.
- `video-renderer` y `training-cli` solo se ejecutan en Node, en la máquina de quien produce
  contenido o en CI. Nunca llegan al navegador.

## Contratos

### 1. Manifiesto (`manifest.json`)

Describe el contenido de una app: módulos, tutoriales, referencias a recorridos, estados,
roles informativos y rango de versiones de UI. Lo valida `ManifestSchema`. El formato está
en [contenido.md](contenido.md).

### 2. Web Component

| Atributo | Uso |
|---|---|
| `manifest` | URL del manifiesto (obligatorio). Puede ser una ruta protegida por la app. |
| `module` | Id del módulo que se muestra. |
| `app-version` | Versión de la UI anfitriona. Fuera de `manifest.ui`, los recorridos se desactivan y los videos siguen disponibles. |
| `roles` | Roles separados por coma. Solo filtran la interfaz y **no** son un control de seguridad. |
| `include-drafts` | Muestra contenido `draft` o `review`. Úsalo solo en entornos de autoría. |
| `label` | Texto del botón. |

Métodos: `open()`, `close()`, `openTutorial(id)`, `startTour(id)` y `reload()`.

Eventos (`bubbles` y `composed`): `training-open`, `training-close`, `training-video-play`,
`training-tour-start`, `training-tour-end` (`{ tourId, completed, invalidSteps }`) y
`training-error` (`{ message }`). No incluyen datos del usuario.

Tema: variables CSS en el host, por ejemplo,
`seventeen-training { --st-primary: #0f766e; }`, y `::part(button)` y `::part(dialog)`.

### 3. Recorridos

Cada archivo JSON se valida con `TourSchema` antes de ejecutarse. Cada paso se traduce
1:1 a un `DriveStep` de Driver.js 1.9:

| Esquema | Driver.js |
|---|---|
| `element` | `element`: selector CSS; si falta, el popover se centra. |
| `title`, `description`, `side`, `align` | `popover.*` |
| `optional: true` | `skipMissingElement: true`: el paso se omite si el elemento no existe. |
| `waitForMs` | `waitForElement`: espera con MutationObserver (páginas dinámicas). |

Antes de iniciar, el kit descarta los selectores con sintaxis inválida y los informa en
`invalidSteps`. Si un elemento obligatorio no aparece tras la espera, el popover se centra
con un aviso. El esquema no tiene campos de acción: un recorrido **no puede** hacer clic,
escribir ni enviar formularios.

### 4. Guion de video

Lo valida `VideoScriptSchema`. Contiene escenas con plantilla (`intro`, `demo`, `steps`,
`result` y `outro`), duración, narración opcional y capturas reales. El renderer recibe el
guion y la carpeta del guion como `publicDir`. Ver [videos.md](videos.md).

## Flujo en tiempo de ejecución

1. La página carga `seventeen-training.js` de forma diferida. El elemento muestra solo el botón.
2. Al pulsar el botón, el kit descarga el manifiesto con la cookie de la app y lo valida con Zod.
3. `selectContent` filtra por módulo, estado, roles (solo UX) y versión de UI.
4. El reproductor usa `<video>` nativo y `<track>` WebVTT. La transcripción se genera con el
   mismo archivo VTT, por lo que subtítulos y transcripción siempre coinciden.
5. El recorrido descarga su JSON, lo valida, cierra el diálogo y ejecuta Driver.js.

## Decisiones

- **Reproductor nativo y no Video.js.** El navegador ya ofrece MP4, `<track>`, velocidad,
  pantalla completa y teclado. Lo que falta (capítulos, transcripción, selector de velocidad
  visible y recomendaciones) son ~100 líneas. Video.js agregaría un paquete más grande que todo
  el kit sin cubrir nada más del MVP. Reevalúalo si se necesita HLS o DASH, analítica de reproducción o anuncios.
- **Shadow DOM** para que los estilos del kit y de la app no se mezclen. Los popovers de
  Driver.js viven en el documento, porque resaltan elementos de la app.
- **Sin estado persistente.** El kit no guarda progreso ni datos personales. Si una app
  necesita progreso, puede escuchar `training-tour-end` y guardarlo en su propio backend.
