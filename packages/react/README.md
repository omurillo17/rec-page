# @seventeen-training/react

Adaptador para React 18/19 y Next.js.

```tsx
import { TrainingHelp } from '@seventeen-training/react';

<TrainingHelp manifest="/training/manifest.json" module="clientes" appVersion="1.2.0" onTourEnd={(r) => …} />
```

- Lleva `'use client'`. En el servidor produce la etiqueta `<seventeen-training>` inerte.
  `useEffect` carga el Web Component con `import()` solo en el navegador (probado con
  `react-dom/server`).
- Las props se convierten en atributos de texto. `onTourEnd` y `onError` se registran como
  listeners y se limpian al desmontar.
- `ref` da acceso al elemento (`open()`, `openTutorial(id)` y `startTour(id)`).

Next.js y filtrado en servidor: [docs/integracion.md](../../docs/integracion.md#nextjs-app-router).
