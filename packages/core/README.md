# @seventeen-training/core

Lógica común sin DOM ni framework. Funciona en el navegador y en Node.

| Función | Uso |
|---|---|
| `loadManifest(url, { fetch?, credentials? })` | Descarga y valida el manifiesto. Resuelve `assetsBase`. Por defecto usa `credentials: 'same-origin'`. |
| `loadTour(ref, baseUrl)` | Descarga y valida un recorrido. Comprueba que su id coincida con el manifiesto. |
| `parseManifest` / `parseTour` | Validan datos ya cargados (por ejemplo, en una ruta de servidor). Lanzan `TrainingContentError`. |
| `selectContent(manifest, { module, roles, includeDrafts, appVersion })` | Filtra por módulo, estado, roles (solo UX) y compatibilidad de UI. |
| `recommend(tutorial, candidates, limit)` | Recomienda tutoriales de la misma app: primero el mismo módulo, luego las etiquetas compartidas. |
| `isUiCompatible`, `compareVersions` | Comparan versiones de la UI. |
| `parseVtt`, `toVtt`, `formatTimestamp`, `formatDuration` | Leen y escriben WebVTT. |

También reexporta todo `@seventeen-training/content-schema`.
