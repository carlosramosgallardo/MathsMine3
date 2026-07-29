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

1. Create a **release** keystore (do not commit):
   `keytool -genkeypair -keystore release.keystore -alias mathsmine3 -keyalg RSA -validity 10000`
2. Configure `signingConfigs.release` in `app/build.gradle.kts`
3. `./gradlew bundleRelease` → upload **AAB** to Play Console (Internal testing first)
4. Append release SHA-256 to `public/.well-known/assetlinks.json` (keep debug fingerprint for local)
5. Uninstall legacy TWA builds on test devices

## Phase 2 — Smoke test (device + emulator)

With wallet session signed in:

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
