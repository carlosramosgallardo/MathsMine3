# MathsMine3 Realtime protocol

Supabase Realtime channel names and broadcast events used by the web client.
Native Android must use the same names for interoperability with web players.
`mm3_realtime.proto` is the typed copy; `make check` (Go protocol-lint) fails if it drifts from this JSON.
