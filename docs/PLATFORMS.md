# Platforms

Supported surfaces for MathsMine3 today. One product, shared backend (`mathsmine3.xyz` APIs + Supabase).

## Active

| Platform | How you run it | Notes |
|---|---|---|
| **Web · desktop (PC)** | Browser → [mathsmine3.xyz](https://mathsmine3.xyz) | Full portal (Next.js on Vercel) |
| **Web · mobile** | Browser on phone (portrait) | Same codebase; touch / coarse layout |
| **Android native app** | APK `xyz.mathsmine3.app` in [`apps/android-native/`](../apps/android-native/) | Compose shell + WebViews for portal Header, Home arena, Mining FPV |

## Not active

| Platform | Status |
|---|---|
| iOS app | Not built |
| Desktop native (Electron, etc.) | Not built — PC = web |
| Legacy TWA (`android/`) | Archived; do not ship |

## Feature parity rule

- Logic that lives **only in the portal** and is shown in the app via **WebView** (Header, Mining FPV, Home 3D arena) updates when you deploy the web app — no Android code change.
- UI that lives in **Jetpack Compose** (nonagon, session strip, Training/Trading/… screens still native) must be updated in `apps/android-native/` when you change that UX.
- Web PC and web mobile are the **same** deploy; only responsive / touch CSS differs.

## Download Android APK (GitHub)

1. Open **Actions** → workflow **Android native APK**.
2. Pick the latest green run on `main`.
3. Download the artifact **`mathsmine3-native-debug`**.

Optional permanent link: push a tag `android-v*` (e.g. `android-v2.0.0`) — the workflow attaches the APK to a **GitHub Release**.

The workflow uses GitHub Environment **`env`** secrets:
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Local build: `npm run android:native:build` (see [`apps/android-native/README.md`](../apps/android-native/README.md)).

Preferred emulator for local QA: AVD **FreakingAI**.

---

# Plataformas

Superficies soportadas hoy. Un producto, backend compartido.

## Activas

| Plataforma | Cómo se usa | Notas |
|---|---|---|
| **Web · escritorio (PC)** | Navegador → [mathsmine3.xyz](https://mathsmine3.xyz) | Portal completo (Next.js en Vercel) |
| **Web · móvil** | Navegador del teléfono (vertical) | Mismo código; layout táctil |
| **App Android nativa** | APK `xyz.mathsmine3.app` en [`apps/android-native/`](../apps/android-native/) | Shell Compose + WebViews (Header, arena Home, Mining FPV) |

## No activas

| Plataforma | Estado |
|---|---|
| App iOS | No existe |
| Desktop nativo | No existe — PC = web |
| TWA antigua (`android/`) | Archivada |

## Regla de paridad

- Lo que vive en el **portal** y la app muestra por **WebView** se actualiza al desplegar web.
- Lo que vive en **Compose** hay que tocarlo también en `apps/android-native/`.

## Descargar el APK (GitHub)

**Actions** → **Android native APK** → artefacto `mathsmine3-native-debug`.  
Tags `android-v*` → Release con el APK adjunto.
