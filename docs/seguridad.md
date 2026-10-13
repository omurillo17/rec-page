# Seguridad

**Regla central: la aplicación anfitriona controla la autorización. El kit solo muestra el
contenido que la app le entrega.**

## Qué hace el kit

- No tiene usuarios, sesiones, tokens ni identificadores globales. No guarda datos personales
  ni progreso: no usa `localStorage`, cookies propias ni analítica.
- Solicita el manifiesto, los recorridos y los subtítulos con `credentials: 'same-origin'`.
  Nunca envía credenciales a otros dominios.
- Valida todo JSON con Zod antes de usarlo, con objetos estrictos: un campo desconocido es
  un error.
- Rechaza rutas `javascript:`, `data:`, `http:` y con `..`.
- Inserta todo el texto con `textContent`. Un título con HTML se muestra como texto (hay una
  prueba de XSS en `packages/web-component/test`).
- Los recorridos solo resaltan y explican. El esquema no tiene campos para hacer clic,
  escribir, enviar ni borrar. Antes de ejecutar, se descartan los selectores inválidos, y los
  elementos faltantes se omiten (`optional`) o se avisan.
- Los eventos del kit no contienen datos del usuario.

## Qué debe hacer la app anfitriona

1. **Proteger en el servidor** el manifiesto y los archivos de contenido privado, con su
   autenticación normal (`@login_required`, middleware, guard…).
2. **Filtrar en el servidor** con los roles o grupos reales de la sesión. El atributo
   `roles` y el campo `roles` del manifiesto **no son seguridad**: cualquiera puede editar el
   HTML o llamar a la URL. Ver `crm/training_views.py` en el ejemplo de Django.
3. **Autorizar cada archivo**, no solo el manifiesto. El ejemplo de Django sirve un archivo
   solo si lo referencia un tutorial o recorrido visible para el usuario. Adivinar la URL de
   un video restringido devuelve 404.
4. **No poner tokens ni credenciales en manifiestos**, recorridos ni URLs. Si se necesitan
   URLs firmadas, genéralas en el servidor al responder, con vida corta, y no las guardes en el
   repositorio. `training validate` falla si detecta campos o valores que parecen credenciales
   (`token`, `apiKey`, `Bearer …`, JWT, `?signature=`, `user:pass@`).
5. **Responder con `Cache-Control: private`** (o `no-store` para el manifiesto) en el
   contenido protegido, para que proxies y CDN compartidos no lo guarden.
6. **No grabar datos reales en los videos.** Genera las capturas con datos ficticios (la demo
   usa dominios `.example`). Revisa cada captura antes de publicarla: los videos se distribuyen
   y no se pueden «despublicar» de las copias descargadas.

## Riesgos de guardar contenido privado en directorios públicos

Todo lo que esté en `public/`, `static/`, `media/` (sin protección) o un bucket público:

- **Es accesible sin sesión** para quien conozca o adivine la URL. Los nombres como
  `videos/registrar-cliente.mp4` son predecibles.
- **Puede quedar en caché** de CDN, proxies y buscadores, y seguir accesible después de borrarlo.
- **Ignora los roles.** Ocultar un video en la interfaz no impide descargarlo.
- **Puede filtrar información** del negocio (pantallas internas, nombres de clientes,
  procesos) a través de las capturas.

Por eso el manifiesto tiene `access: "protected"`, y `training validate` advierte cuando un
tutorial protegido apunta a `public/`, `static/` o a una URL https.

## Lista de revisión antes de publicar

- [ ] `training validate` sin errores (en CI).
- [ ] El contenido protegido se sirve desde una vista autenticada, fuera de las carpetas públicas.
- [ ] El manifiesto se filtra en el servidor con los roles reales.
- [ ] Las capturas y los videos solo contienen datos ficticios.
- [ ] El guion pasó de `draft` a `verified` después de que una persona comprobara el procedimiento en la app real.
