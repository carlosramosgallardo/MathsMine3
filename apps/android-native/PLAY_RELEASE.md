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

```bash
npm run android:native:bundle
# → apps/android-native/dist/mathsmine3-native-release.aab
# prints release cert SHA-256
```

Then:

1. Upload the AAB to Play Console → **Internal testing**
2. Append the printed SHA-256 to `public/.well-known/assetlinks.json` (keep debug fingerprint for local)
3. Uninstall legacy TWA / debug builds on test devices before installing the Play build

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
npm run qa:sweep:unit
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:sweep -- --base https://127.0.0.1:3000
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:portal -- --base https://127.0.0.1:3000
```

See [`docs/QA.md`](../../docs/QA.md).

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
