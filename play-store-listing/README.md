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

## Upload order in Play Console

1. **`01-app-icon/`** → App icon · PNG **512 × 512**
2. **`02-feature-graphic/`** → Feature graphic · PNG **1024 × 500**
   - `feature-graphic-1024x500.png` → EN locale
   - `feature-graphic-1024x500-es.png` → ES locale
3. **`03-phone-screenshots/`** → Phone screenshots · **1080 × 1920** (min. 2; 4 included)
4. **`04-tablet-7/`** → 7" tablets · **1920 × 1080**
5. **`05-tablet-10/`** → 10" tablets · **1920 × 1080**
6. **`06-google-play-games-pc/`**
   - `logo/` · Transparent logo **600 × 400**
   - `cover-graphic/` · Cover **no text** **1920 × 1080**
   - `screenshots/` · PC screenshots **1920 × 1080**
7. **`07-chromebook/`** → Only if you enable the Chromebook listing
8. **`08-android-xr/`** → **Do not upload** unless the app declares real XR support (not today)

## Vídeo

- Short actual: https://www.youtube.com/shorts/NRaN40UXpOM  
- PC / XR: dejar vacío hasta tener URL YouTube dedicada.

## Textos sugeridos (EN)

**Título (≤30):** `MathsMine3`

**Descripción breve (≤80):**  
`Timed math. Fictional mining. Live 3D multiplayer. Earn MM3 in a terminal world.`

**Full description:** see `listing-copy.md`.

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
