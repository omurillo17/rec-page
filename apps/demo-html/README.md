# demo-html

Módulo **Clientes** en HTML y JavaScript, sin framework y con datos ficticios.
El kit se carga como archivo estático (`public/vendor/seventeen-training.js`, copiado del
paquete al iniciar), igual que en Django o en cualquier app renderizada en el servidor.

```bash
pnpm --filter demo-html dev
```

Abre http://localhost:5173.

| Ruta | Contenido |
|---|---|
| `public/training/` | Contenido servido: manifiesto, 2 recorridos, 2 videos MP4 con WebVTT y miniatura. |
| `training-src/<id>/` | No se sirve: guion de video y capturas reales con sus coordenadas (`regions.json`). |
| `scripts/capture.mjs` | Con la demo en ejecución, ejecuta el procedimiento en Chrome Headless y guarda capturas y coordenadas. |

Regenerar los videos (desde la raíz del repositorio):

```bash
pnpm training render --input apps/demo-html/training-src/registrar-cliente/registrar-cliente.script.json --out apps/demo-html/public/training/videos
```
