# MathsMine3 Native Android

Kotlin + Jetpack Compose client. Shares production APIs + Supabase Realtime with the Next.js portal.
**Does not affect Vercel** — build only this folder.

Supported platforms overview: [`docs/PLATFORMS.md`](../../docs/PLATFORMS.md).

## Download APK from GitHub

1. Repo → **Actions** → **Android native APK**
2. Open the latest successful run
3. Download artifact **`mathsmine3-native-debug`**

Or install from a **Release** created by tagging SemVer pre-releases (e.g. `git tag v0.1.0-beta.12 && git push origin v0.1.0-beta.12`).

CI needs GitHub Environment **`env`** secrets (or Variables):
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(same public client values as the portal). The workflow job uses `environment: env`.

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

### Google Sign-In error **10** (DEVELOPER_ERROR)

The app already uses the **Web** OAuth client ID (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`).
Android also needs a second OAuth client of type **Android** in the same Google Cloud project:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create credentials → OAuth client ID → **Android**
2. Package name: `xyz.mathsmine3.app`
3. SHA-1 (pick the one that matches how you installed the APK):

| Build | SHA-1 |
|-------|-------|
| **Debug** (emulator / `npm run android:native:build`) | `39:45:56:24:49:5C:A3:E2:5A:C0:BA:A6:73:07:5E:EF:FF:A2:6E:8E` |
| **Release / Play upload key** | `04:A2:7E:28:F8:4F:7B:11:FB:B6:D6:10:1E:00:6D:75:A8:E3:DD:CE` |

If the APK comes from **Play Internal testing**, also add the SHA-1 from Play Console → App integrity → App signing key certificate (Play may re-sign).

Re-print local fingerprints anytime:

```bash
# debug
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
# release
keytool -list -v -keystore apps/android-native/release.keystore -alias <alias> | grep SHA1
```

Changes in Cloud Console can take a few minutes. Uninstall/reinstall the app after adding the client.

Same `.env.local` file the Next.js portal uses. Do not commit it.

## Package id

`xyz.mathsmine3.app` (same as former TWA — replace listing when releasing)

## Architecture (short)

| Surface | Implementation |
|---|---|
| Portal Header (ticker / pulse / wallet) | WebView → `/embed/header` |
| Home 3D arena | WebView → portal home / `/embed/home-arena` |
| Mining FPV | WebView → `/embed/mining` |
| Nonagon, nav, other sections | Jetpack Compose (+ APIs) |
