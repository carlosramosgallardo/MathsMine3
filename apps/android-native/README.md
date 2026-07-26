# MathsMine3 Native Android

Kotlin + Jetpack Compose client. Shares production APIs + Supabase Realtime with the Next.js portal.
**Does not affect Vercel** — build only this folder.

Supported platforms overview: [`docs/PLATFORMS.md`](../../docs/PLATFORMS.md).

## Download APK from GitHub

1. Repo → **Actions** → **Android native APK**
2. Open the latest successful run
3. Download artifact **`mathsmine3-native-debug`**

Or install from a **Release** created by tagging `android-v*` (e.g. `git tag android-v2.0.0 && git push origin android-v2.0.0`).

CI needs repo **Variables** (or Secrets): `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same public client values as the portal).

## Build

```bash
export JAVA_HOME=$HOME/.local/jdk/jdk-17.0.19+10
export ANDROID_HOME=$HOME/.local/android
cd apps/android-native
cp local.properties.example local.properties   # edit sdk.dir
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

From repo root: `npm run android:native:build` (prefers AVD **FreakingAI** when online).

## Configure

Values are read automatically from the **repo-root** `.env.local` at Gradle build time:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → Google Sign-In (same as web)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Realtime

Android Sign-In error **10** needs a Cloud Console OAuth client type **Android**
(`xyz.mathsmine3.app` + debug SHA-1), in addition to the Web client ID above.

Same file the Next.js portal uses. Do not commit `.env.local`.

## Package id

`xyz.mathsmine3.app` (same as former TWA — replace listing when releasing)

## Architecture (short)

| Surface | Implementation |
|---|---|
| Portal Header (ticker / pulse / wallet) | WebView → `/embed/header` |
| Home 3D arena | WebView → portal home / `/embed/home-arena` |
| Mining FPV | WebView → `/embed/mining` |
| Nonagon, nav, other sections | Jetpack Compose (+ APIs) |
