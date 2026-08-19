# Play Store listing — MathsMine3

Assets listos para Google Play Console (tamaños exactos). Regenerados para usar la **marca real** del proyecto (`mm3_logo_core` / `MM3_thumbnail`) y capturas **sin cookie banner**.

## Qué se corrigió respecto a la versión anterior

| Antes (Codex) | Ahora |
|---|---|
| Icono pixel “M2” antiguo | Icono metálico oficial **MZ/MM3** 512×512 |
| Feature graphic AI genérica (cueva + moneda inventada) | Feature desde `MM3_thumbnail.jpg` + logo real + claim |
| Capturas con banner de cookies | Cookies recortadas + franja de caption de marketing |
| Logo PC con fondo negro opaco | PNG **transparente** 600×400 |
| Tablet / Chromebook / XR / PC = mismas 4 fotos clonadas | Landscape derivados de las 4 capturas phone con marco + caption |
| Portada PC AI sin marca | Portada desde thumbnail oficial + medallón (sin texto) |

## Orden de subida en Play Console

1. **`01-icono-aplicacion/`** → Icono de la aplicación · PNG **512 × 512**
2. **`02-grafico-de-funciones/`** → Gráfico de funciones · PNG **1024 × 500**
   - `grafico-funciones-1024x500.png` → locale EN
   - `grafico-funciones-1024x500-es.png` → locale ES
3. **`03-capturas-telefono/`** → Capturas de teléfono · **1080 × 1920** (mín. 2; aquí van 4)
4. **`04-tablet-7/`** → Tablets de 7" · **1920 × 1080**
5. **`05-tablet-10/`** → Tablets de 10" · **1920 × 1080**
6. **`06-google-play-games-pc/`**
   - `logo/` · Logotipo transparente **600 × 400**
   - `grafico/` · Portada **sin texto** **1920 × 1080**
   - `capturas/` · Capturas PC **1920 × 1080**
7. **`07-chromebook/`** → Solo si activas ficha Chromebook
8. **`08-android-xr/`** → **No subir** salvo que la app declare XR real (hoy no)

## Vídeo

- Short actual: https://www.youtube.com/shorts/NRaN40UXpOM  
- PC / XR: dejar vacío hasta tener URL YouTube dedicada.

## Textos sugeridos (EN)

**Título (≤30):** `MathsMine3`

**Descripción breve (≤80):**  
`Timed math. Fictional mining. Live 3D multiplayer. Earn MM3 in a terminal world.`

**Descripción completa:** ver `textos-ficha.md`.

## Textos sugeridos (ES)

**Título:** `MathsMine3`

**Descripción breve:**  
`Mate cronometrada. Minería ficticia. Multijugador 3D. Gana MM3 en un mundo terminal.`

## Notas

- Las landscape de tablet/PC/Chromebook/XR se generan desde capturas **web landscape** reales (`_raw-landscape/`), con crop/zoom al panel útil + franja de caption. No son screenshots nativos de tablet Android; si quieres eso, sustituye `04`/`05` con capturas del emulador/dispositivo.
- Mining: se oculta el overlay “CLICK TO PLAY” por CSS (sin pointer-lock) para enseñar el mundo 3D.
- Training: se arranca la partida y se captura el problema activo (no la pantalla vacía de start).
- El icono del launcher Android (`mipmap`) sigue siendo el pixel art; esta ficha usa el medallón HD de marca para la store. Si quieres unificar, hay que actualizar también el icono de la app.
- No commits de AAB aquí: solo assets de ficha.
