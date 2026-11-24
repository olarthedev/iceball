# Del origen al destino — publicación

Carpeta lista para publicar como sitio estático (no requiere compilación).

## Publicar en Vercel
1. Entra a vercel.com e inicia sesión.
2. Opción rápida: instala la CLI (`npm i -g vercel`), abre una terminal dentro de esta carpeta y ejecuta `vercel --prod`.
3. Opción web: sube esta carpeta a un repositorio de GitHub y en Vercel elige "Add New → Project", importa el repositorio. Framework Preset: **Other**. Sin comando de build. Output: la raíz.
4. Vercel te dará el enlace público. Ábrelo y recorre las 8 etapas para comprobarlo.

## Probar en local
No funciona con doble clic (el navegador bloquea los módulos). Desde esta carpeta:
`npx serve .`  o  `python -m http.server 8000` → abre http://localhost:8000

## Contenido
- index.html — la experiencia
- port-scene.js — escena 3D
- three.module.js — motor 3D (local, no depende de internet)
- vendor/ — React (local)
- support.js — runtime de la interfaz

## Calidad gráfica
Se ajusta sola: si el equipo va lento, baja resolución y luego quita las sombras.
Las fuentes tipográficas se cargan de Google Fonts; sin internet se usa una fuente del sistema.
