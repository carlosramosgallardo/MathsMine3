# Play release cutover

1. Create a **release** keystore (do not commit):
   `keytool -genkeypair -keystore release.keystore -alias mathsmine3 -keyalg RSA -validity 10000`
2. Configure `app/build.gradle.kts` signingConfigs.release
3. `./gradlew bundleRelease` → upload AAB to Play Console
4. Append release SHA-256 to `public/.well-known/assetlinks.json` (additive; keep debug fingerprint for local)
5. Uninstall TWA builds on test devices; install native APK/AAB
6. Parity checklist vs web:
   - [ ] Google login → create-account
   - [ ] Wallet address login
   - [ ] Training
   - [ ] Trading / Ranking / Daily / Squeezing / Relaying
   - [ ] Mining Filament world (port in progress — see MiningPortChecklist)
