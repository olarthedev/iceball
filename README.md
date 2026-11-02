# ICEBALL — Landing page

Sitio estático (HTML/CSS/JS), sin build. Proyecto académico de Negocios Internacionales.

## Estructura
- `index.html` — entrada (Open Graph + favicon); redirige a la landing.
- `ICEBALL Landing.dc.html` — la landing completa (una sola página con anclas).
- `IceSphere.dc.html` — ilustración reutilizable de la esfera (parámetro `glow` para el color del brillo).
- `support.js` — runtime necesario (no borrar).
- `favicon.svg` — favicon a partir del logo.
- `vercel.json` — indica a Vercel que sirva la raíz (necesario porque existe la carpeta `public/`).
- `public/images/` — fotos en WebP (≤ 300 KB) y `og-image.jpg` (1200×630).

## Imágenes
| Archivo | Uso |
|---|---|
| hero-desktop.webp / hero-mobile.webp | Inicio (`<picture>`: celular < 960 px usa la vertical) |
| segmento-whisky / -cocteles / -bares / -sostenible.webp | Tarjetas de “¿A quién está dirigido?” |
| empaque.webp | Presentación comercial (contain) |
| exportacion.webp | Banner de exportación |
| infografia-producto / -exportacion.webp | Galería |

Para reemplazar una foto, conserva el nombre y el formato WebP (`cwebp -q 82 foto.jpg -o foto.webp` o squoosh.app).

## Desplegar en Vercel

**Opción A — desde GitHub**
1. Sube esta carpeta a un repositorio de GitHub.
2. En vercel.com → **Add New… → Project** → importa el repositorio.
3. Framework Preset: **Other**. Deja vacíos Build Command y Output Directory (los define `vercel.json`).
4. **Deploy**.

**Opción B — con la CLI**
```bash
npm i -g vercel
cd carpeta-del-proyecto
vercel        # vista previa
vercel --prod # producción
```

Tras el primer deploy, cambia en `index.html` la ruta de `og:image` por la URL absoluta (ej. `https://tu-proyecto.vercel.app/public/images/og-image.jpg`) para que WhatsApp/redes muestren la vista previa.

## Antes de publicar
- Precios (US$19.99, US$16.99, US$12.99, pack x4 US$59.99) — estimados de ejemplo.

## Notas
- El formulario es de demostración: no envía ni almacena datos.
- Las imágenes son conceptuales.
