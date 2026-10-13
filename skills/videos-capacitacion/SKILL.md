---
name: videos-capacitacion
description: Genera videotutoriales de capacitación (MP4 con voz, subtítulos, capítulos y resaltados) de cualquier aplicación web a partir de capturas reales tomadas sobre datos ficticios, usando el Seventeen Training Kit. Úsala cuando el usuario pida "videos de capacitación", "tutoriales en video", "videos de ayuda" o actualizar los videos de una app tras cambios de interfaz.
---

# Videos de capacitación para una app web

Produce videos de capacitación de una aplicación con el **Seventeen Training Kit** (CLI `training`).
El kit captura la app real en Chrome headless, genera la voz y renderiza con Remotion.
Tu trabajo es preparar la app para eso y escribir las lecciones.

**Ubicar el kit (`<KIT>`):** es la carpeta dos niveles arriba de este skill (la que tiene
`pnpm-workspace.yaml`). Si ahí no está, lee la ruta del archivo `kit-path` junto a este `SKILL.md`.
Si falta `<KIT>/tools/training-cli/dist/cli.js`, compila una vez: `pnpm install --frozen-lockfile && pnpm build` en `<KIT>`.
Abajo, `training` = `node <KIT>/tools/training-cli/dist/cli.js`.

Referencia detallada (plantillas, pasos de captura, errores comunes): `reference.md` junto a este archivo.

## Reglas que no se negocian

1. **Nunca captures datos reales.** Ni la base local del usuario (puede ser copia de producción) ni producción.
   Monta una base **demo aislada** con datos 100 % inventados (nombres, teléfonos `.example`, CURP/RFC falsos).
2. **No toques producción ni servicios reales** (WhatsApp, correo, pagos, APIs con costo). Simúlalos o apúntalos
   a direcciones inalcanzables en el lanzador demo.
3. **La narración describe lo que se ve.** Antes de escribir un guion, mira la pantalla (captura de exploración)
   y usa las etiquetas reales de los botones. Si el texto de la lección de la app contradice la interfaz,
   avísale al usuario y propón corregir el texto.
4. **No inventes interfaces.** Cada escena con pantalla usa una captura real (`shot`). Si algo no se puede
   capturar, no lo muestres.
5. Los guiones empiezan con `"status": "draft"` (marca BORRADOR). Solo pásalos a `"verified"` si el usuario
   lo pide o confirma que revisó el procedimiento.
6. No hagas commit ni despliegues sin que el usuario lo pida. No modifiques trabajo sin commit ajeno a la tarea.

## Flujo

### 1. Entender la app (antes de crear nada)

- Lee `CLAUDE.md`/`README` del proyecto: stack, cómo se corre en local, reglas de producción.
- Ubica: autenticación (ruta de login, cookie, roles), cómo se protegen los archivos estáticos
  (los videos deben quedar detrás del login si el contenido es interno), el esquema de BD y
  qué servicios externos llama cada pantalla al cargar.
- Si la app ya tiene un módulo de ayuda/capacitación, intégrate a él.
  Si no tiene, usa el Web Component del kit (`<seventeen-training>`) o el adaptador React.
- Lista las lecciones con el usuario: una lección = una pantalla o un procedimiento, 30–90 s.

### 2. Entorno demo dentro de la app: `capacitacion-videos/demo/`

- `docker-compose.yml`: base de datos aislada (otro contenedor, otro volumen, puerto libre, solo `127.0.0.1`),
  con el esquema real de la app y un `seed.sql` ficticio. Revisa que el puerto no lo use otro proyecto.
- `seed.sql`: usuarios demo (uno por rol que vayas a mostrar; contraseña documentada en el encabezado del seed,
  nunca en el chat), y datos suficientes para que cada pantalla se vea realista. Usa los mismos formatos de texto
  que genera el backend real (por ejemplo, mensajes de notificación).
- `dev.mjs`: arranca la app contra la base demo con variables de entorno que **sobrescriben** los secretos
  locales, y stubs para servicios externos (ver `reference.md`).
- `reset.mjs`: recrea la base demo (`down -v` + `up -d` + esperar al seed). Se ejecuta antes de cada lección.

### 3. `capacitacion-videos/training.config.json`

Copia la plantilla de `reference.md`: `baseUrl`, `setup`, `server`, `beforeLesson`, macros (`login`, uno por rol),
`narration`, `outDir` (carpeta servida y protegida), `publicPath`, `dataFile`, `locale`.

### 4. Explorar cada pantalla

Escribe un script de exploración temporal (en el scratchpad) con la clase `Browser` del kit
(`<KIT>/tools/training-cli/dist/browser.js`) y `browserExecutable()` (`<KIT>/packages/video-renderer/dist/index.js`):
inicia sesión, navega, haz clic y guarda PNGs. **Mira cada PNG** antes de escribir el guion.
Imprime los textos de los botones para elegir selectores estables.

### 5. Escribir la lección: `capacitacion-videos/<slug>/<slug>.script.json`

- `id` = slug de la lección en la app.
- `capture`: pasos (`use`, `goto`, `click`, `fill`, `waitFor`, `sleep`, `eval`, `run`, `shot`).
  Cada `shot` mide `regions` con nombre.
- `scenes`: `intro` → `demo`/`steps` (capturas con resaltados `{ "region": "nombre", "label": "Texto" }`)
  → `result` → `outro`. Primer capítulo `"chapter": "Introducción"`.
- Narración: frases cortas, tono de instrucción, español neutro; sin prometer comportamientos que no verificaste
  en el código o en la pantalla.

### 6. Construir

```bash
training build --input capacitacion-videos [--only a,b]
```

Levanta la demo, captura, narra (voz Windows), renderiza solo lo que cambió y escribe el `dataFile`.
Si una región falla («no encontré: x»), corrige el selector (ver errores comunes) y vuelve a correr `--only`.

### 7. Revisar

- Extrae fotogramas con el ffmpeg de Remotion
  (`<KIT>/node_modules/.pnpm/@remotion+compositor-*/node_modules/@remotion/compositor-*/ffmpeg.exe -ss <seg>`)
  en la mitad de las escenas y **míralos**: resaltado sobre el elemento correcto, sin avisos tapando, sin
  "Cargando…", fechas en el idioma correcto.
- Integra el `dataFile` en la app (una función que complete cada lección por `slug`) y corre las pruebas, el lint y el
  typecheck de la app. Agrega una prueba que verifique que cada video, miniatura y `.vtt` existan.
- Comprueba que los videos sin sesión respondan 302/307 (protegidos) si el contenido es interno.
- Apaga lo que levantaste (servidor demo, base demo) y borra cachés generadas por el dev server si rompen
  el build (en Next.js: `.next/dev`).

### 8. Reportar

Qué lecciones se generaron (duración), qué se verificó, diferencias encontradas entre la lección escrita y la
interfaz, hallazgos de seguridad vistos de paso, y qué falta (revisión humana, commit).

## Mantener los videos al día

Cuando la interfaz cambie, basta con `training build`: recaptura, compara píxeles (ignora relojes y
"hace 5 min"), y solo vuelve a renderizar las lecciones cuyas capturas, textos o voz cambiaron.
