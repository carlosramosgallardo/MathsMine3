import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { findBossAttack, selectBossAttack } from './boss-attack-selection.js'

// Execute the real handler with isolated auth/RNG/database dependencies.
const source = readFileSync(new URL('./boss-api-handlers.js', import.meta.url), 'utf8')
  .replace(/^import .*\n/gm, '').replaceAll('export ', '')
const attacks = [
  { id: 'jab', tier: 'low', damage: 12, weight: 50 },
  { id: 'hook', tier: 'medium', damage: 18, weight: 32 },
  { id: 'kick', tier: 'high', damage: 26, weight: 18 },
]
async function requestAttack(attackId, { wallet = 'test-wallet', mapId = '3', x = 10 } = {}) {
  const calls = []
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    rpc: async (name, args) => { calls.push({ name, args }); return { data: { health: 74 } } },
  }
  const context = vm.createContext({
    Response, process: { env: {} }, createClient: () => db,
    walletFromRequest: () => wallet, randomInt: () => 900_000,
    isStormActive: async () => false, applyDeathLevelPenalty: async () => {},
    findBossAttack, selectBossAttack,
  })
  vm.runInContext(source, context)
  const response = await context.handleBossAttack({ json: async () => ({
    attackId, mapId, playerGx: x, playerGy: 10, bossGx: 10, bossGy: 10,
  }) }, { mapId: '3', bossId: 'putin', attackRangeServer: 3, attacks, isBossPositionValid: () => true })
  return { status: response.status, body: await response.json(), calls }
}

test('client cannot force low damage: server RNG selects the authoritative attack', async () => {
  const result = await requestAttack('jab')
  assert.equal(result.status, 200)
  assert.equal(result.body.attackId, 'kick')
  assert.equal(result.body.damage, 26)
  assert.equal(result.calls[0].args.p_damage, 26)
})

test('older clients without an attack ID receive a server-selected attack', async () => {
  assert.equal((await requestAttack()).body.attackId, 'kick')
})

test('invalid attacks, unauthenticated, wrong-map and distant requests never reach damage RPC', async () => {
  for (const [id, options, status] of [
    ['forged', {}, 400], ['jab', { wallet: null }, 401],
    ['jab', { mapId: '4' }, 403], ['jab', { x: 100 }, 400],
  ]) {
    const result = await requestAttack(id, options)
    assert.equal(result.status, status)
    assert.equal(result.calls.length, 0)
  }
})
