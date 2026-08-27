# Play release cutover

Sideload betas (`v0.1.0-beta.N` on GitHub) are **debug APKs** — not Play Store builds.

## Phase 0 — Security SQL (prod Supabase)

Apply in order (SQL Editor or `supabase db push`):

| Migration | Purpose |
|-----------|---------|
| `20260726180000_apply_pending_security_lock.sql` | Fase A: lock SECURITY DEFINER RPCs to `service_role` |
| `20260727120000_lock_anon_client_writes.sql` | Fase B: revoke anon writes on economy/progress tables |
| `20260707151000_create_account_rate_limit.sql` | Persistent create-account rate limit |
| `20260729140000_lock_anon_wallet_pool_writes.sql` | Fase B ext: lock anon writes on wallet pools |

Verify after apply:

```sql
SELECT has_table_privilege('anon', 'public.player_progress', 'INSERT');        -- false
SELECT has_function_privilege('anon', 'public.mm3_dispute_join(bigint, text)', 'EXECUTE'); -- false
SELECT has_table_privilege('anon', 'public.mm3_wallet_pools', 'INSERT');     -- false
```

Deploy **Vercel first**, then SQL (APIs must exist before anon writes are revoked).

## Phase 1 — Release engineering

### Keystore (local, never commit)

Files (gitignored):

- `apps/android-native/release.keystore`
- `apps/android-native/keystore.properties` (from `keystore.properties.example`)

**Back up both offline.** Losing the upload key blocks future Play updates (unless you use Play App Signing with a registered upload key recovery).

Gradle reads `keystore.properties` and signs `release` via `signingConfigs.release`.

### Build signed AAB

**Local / Cloud Agent (WSL or Cursor Cloud):**

```bash
npm run android:native:bundle
# → apps/android-native/dist/mathsmine3-<versionName>.aab
#    e.g. mathsmine3-0.1.0-beta.13.aab
# prints release cert SHA-256
```

Requires `keystore.properties` + `release.keystore`, **or** these env secrets (never commit):

| Secret | Purpose |
|--------|---------|
| `ANDROID_RELEASE_KEYSTORE_BASE64` | Base64 of `release.keystore` |
| `ANDROID_KEYSTORE_STORE_PASSWORD` | Keystore password |
| `ANDROID_KEYSTORE_KEY_ALIAS` | Key alias (default `mathsmine3`) |
| `ANDROID_KEYSTORE_KEY_PASSWORD` | Key password (defaults to store password) |

**GitHub Actions (no PC):** add the same secrets to GitHub Environment **`env`**, then run workflow **Android native AAB** (`workflow_dispatch`) or push a `v*` tag. The AAB is attached to the GitHub Release — download it on your phone and upload to Play Console in Chrome.

**Codemagic:** repo-root `codemagic.yaml` (native Android, not React Native). Create variable group **`mm3_android`** with the portal keys plus the four signing secrets above. Start workflow **Native Android signed AAB**. Play Console upload stays manual until a Play service account is added.

**Mobile upload (Play Console):** the Play Console app does **not** upload AABs. Open [play.google.com/console](https://play.google.com/console) in Chrome → **Test and release** → **Internal testing** → **Create release** → **Upload** → pick the `.aab` from Downloads.

Then:

1. Upload the AAB to Play Console → **Internal testing**
2. Upload **native debug symbols** (see below) if Play warns about missing symbols
3. Append the printed SHA-256 to `public/.well-known/assetlinks.json` (keep debug fingerprint for local)
4. Uninstall legacy TWA / debug builds on test devices before installing the Play build

### Native debug symbols (Play warning)

Filament ships prebuilt `.so` libraries. Play expects native debug symbols for ANR/crash reports.

**Option A — automatic (next AAB builds):**

1. Install NDK in the Android SDK (required for AGP to embed symbols):

   ```bash
   sdkmanager "ndk;26.1.10909125"
   ```

2. `app/build.gradle.kts` sets `defaultConfig.ndk.debugSymbolLevel = SYMBOL_TABLE`.
3. Rebuild: `npm run android:native:bundle` — symbols should appear under
   `BUNDLE-METADATA/com.android.tools.build.debugsymbols` inside the AAB.

**Option B — manual upload (works for an AAB already in Play):**

1. After `npm run android:native:bundle`, use the generated zip:
   `apps/android-native/dist/native-debug-symbols-<versionName>.zip`
2. Play Console → **Test and release** → **App bundle explorer**
3. Select the version (e.g. `32 (0.1.0-beta.6)`)
4. **Downloads** tab → **Native debug symbols** → upload the zip

Or: **Release** → your release → **App bundle explorer** → same upload control.

The zip contains the four ABI folders (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) with the merged `.so` symbol tables from Filament.

### Release cert fingerprint (fill after first keystore)

```
SHA-256: AC:8A:45:9A:25:DF:7A:E2:7F:14:6D:00:27:A6:13:6A:EC:4E:D2:D1:D0:FC:8F:9A:82:B7:B6:48:3C:EE:D0:FE
```

(Re-print anytime with `npm run android:native:bundle` or `keytool -list -v -keystore apps/android-native/release.keystore`.)

## Phase 2 — Smoke test (device + emulator)

Manual UI checklist (with wallet session signed in):

- [ ] Google login → create-account
- [ ] MetaMask wallet connect + session
- [ ] Ronin (if shipping in v1)
- [ ] Training (resolve / failure)
- [ ] Trading + Zero-Day claim
- [ ] Relaying (chat, `/exec`, market commands)
- [ ] Presence heartbeat (header + relaying, post SQL)
- [ ] Ranking / Daily / Squeezing
- [ ] Home WebView (arena + minimap)
- [ ] Mining WebView FPV
- [ ] MM3 Chart (native markers)
- [ ] SEC scan + API / Privacy / Terms native screens

### Automated QA

```bash
npm test
npm run qa:sweep:unit
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:sweep -- --base https://127.0.0.1:3000
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:portal -- --base https://127.0.0.1:3000
```

CI runs `npm test`, the unit sweep, a production build, and Playwright portal phases 1–2 on web PRs and on `v*` tags (see [`docs/QA.md`](../../docs/QA.md)).

## Phase 3 — Play Console

- [ ] Internal testing track (closed)
- [ ] Data safety form (wallet, Supabase, Google Sign-In)
- [ ] Content rating questionnaire
- [ ] Store listing EN/ES + screenshots
- [ ] Privacy policy URL: https://mathsmine3.xyz/privacy

## Architecture (WebView by design)

| Surface | Implementation |
|---------|----------------|
| Home arena / minimap | WebView `/embed/home-arena`, `/embed/home-minimap` |
| Mining FPV | WebView `/embed/mining` |
| Everything else | Jetpack Compose + session-authenticated APIs |
