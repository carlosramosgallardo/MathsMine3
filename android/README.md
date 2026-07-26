# MathsMine3 Android (Trusted Web Activity)

Same product as the web portal: Chrome TWA shell around `https://mathsmine3.xyz`.
Game logic, APIs, and Supabase stay in the Next.js app.

## Built APK (local debug)

```
android/dist/mathsmine3-debug.apk
```

Rebuild:

```bash
export JAVA_HOME=$HOME/.local/jdk/jdk-17.0.19+10
export ANDROID_HOME=$HOME/.local/android
cd android && ./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk dist/mathsmine3-debug.apk
```

Or from repo root: `npm run android:build`

## Test on a PC

1. **Physical phone (easiest):** enable USB debugging →  
   `adb install -r android/dist/mathsmine3-debug.apk`
2. **Emulator:** install Android Studio on Windows → create a Pixel AVD →  
   start emulator → same `adb install` command.
3. You cannot run this APK as a normal Linux/Windows desktop window without an emulator or phone.

## Digital Asset Links

Debug fingerprint is already in `public/.well-known/assetlinks.json` (matches the local debug keystore).
Deploy the site so verification works fullscreen. Until then, Chrome may show the URL bar — the app still works.

For Play Store you will need a **release** keystore and update the fingerprint.

## Notes

- `android/local.properties` is machine-specific (gitignored).
- Package id: `xyz.mathsmine3.app`
