# MathsMine3 API contracts

Documentation of the existing Next.js route handlers under `app/api/**`.
Consumed by the native Android client. **Does not change Vercel runtime.**

Base URL (production): `https://mathsmine3.xyz`

All mutating game routes expect JSON bodies; many accept a `wallet` field
(active identity: real `0x…` or Google-derived virtual wallet).
