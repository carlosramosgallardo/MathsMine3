# MathsMine3 Native Android

Kotlin + Jetpack Compose client. Shares production APIs + Supabase Realtime with the Next.js portal.
**Does not affect Vercel** — build only this folder.

## Build

```bash
export JAVA_HOME=$HOME/.local/jdk/jdk-17.0.19+10
export ANDROID_HOME=$HOME/.local/android
cd apps/android-native
cp local.properties.example local.properties   # edit sdk.dir
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

From repo root: `npm run android:native:build`

## Configure

Values are read automatically from the **repo-root** `.env.local` at Gradle build time:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → Google Sign-In (same as web)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Realtime

Android Sign-In error **10** needs a Cloud Console OAuth client type **Android**
(`xyz.mathsmine3.app` + debug SHA-1), in addition to the Web client ID above.

Same file the Next.js portal uses. Do not commit `.env.local`.

## Package id

`xyz.mathsmine3.app` (same as former TWA — replace listing when releasing)
