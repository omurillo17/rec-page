# @seventeen-training/content-schema

Esquemas Zod (y tipos TypeScript) del contenido de capacitación:

- `ManifestSchema`: manifiesto de una aplicación (módulos, tutoriales, recorridos, estados, roles informativos y rango de UI).
- `TourSchema` y `TourStepSchema`: recorridos, mapeados 1:1 a Driver.js y sin campos de acción.
- `VideoScriptSchema`: guion para el generador de videos (plantillas `intro`, `demo`, `steps`, `result` y `outro`).
- `formatIssues(error)`: errores legibles («tutorials.0.video.src: …»).

`pnpm build` también genera `schema/*.schema.json` (JSON Schema) para autocompletar en el editor.
El formato está documentado en [docs/contenido.md](../../docs/contenido.md).
