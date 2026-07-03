#!/usr/bin/env node
/** One-off: teleport a stuck mining wallet to M1 center. Usage: node scripts/teleport-mining-wallet.mjs [wallet] */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* */ }
}

loadEnvLocal()

const wallet = String(process.argv[2] || '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab').toLowerCase()
const row = 27
const col = 27
const z = 0
const mapId = '1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const payload = {
  wallet,
  health: 100,
  last_pos_row: row,
  last_pos_col: col,
  last_pos_z: z,
  last_pos_map_id: mapId,
  pvp_dead_until: null,
  pvp_dead_gx: null,
  pvp_dead_gy: null,
  pos_updated_at: new Date().toISOString(),
}

const { error } = await sb.from('mm3_pvp_health').upsert(payload, { onConflict: 'wallet' })
if (error) {
  if (error.message?.includes('last_pos_map_id')) {
    delete payload.last_pos_map_id
    const retry = await sb.from('mm3_pvp_health').upsert(payload, { onConflict: 'wallet' })
    if (retry.error) {
      console.error('Failed:', retry.error.message)
      process.exit(1)
    }
    console.log(`Teleported ${wallet} to M1 (${row},${col}) — mapId column missing, apply migration 20260702120000_pvp_health_map_id.sql`)
    process.exit(0)
  }
  console.error('Failed:', error.message)
  process.exit(1)
}

console.log(`Teleported ${wallet} to map ${mapId} cell (${row},${col}) z=${z}. Refresh /mining.`)
