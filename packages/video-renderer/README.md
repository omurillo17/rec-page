# @seventeen-training/video-renderer

Plantillas Remotion y API de Node para generar videos desde un guion JSON y capturas reales.

- `src/remotion/`: composición `Tutorial` con las plantillas `intro`, `demo`, `steps`,
  `result` y `outro`, resaltados sobre la captura (posición medida, no estimada), subtítulos
  opcionales quemados, música y narración opcionales, barra de progreso y marca BORRADOR.
- `src/timeline.ts`: tiempos de escenas, capítulos, división de subtítulos y dimensiones.
  El mismo cálculo genera el `.vtt` y los subtítulos quemados.
- `renderTutorial({ scriptPath, outDir, size? })`: valida, comprueba recursos y genera
  `<id>.mp4` (H.264), `<id>.<lang>.vtt`, `<id>.jpg`, y devuelve el bloque `video` del manifiesto.

Uso a través de la CLI: `training render` y `training preview`.
Requisitos y **licencias** (Remotion es gratis para freelancers y equipos de hasta 3 personas;
por encima de eso requiere licencia de empresa): [docs/videos.md](../../docs/videos.md).
