# @seventeen-training/web

`<seventeen-training>`: botón de ayuda, diálogo con videotutoriales y recorridos Driver.js.
Se distribuye como **un solo archivo ES** (`dist/seventeen-training.js`, 41 KB gzip) que
incluye core, Zod y Driver.js.

```html
<script type="module" src="/static/seventeen-training.js"></script>
<seventeen-training manifest="/training/manifest.json" module="clientes" app-version="1.2.0"></seventeen-training>
```

- Reproductor HTML5 nativo con MP4, pistas WebVTT, miniatura, duración, capítulos, selector
  de velocidad (0,75×–2×), transcripción navegable (generada desde el mismo VTT), notas de
  accesibilidad y recomendaciones.
- Recorridos: resaltado, popover con anterior, siguiente, salir y progreso; espera de
  elementos en páginas dinámicas; pasos opcionales; aviso cuando falta un elemento; descarte
  de selectores inválidos.
- Diálogo nativo `<dialog>` (foco atrapado, Esc), Shadow DOM, modo oscuro y pantalla completa en móvil.
- El manifiesto se descarga al abrir la ayuda. Los errores nunca se propagan a la app.

API, atributos y eventos: [docs/arquitectura.md](../../docs/arquitectura.md#2-web-component).
También exporta `startTour(tour)`, `toDriveSteps` y todo `core` para usarlos sin el elemento.
