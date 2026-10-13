# rec-page (CLI)

```
training validate --input <carpeta|manifest.json>   Manifiesto, referencias, recorridos, MP4, imágenes, WebVTT y secretos
training validate --input <guion.json>              Guion de video y existencia de capturas y audio
training list     --input <carpeta|manifest.json>   Módulos, tutoriales y recorridos, con estado, acceso y roles
training render   --input <guion.json> [--out <carpeta>] [--size <px>]
training preview  --input <guion.json>              Remotion Studio con el guion y sus capturas
training narrate  --input <guion.json> [--voice <nombre>] [--rate <n>]
                                                    Voz local de Windows por escena y ajuste de duraciones
```

Un archivo JSON con `scenes` se trata como guion; cualquier otro, como manifiesto.
`validate` termina con código 1 si hay errores, por lo que sirve en CI.

Comprobaciones de `validate`: esquema estricto; ids únicos; módulos y recorridos referenciados;
id y módulo del recorrido iguales a los del manifiesto; existencia de archivos; firma `ftyp`
del MP4; JPG, PNG o WebP en miniaturas; sintaxis WebVTT; subtítulos y capítulos dentro de la
duración; capítulos ordenados; claves y valores con aspecto de credencial; contenido
`protected` en carpetas o URLs públicas; selectores sin `data-training` (advertencia).
