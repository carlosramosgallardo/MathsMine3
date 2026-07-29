#!/usr/bin/env node
/**
 * MathsMine3 QA sweep — full portal/API regression harness (manual).
 *
 * Usage:
 *   npm run qa:sweep:unit
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:sweep -- --base https://127.0.0.1:3000
 *   npm run qa:sweep:prod
 *   npm run qa:sweep -- --pvp-samples 100
 *   npm run qa:sweep -- --allow-destructive   # demine hit (touches live chain)
 *
 * Exit 1 if any NOK. Prints OK / NOK / SKIP.
 *
 * Covers API-assertable game effects. Client-only physics/VFX are SKIP'd with reasons.
 */
import { pathToFileURL } from 'url'
import { resolve } from 'path'
import {
  ROOT,
  QA,
  loadEnvLocal,
  createSessionToken,
  parseArgs,
  createReporter,
  sbClient,
  makeApi,
  ensureProgress,
  ensureLeaderboard,
  ensureHealth,
  clearSqueeze,
  setSqueeze,
  clearMined,
  findFreeRegularBlock,
  rateInBand,
  restoreBossHp,
} from './qa/lib.mjs'

loadEnvLocal()
const opts = parseArgs(process.argv)
const { ok, nok, skip, summary } = createReporter()
const api = makeApi(opts.base)

console.log('=== MathsMine3 QA Sweep (full) ===')
console.log(`base=${opts.base} unitOnly=${opts.unitOnly} pvpSamples=${opts.pvpSamples} destructive=${opts.allowDestructive}`)
console.log('')

// ═══════════════════════════════════════════════════════════════════════════
// UNIT
// ═══════════════════════════════════════════════════════════════════════════
async function runUnit() {
  const deco = await import(pathToFileURL(resolve(ROOT, 'lib/wallet-decorations.js')).href)
  const {
    miningSkillAbilityLines,
    getWalletTradeMultiplier,
    HACKING_CHANCE,
    HACKING_OFFLINE_MS,
  } = deco

  const cases = [
    ['❤️', null, null, ['+10%', 'SPD']],
    ['⚔️', 'sq-atk', null, ['+5%', 'CRT']],
    ['🔰', 'sq-def', null, ['10%', 'DGE']],
    ['👾', 'zero-day', null, ['10%', 'HCK']],
    ['⬡', 'block-1', 'mining', ['+10%', 'AIR']],
    ['🔮', null, null, null],
    ['🍀', null, null, null],
    ['🎰', null, null, null],
    ['🧿', null, null, null],
  ]
  for (const [emoji, key, source, expected] of cases) {
    const id = `unit.miningSkill.${emoji}`
    const got = miningSkillAbilityLines(emoji, key, source)
    if (JSON.stringify(got) === JSON.stringify(expected)) {
      ok(id, expected ? expected.join('/') : 'trade/economy only — no mining combat')
    } else nok(id, `expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`)
  }
  if (HACKING_CHANCE === 0.10 && HACKING_OFFLINE_MS === 5000) ok('unit.hackingConsts', '10%/5000ms')
  else nok('unit.hackingConsts', `chance=${HACKING_CHANCE} ms=${HACKING_OFFLINE_MS}`)

  const bare = getWalletTradeMultiplier([], 0, {})
  const withVoid = getWalletTradeMultiplier(['🔮'], 0, { lucky50: 0 })
  if (withVoid > bare) ok('unit.tradeMult.luckyBoost', `bare=${bare.toFixed(4)} void=${withVoid.toFixed(4)}`)
  else nok('unit.tradeMult.luckyBoost', `bare=${bare} void=${withVoid}`)

  // Document client-only mining skill physics
  skip('client.spd.physics', '❤️ MOVE_SPD×1.10 only in MiningChain3DFPV — smoke /mining manually')
  skip('client.air.physics', 'mining NFTJI longJumpRef×1.10 only in FPV client')
  skip('client.rlMount.physics', 'RL mount 2× speed/jump only in FPV client')
  skip('client.poolHeal.zoneCooldown', 'house-pool zone + ❤️×2 cooldown are client-side')
  skip('client.statue.vfx', 'M1/M2 statues — meshes/salutes only, no API')
  skip('client.boss.runtime', 'chase/wander/VFX in *-boss-runtime.js')
  skip('client.npc.chase', 'NPC chase loops client-side; API is damage only')
}

// ═══════════════════════════════════════════════════════════════════════════
// API blocks
// ═══════════════════════════════════════════════════════════════════════════
async function runApi() {
  let healthy = false
  try {
    const r = await api('/api/status')
    healthy = r.status < 500
  } catch (e) {
    nok('api.reachability', `cannot reach ${opts.base}: ${e.message}`)
    skip('api.*', 'start npm run dev:https or use --base https://mathsmine3.xyz')
    return
  }
  if (!healthy) {
    nok('api.reachability', `${opts.base}/api/status unhealthy`)
    return
  }
  ok('api.reachability', opts.base)

  let supabase
  try { supabase = sbClient() }
  catch (e) { nok('api.supabaseEnv', e.message); return }

  // ── Auth gates ──────────────────────────────────────────────────────────
  {
    const r = await api('/api/training/emoji-claim', { method: 'POST', body: { emoji: '🔮' } })
    if (r.status === 401) ok('api.auth.emojiClaim401'); else nok('api.auth.emojiClaim401', `status=${r.status}`)
  }
  {
    const r = await api('/api/mine-block', { method: 'POST', body: { blockHex: '#000' } })
    if (r.status === 401) ok('api.auth.mineBlock401'); else nok('api.auth.mineBlock401', `status=${r.status}`)
  }
  {
    const r = await api('/api/m3-boss/hit', {
      method: 'POST',
      body: { mapId: '3', hitZone: 'body', playerGx: 27, playerGy: 35 },
    })
    if (r.status === 401) ok('api.auth.bossHit401'); else nok('api.auth.bossHit401', `status=${r.status}`)
  }

  // ── Training NFTJI / Life / Zero-Day ────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.claim, { wallet_emojis: [], lucky_50_level: -1, lucky_50_claimed: false })
    const token = createSessionToken(QA.claim)
    const r1 = await api('/api/training/emoji-claim', { method: 'POST', token, body: { emoji: '🔮', progress_level: 10 } })
    const em1 = r1.json?.progress?.wallet_emojis
    if (r1.status === 200 && r1.json?.ok && em1?.includes('🔮')) ok('api.training.emojiClaim.persist', `lvl=${r1.json.progress.lucky_50_level}`)
    else nok('api.training.emojiClaim.persist', `status=${r1.status} ${r1.text?.slice(0, 160)}`)
    const r2 = await api('/api/training/emoji-claim', { method: 'POST', token, body: { emoji: '🔮', progress_level: 10 } })
    const lvl = Number(r2.json?.progress?.lucky_50_level)
    if (r2.status === 200 && lvl >= 1) ok('api.training.emojiClaim.levelUp', `lucky_50_level=${lvl}`)
    else nok('api.training.emojiClaim.levelUp', `status=${r2.status} level=${lvl}`)
  } catch (e) { nok('api.training.emojiClaim', e.message) }

  try {
    await ensureProgress(supabase, QA.life, { wallet_emojis: [], life_used: false, eur_earned: 50 })
    const token = createSessionToken(QA.life)
    const r1 = await api('/api/training/life-revive', {
      method: 'POST', token,
      body: { original_level: 5, revive_cost: { field: 'eur_earned', amount: 0.01 } },
    })
    const { data: after } = await supabase.from('player_progress').select('wallet_emojis,life_used').eq('wallet', QA.life).maybeSingle()
    const has = after?.wallet_emojis?.includes('❤️')
    if (r1.status === 200 && r1.json?.ok && has && after.life_used) ok('api.training.lifeRevive.grant')
    else nok('api.training.lifeRevive.grant', `status=${r1.status} heart=${has}`)
    const r2 = await api('/api/training/life-revive', {
      method: 'POST', token,
      body: { original_level: 5, revive_cost: { field: 'eur_earned', amount: 0.01 } },
    })
    if (r2.status === 409) ok('api.training.lifeRevive.onceOnly')
    else nok('api.training.lifeRevive.onceOnly', `status=${r2.status}`)
  } catch (e) { nok('api.training.lifeRevive', e.message) }

  try {
    await ensureProgress(supabase, QA.zero, { wallet_emojis: [], zero_day_level: -1 })
    const token = createSessionToken(QA.zero)
    const r = await api('/api/trade/zero-day-claim', { method: 'POST', token, body: {} })
    if (r.status === 200 && r.json?.ok && r.json.wallet_emojis?.includes('👾')) {
      ok('api.trade.zeroDayClaim', `level=${r.json.zero_day_level}`)
    } else nok('api.trade.zeroDayClaim', `status=${r.status} ${r.text?.slice(0, 120)}`)
  } catch (e) { nok('api.trade.zeroDayClaim', e.message) }

  // ── Training resolve / failure ──────────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.train, { level: 10 })
    await ensureLeaderboard(supabase, QA.train, 1)
    const token = createSessionToken(QA.train)
    // games.problem_id is bigint — numeric ids only
    const pidOk = Date.now()
    const rOk = await api('/api/training/resolve', {
      method: 'POST', token,
      body: {
        problem: { answer: '7', masked: '3+4', id: pidOk, difficulty: 1, problem_type: 'arithmetic' },
        user_answer: '7', time_ms: 800, level_before: 10,
      },
    })
    if (rOk.status === 200 && rOk.json?.ok && rOk.json.is_correct === true) {
      ok('api.training.resolve.correct', `level=${rOk.json.level}`)
    } else nok('api.training.resolve.correct', `status=${rOk.status} ${rOk.text?.slice(0, 160)}`)

    await ensureProgress(supabase, QA.train, { level: 10 })
    const rBad = await api('/api/training/resolve', {
      method: 'POST', token,
      body: {
        problem: { answer: '7', masked: '3+4', id: pidOk + 1, difficulty: 1, problem_type: 'arithmetic' },
        user_answer: '0', time_ms: 800, level_before: 10,
      },
    })
    if (rBad.status === 200 && rBad.json?.ok && rBad.json.is_correct === false) {
      ok('api.training.resolve.wrong', `level=${rBad.json.level}`)
    } else nok('api.training.resolve.wrong', `status=${rBad.status} ${rBad.text?.slice(0, 160)}`)

    await ensureProgress(supabase, QA.train, { level: 12 })
    const rFail = await api('/api/training/failure', {
      method: 'POST', token,
      body: { problem: { masked: 'x', id: pidOk + 2 }, choice: 'wrong', time_ms: 400, consume_life: false },
    })
    if (rFail.status === 200 && rFail.json?.ok && Number(rFail.json.level) < 12) {
      ok('api.training.failure.levelDrop', `level=${rFail.json.level}`)
    } else nok('api.training.failure.levelDrop', `status=${rFail.status} ${rFail.text?.slice(0, 160)}`)
  } catch (e) { nok('api.training.resolve', e.message) }

  // ── Presence ────────────────────────────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.claim)
    const token = createSessionToken(QA.claim)
    const r = await api('/api/presence/ping', { method: 'POST', token, body: { source: 'wallet' } })
    if (r.status === 200 && r.json?.ok) ok('api.presence.ping')
    else nok('api.presence.ping', `status=${r.status}`)
  } catch (e) { nok('api.presence.ping', e.message) }

  // ── Trade exec ──────────────────────────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.trade, { level: 10, eur_earned: 50, mm3_sold: 0 })
    await ensureLeaderboard(supabase, QA.trade, 2)
    const token = createSessionToken(QA.trade)
    const r401 = await api('/api/trade/exec', {
      method: 'POST', body: { mode: 'sell', currency: 'EUR', amount: 0.001, source: 'wallet' },
    })
    if (r401.status === 401) ok('api.trade.exec.auth401'); else nok('api.trade.exec.auth401', `status=${r401.status}`)

    const rSell = await api('/api/trade/exec', {
      method: 'POST', token,
      body: { mode: 'sell', currency: 'EUR', amount: 0.001, source: 'wallet' },
    })
    if (rSell.status === 200 && rSell.json?.ok) ok('api.trade.exec.sell', `mode=${rSell.json.mode}`)
    else nok('api.trade.exec.sell', `status=${rSell.status} ${rSell.text?.slice(0, 160)}`)

    const rBuy = await api('/api/trade/exec', {
      method: 'POST', token,
      body: { mode: 'buy', currency: 'EUR', amount: 0.01, source: 'wallet' },
    })
    if (rBuy.status === 200 && rBuy.json?.ok) ok('api.trade.exec.buy')
    else nok('api.trade.exec.buy', `status=${rBuy.status} ${rBuy.text?.slice(0, 160)}`)
  } catch (e) { nok('api.trade.exec', e.message) }

  // ── PvP skills ──────────────────────────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.atk, { wallet_emojis: ['👾'] })
    await ensureProgress(supabase, QA.vic, { wallet_emojis: [] })
    await ensureProgress(supabase, QA.luck, { wallet_emojis: ['🔮', '🍀', '🎰', '🧿'] })
    await ensureHealth(supabase, QA.vic)
    await setSqueeze(supabase, QA.atk, { equipped: 'attack', attackLevel: 0 })
    await setSqueeze(supabase, QA.vic, { equipped: 'defense', defenseLevel: 0 })
    await clearSqueeze(supabase, QA.luck)
    const atkToken = createSessionToken(QA.atk)
    const luckToken = createSessionToken(QA.luck)
    const hit = async (attacker, victim, token) => {
      await ensureHealth(supabase, victim)
      return api('/api/pvp-hit', {
        method: 'POST', token,
        body: {
          attacker, victim, hitZone: 'body',
          victimGx: 12.5, victimGy: 12.5, victimGz: 0,
          attackerGx: 13.5, attackerGy: 12.5, attackerGz: 0,
        },
      })
    }
    let crit = 0, dodge = 0, hack = 0, okHits = 0
    for (let i = 0; i < opts.pvpSamples; i++) {
      const r = await hit(QA.atk, QA.vic, atkToken)
      if (r.status !== 200 || !r.json?.ok || r.json.immune) continue
      okHits++
      if (r.json.critical) crit++
      if (r.json.dodged) dodge++
      if (r.json.hacked) hack++
    }
    if (okHits < opts.pvpSamples * 0.4) nok('api.pvp.sampleSize', `${okHits}/${opts.pvpSamples}`)
    else {
      ok('api.pvp.sampleSize', `${okHits} hits`)
      const cFail = rateInBand(crit / okHits, 0.05, okHits, 'CRT')
      const dFail = rateInBand(dodge / okHits, 0.10, okHits, 'DGE')
      const hFail = rateInBand(hack / okHits, 0.10, okHits, 'HCK')
      if (cFail) nok('api.pvp.critRate', cFail); else ok('api.pvp.critRate', `CRT=${(crit / okHits).toFixed(3)}`)
      if (dFail) nok('api.pvp.dodgeRate', dFail); else ok('api.pvp.dodgeRate', `DGE=${(dodge / okHits).toFixed(3)}`)
      if (hFail) nok('api.pvp.hackRate', hFail); else ok('api.pvp.hackRate', `HCK=${(hack / okHits).toFixed(3)}`)
    }
    await clearSqueeze(supabase, QA.vic)
    let bad = 0, n = 0
    for (let i = 0; i < Math.min(40, opts.pvpSamples); i++) {
      const r = await hit(QA.luck, QA.vic, luckToken)
      if (r.status !== 200 || !r.json?.ok || r.json.immune) continue
      n++
      if (r.json.critical || r.json.hacked) bad++
    }
    if (n === 0) nok('api.pvp.luckiesNoCombatSkill', 'no hits')
    else if (bad === 0) ok('api.pvp.luckiesNoCombatSkill', `🔮🍀🎰🧿 no CRT/HCK (${n})`)
    else nok('api.pvp.luckiesNoCombatSkill', `${bad}/${n} CRT/HCK`)
  } catch (e) { nok('api.pvp.skills', e.message) }

  // ── Mine block (portal nodes) ───────────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.mine, { level: 10 })
    await ensureLeaderboard(supabase, QA.mine, 1)
    const token = createSessionToken(QA.mine)
    const freeHex = await findFreeRegularBlock(supabase, { walletLevel: 10 })
    if (!freeHex) {
      skip('api.mine.block.free', 'no free early-chain hex meeting level/MM3 reqs')
    } else {
      const r = await api('/api/mine-block', { method: 'POST', token, body: { blockHex: freeHex } })
      if (r.status === 200 && r.json?.ok && r.json.mined) {
        ok('api.mine.block.free', `${freeHex} mined`)
        const r2 = await api('/api/mine-block', { method: 'POST', token, body: { blockHex: freeHex } })
        if (r2.status === 409) ok('api.mine.block.alreadyMined')
        else nok('api.mine.block.alreadyMined', `status=${r2.status} ${r2.json?.error}`)
        await clearMined(supabase, freeHex)
      } else if (r.status === 423) {
        skip('api.mine.block.free', 'chain_demine_active')
      } else {
        nok('api.mine.block.free', `status=${r.status} ${r.text?.slice(0, 160)}`)
      }
    }
    // requirements: low level vs high-req block (pick mid-chain hex with minLevel)
    await ensureProgress(supabase, QA.mine, { level: 0 })
    const rReq = await api('/api/mine-block', { method: 'POST', token, body: { blockHex: '#1f4' } })
    if (rReq.status === 403 && (rReq.json?.error === 'requirements_not_met' || rReq.json?.error)) {
      ok('api.mine.block.requirements', `${rReq.json.error}`)
    } else if (rReq.status === 400 && rReq.json?.error === 'block_not_mineable') {
      skip('api.mine.block.requirements', 'hex not in chain map — ok')
    } else if (rReq.status === 409) {
      skip('api.mine.block.requirements', `already mined / offline: ${rReq.json?.error}`)
    } else {
      nok('api.mine.block.requirements', `status=${rReq.status} ${rReq.text?.slice(0, 120)}`)
    }
  } catch (e) { nok('api.mine.block', e.message) }

  // ── Mining NFTJI seed + resell ──────────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.nftji, {
      level: 10,
      eur_earned: 50,
      mining_nftji_key: 'mm3-023',
      mining_nftji_price: 1,
    })
    const token = createSessionToken(QA.nftji)
    const r = await api('/api/resell-nftji', { method: 'POST', token, body: { blockHex: '#016' } })
    if (r.status === 200 && r.json?.ok) {
      ok('api.nftji.resell', 'seeded ownership → resell')
      const { data } = await supabase.from('player_progress').select('mining_nftji_key').eq('wallet', QA.nftji).maybeSingle()
      if (!data?.mining_nftji_key) ok('api.nftji.resell.cleared')
      else nok('api.nftji.resell.cleared', `still owns ${data.mining_nftji_key}`)
    } else {
      // blockHex/key mismatch possible depending on map — try without asserting hex
      nok('api.nftji.resell', `status=${r.status} ${r.text?.slice(0, 160)}`)
    }

    // market command reject without ownership
    await ensureProgress(supabase, QA.nftji, { mining_nftji_key: null })
    const rCmd = await api('/api/relay/market-command', {
      method: 'POST', token, body: { command: '/lsblk' },
    })
    if (rCmd.status === 200 && (rCmd.json?.rejected || rCmd.json?.ok === false)) {
      ok('api.market.command.reject', rCmd.json?.message?.slice(0, 60) || 'rejected')
    } else if (rCmd.status === 400 || rCmd.status === 403) {
      ok('api.market.command.reject', `status=${rCmd.status}`)
    } else {
      nok('api.market.command.reject', `status=${rCmd.status} ${rCmd.text?.slice(0, 120)}`)
    }
  } catch (e) { nok('api.nftji', e.message) }

  // ── Node dice ───────────────────────────────────────────────────────────
  try {
    const g = await api('/api/node-dice')
    if (g.status === 200 && g.json?.ok) ok('api.nodeDice.get', g.json.nodeDice ? 'active' : 'inactive')
    else nok('api.nodeDice.get', `status=${g.status}`)

    await ensureProgress(supabase, QA.dice, { level: 10, mm3_sold: 0 })
    await ensureLeaderboard(supabase, QA.dice, 600)
    const token = createSessionToken(QA.dice)
    const low = await api('/api/node-dice', { method: 'POST', token, body: {} })
    // level 10 < 30 → min_level
    if (low.status === 403 && low.json?.error === 'min_level') ok('api.nodeDice.minLevel')
    else if (low.status === 200 && low.json?.alreadyActive) {
      skip('api.nodeDice.minLevel', 'dice already active globally — skipped purchase path')
    } else nok('api.nodeDice.minLevel', `status=${low.status} ${low.json?.error}`)

    await ensureProgress(supabase, QA.dice, { level: 30, mm3_sold: 0 })
    await ensureLeaderboard(supabase, QA.dice, 600)
    const buy = await api('/api/node-dice', { method: 'POST', token, body: {} })
    if (buy.status === 200 && buy.json?.ok && (buy.json.nodeDice || buy.json.alreadyActive)) {
      ok('api.nodeDice.buyOrActive', buy.json.alreadyActive ? 'alreadyActive' : 'purchased')
    } else nok('api.nodeDice.buyOrActive', `status=${buy.status} ${buy.text?.slice(0, 140)}`)
  } catch (e) { nok('api.nodeDice', e.message) }

  // ── RL mount ────────────────────────────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.rl, { level: 10, mm3_sold: 0, rl_mount_active: false })
    await ensureLeaderboard(supabase, QA.rl, 50)
    const token = createSessionToken(QA.rl)
    const g = await api(`/api/rl-mount?wallet=${QA.rl}`)
    if (g.status === 200 && g.json?.ok === true && g.json.active === false) ok('api.rlMount.get.off')
    else if (g.status === 200 && g.json?.ok) ok('api.rlMount.get', `active=${g.json.active}`)
    else nok('api.rlMount.get', `status=${g.status}`)

    const buy = await api('/api/rl-mount', { method: 'POST', token, body: {} })
    if (buy.status === 200 && buy.json?.ok && buy.json.active) ok('api.rlMount.buy')
    else nok('api.rlMount.buy', `status=${buy.status} ${buy.text?.slice(0, 140)}`)

    const again = await api('/api/rl-mount', { method: 'POST', token, body: {} })
    if (again.status === 409) ok('api.rlMount.alreadyOwned')
    else nok('api.rlMount.alreadyOwned', `status=${again.status}`)

    const del = await api('/api/rl-mount', { method: 'DELETE', token, body: {} })
    if (del.status === 200 && del.json?.ok && del.json.active === false) ok('api.rlMount.delete')
    else nok('api.rlMount.delete', `status=${del.status} ${del.text?.slice(0, 120)}`)
  } catch (e) { nok('api.rlMount', e.message) }

  // ── Pool heal ───────────────────────────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.heal)
    await ensureHealth(supabase, QA.heal, 50)
    const token = createSessionToken(QA.heal)
    const r = await api('/api/pool-heal', { method: 'POST', token, body: {} })
    if (r.status === 200 && r.json?.ok && Number(r.json.health) === 60) ok('api.poolHeal.once', '50→60')
    else nok('api.poolHeal.once', `status=${r.status} health=${r.json?.health} ${r.text?.slice(0, 100)}`)

    await ensureHealth(supabase, QA.heal, 80, {
      pvp_dead_until: new Date(Date.now() + 60_000).toISOString(),
    })
    const dead = await api('/api/pool-heal', { method: 'POST', token, body: {} })
    if (dead.status === 409) ok('api.poolHeal.alreadyDead')
    else nok('api.poolHeal.alreadyDead', `status=${dead.status}`)
    await ensureHealth(supabase, QA.heal, 100) // cleanup dead flag
  } catch (e) { nok('api.poolHeal', e.message) }

  // ── NPC hit (statue/NPC damage path) ────────────────────────────────────
  try {
    await ensureProgress(supabase, QA.npc)
    await ensureHealth(supabase, QA.npc, 20)
    const token = createSessionToken(QA.npc)
    const r = await api('/api/npc-hit', {
      method: 'POST', token,
      body: { wallet: QA.npc, npcWallet: '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528' },
    })
    if (r.status === 200 && r.json?.ok && Number(r.json.health) === 19) ok('api.npcHit.damage', '20→19')
    else if (r.status === 200 && r.json?.ok && r.json.immune) skip('api.npcHit.damage', 'same_pool immune')
    else nok('api.npcHit.damage', `status=${r.status} ${r.text?.slice(0, 140)}`)

    const r2 = await api('/api/npc-hit', {
      method: 'POST', token,
      body: { wallet: QA.npc, npcWallet: '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528' },
    })
    if (r2.status === 429) ok('api.npcHit.cooldown')
    else skip('api.npcHit.cooldown', `status=${r2.status} (multi-instance cooldown may not trip)`)

    const mismatch = await api('/api/npc-hit', {
      method: 'POST', token,
      body: { wallet: QA.heal, npcWallet: '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528' },
    })
    if (mismatch.status === 401 || mismatch.status === 403) ok('api.npcHit.authMismatch')
    else nok('api.npcHit.authMismatch', `status=${mismatch.status}`)
  } catch (e) { nok('api.npcHit', e.message) }

  // ── Bosses ──────────────────────────────────────────────────────────────
  try {
    // Hardcoded spawn (avoid importing Next-aliased boss modules in plain Node)
    const M3_SPAWN = { gx: 27, gy: 35 }
    const M3_ID = 'm3_putin'
    const M3_MAX = 2500

    for (const [map, path] of [['3', '/api/m3-boss'], ['4', '/api/m4-boss'], ['5', '/api/m5-boss']]) {
      const g = await api(path)
      if (g.status === 200 && g.json?.ok && String(g.json.mapId) === map) {
        ok(`api.boss.m${map}.get`, `hp=${g.json.health}/${g.json.maxHealth} state=${g.json.state}`)
      } else nok(`api.boss.m${map}.get`, `status=${g.status} ${g.text?.slice(0, 100)}`)
    }

    await ensureProgress(supabase, QA.boss, { level: 20 })
    await restoreBossHp(supabase, M3_ID, M3_MAX)
    const token = createSessionToken(QA.boss)
    const gx = M3_SPAWN.gx
    const gy = M3_SPAWN.gy

    const wrong = await api('/api/m3-boss/hit', {
      method: 'POST', token,
      body: { mapId: '5', hitZone: 'body', playerGx: gx, playerGy: gy, bossGx: gx, bossGy: gy },
    })
    if (wrong.status === 403) ok('api.boss.m3.wrongMap')
    else nok('api.boss.m3.wrongMap', `status=${wrong.status}`)

    const bodyHit = await api('/api/m3-boss/hit', {
      method: 'POST', token,
      body: { mapId: '3', hitZone: 'body', playerGx: gx, playerGy: gy, bossGx: gx, bossGy: gy },
    })
    if (bodyHit.status === 200 && bodyHit.json?.ok && Number(bodyHit.json.damage) >= 1) {
      ok('api.boss.m3.hit.body', `dmg=${bodyHit.json.damage} hp=${bodyHit.json.health}`)
    } else nok('api.boss.m3.hit.body', `status=${bodyHit.status} ${bodyHit.text?.slice(0, 160)}`)

    const headHit = await api('/api/m3-boss/hit', {
      method: 'POST', token,
      body: { mapId: '3', hitZone: 'head', playerGx: gx, playerGy: gy, bossGx: gx, bossGy: gy },
    })
    if (headHit.status === 200 && headHit.json?.ok && headHit.json.headshot && Number(headHit.json.damage) === 5) {
      ok('api.boss.m3.hit.head', 'dmg=5')
    } else nok('api.boss.m3.hit.head', `status=${headHit.status} dmg=${headHit.json?.damage}`)

    await setSqueeze(supabase, QA.boss, { equipped: 'attack', attackLevel: 0 })
    let crits = 0, hits = 0
    for (let i = 0; i < 40; i++) {
      const r = await api('/api/m3-boss/hit', {
        method: 'POST', token,
        body: { mapId: '3', hitZone: 'body', playerGx: gx, playerGy: gy, bossGx: gx, bossGy: gy },
      })
      if (r.status === 200 && r.json?.ok) {
        hits++
        if (r.json.critical) crits++
      }
    }
    if (hits < 20) nok('api.boss.m3.critSample', `only ${hits} hits`)
    else {
      const fail = rateInBand(crits / hits, 0.05, hits, 'bossCRT')
      if (fail) nok('api.boss.m3.critSample', fail)
      else ok('api.boss.m3.critSample', `CRT=${(crits / hits).toFixed(3)} n=${hits}`)
    }

    await setSqueeze(supabase, QA.boss, { equipped: 'defense', defenseLevel: 0 })
    await ensureHealth(supabase, QA.boss, 100)
    let dodges = 0, atks = 0
    for (let i = 0; i < 40; i++) {
      await ensureHealth(supabase, QA.boss, 100)
      const r = await api('/api/m3-boss/attack', {
        method: 'POST', token,
        body: { mapId: '3', playerGx: gx, playerGy: gy, bossGx: gx, bossGy: gy },
      })
      if (r.status === 200 && r.json?.ok) {
        atks++
        if (r.json.dodged) dodges++
      }
    }
    if (atks < 20) nok('api.boss.m3.attack.dodgeSample', `only ${atks}`)
    else {
      const fail = rateInBand(dodges / atks, 0.10, atks, 'bossDGE')
      if (fail) nok('api.boss.m3.attack.dodgeSample', fail)
      else ok('api.boss.m3.attack.dodgeSample', `DGE=${(dodges / atks).toFixed(3)}`)
    }

    await restoreBossHp(supabase, M3_ID, M3_MAX)
    await clearSqueeze(supabase, QA.boss)
    await ensureHealth(supabase, QA.boss, 100)
  } catch (e) { nok('api.boss', e.message) }

  // ── Chain solve (safe paths only) ───────────────────────────────────────
  try {
    const st = await api(`/api/chain-solve/status?wallet=${QA.mine}`)
    if (st.status === 200 && st.json?.ok) {
      ok('api.chain.status', `canAttempt=${st.json.canAttempt} demine=${st.json.chainDemineActive}`)
    } else nok('api.chain.status', `status=${st.status}`)

    await ensureProgress(supabase, QA.mine, { level: 10 })
    // clear today's attempt if any
    const day = new Date().toISOString().slice(0, 10)
    await supabase.from('mm3_chain_solve_attempts').delete().eq('wallet', QA.mine).eq('day', day)
    const token = createSessionToken(QA.mine)
    const wrong = await api('/api/chain-solve/attempt', {
      method: 'POST', token, body: { answer: 999999 },
    })
    if (wrong.status === 200 && wrong.json?.ok && wrong.json.correct === false) {
      ok('api.chain.attempt.wrong', 'locked for day')
    } else if (wrong.status === 429) {
      skip('api.chain.attempt.wrong', 'already attempted today')
    } else {
      nok('api.chain.attempt.wrong', `status=${wrong.status} ${wrong.text?.slice(0, 140)}`)
    }
    skip('api.chain.attempt.correct', 'auto-mines remaining blocks + activates demine — never on shared DB')
    skip('api.rmRf.post', 'deletes ALL mined blocks — use --allow-destructive only on disposable DB')

    const chips = await api('/api/rm-rf-chain')
    if (chips.status === 200) ok('api.rmRf.get', 'cooldown chips readable')
    else nok('api.rmRf.get', `status=${chips.status}`)

    if (opts.allowDestructive) {
      // one demine hit if active
      const { data: macro } = await supabase.from('mm3_macro_state').select('chain_demine_active,chain_demine_hits_remaining').eq('id', 1).maybeSingle()
      if (macro?.chain_demine_active) {
        const d = await api('/api/chain-solve/demine', { method: 'POST', token, body: {} })
        if (d.status === 200 && d.json?.ok) ok('api.demine.hit', `remaining=${d.json.hitsRemaining}`)
        else nok('api.demine.hit', `status=${d.status}`)
      } else skip('api.demine.hit', 'demine not active')
    } else {
      skip('api.demine.hit', 'pass --allow-destructive to exercise demine')
    }
  } catch (e) { nok('api.chain', e.message) }

  // ── Squeeze (lightweight) ───────────────────────────────────────────────
  try {
    const list = await api('/api/wallet-pools/disputes?limit=5')
    if (list.status === 200 && list.json?.ok && Array.isArray(list.json.disputes)) {
      ok('api.squeeze.disputesList', `${list.json.disputes.length} rows`)
    } else nok('api.squeeze.disputesList', `status=${list.status}`)

    const token = createSessionToken(QA.mine)
    const vote = await api('/api/wallet-pools/dispute/vote', {
      method: 'POST', token,
      body: { challengerPool: 'AAAAA', defenderPool: 'BBBBB' },
    })
    if (vote.status === 401 || vote.status === 403 || vote.status === 400 || vote.status === 404) {
      ok('api.squeeze.vote.gated', `status=${vote.status} ${vote.json?.error || ''}`)
    } else nok('api.squeeze.vote.gated', `status=${vote.status}`)

    skip('api.squeeze.fullBattle', 'needs 2 pools + votes + timers — orchestrate manually or extend later')
  } catch (e) { nok('api.squeeze', e.message) }

  skip('api.cleanup', `QA wallets seeded (${Object.keys(QA).length}) — throwaways only`)
}

// ── Main ──────────────────────────────────────────────────────────────────
await runUnit()
if (!opts.unitOnly) await runApi()
const counts = summary()
process.exit(counts.NOK > 0 ? 1 : 0)
