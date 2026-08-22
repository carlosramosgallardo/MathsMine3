# MathsMine3 API contracts

Documentation of the existing Next.js route handlers under `app/api/**`.

**Canonical user-facing docs** (web `/api`, Android API tab, curl examples):
`lib/api-documentation.js` — run `npm run api-docs:sync` to refresh
`apps/android-native/app/src/main/assets/api_documentation.json`.

This package also holds `openapi.yaml` (machine-readable subset for tooling)
and `routes.txt`. `make check` (Go api-lint) fails if `app/api/**/route.js`
drifts from `routes.txt`.

Base URL (production): `https://mathsmine3.xyz`

All mutating game routes expect JSON bodies; session-protected routes require
`Authorization: Bearer <token>` from `POST /api/auth/session`.
