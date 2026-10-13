# Actualizar el kit sin romper las aplicaciones

## Versiones

| Versión | Cambia cuando… | Quién la controla |
|---|---|---|
| Paquetes `@seventeen-training/*` (SemVer) | MAJOR: cambia un atributo, evento o API pública, o se elimina. MINOR: hay funciones nuevas compatibles. PATCH: correcciones. | Equipo del kit |
| `schemaVersion` del contenido | Cambio incompatible del formato JSON (hoy `1`). | Equipo del kit |
| `contentVersion` | Cambia el contenido de una app. | Cada app |
| `ui.minVersion` / `ui.maxVersion` | La UI de la app cambia de forma que rompe los selectores de los recorridos. | Cada app |

## Reglas para el equipo del kit

1. **No romper el contrato público sin MAJOR.** Contrato público: el nombre de la etiqueta,
   los atributos, los eventos, los métodos, las exportaciones de `core` y los esquemas.
2. **Los campos nuevos del esquema son opcionales y tienen valor por defecto.** Un
   manifiesto válido hoy debe seguir siéndolo en toda la serie 1.x.
3. **Si el formato cambia de forma incompatible**, sube `schemaVersion` y mantén durante al
   menos una versión MAJOR el soporte de la versión anterior. Agrega un comando de migración
   a la CLI.
4. **Corre `pnpm test` y las dos demos** antes de publicar. Las pruebas cubren esquemas, filtros,
   WebVTT, SSR de React, el Web Component (incluido XSS) y la validación con la CLI sobre el
   contenido real de la demo.
5. **Publica notas de versión** con cada cambio visible para las apps.

## Reglas para cada aplicación

1. **Fija la versión exacta** (`"@seventeen-training/web": "0.1.0"`, sin `^`) o copia el
   archivo `seventeen-training.js` versionado (`training-kit/0.1.0/seventeen-training.js`).
   Así una actualización es un cambio explícito en un PR.
2. **Valida en CI** el contenido de la app con la versión de la CLI que usa:

   ```bash
   npx training validate --input public/training
   ```

3. **Usa `data-training` en lugar de clases CSS** en los recorridos. Así un rediseño no rompe
   los selectores.
4. **Declara `ui.minVersion` y `ui.maxVersion`** en el manifiesto y pasa `app-version`. Si
   una versión de la app queda fuera del rango, el kit oculta los recorridos (que fallarían) y
   mantiene los videos.
5. **Marca como `optional`** los pasos que dependen de permisos o de datos que pueden no estar.
6. **El kit falla de forma segura.** Si no carga o el contenido es inválido, el botón muestra
   un aviso y la app sigue funcionando. Aun así, revisa la consola y escucha `training-error`
   en entornos de prueba.

## Procedimiento de actualización en una app

1. Lee las notas de versión del kit.
2. Actualiza la dependencia o el archivo copiado en una rama.
3. Ejecuta `training validate` y las pruebas de la app.
4. Abre cada módulo con ayuda: reproduce un video e inicia sus recorridos.
5. Publica. Para revertir, basta con restaurar la versión anterior del archivo o del paquete:
   el kit no guarda estado ni migra datos.
