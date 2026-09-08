import test from 'node:test'
import assert from 'node:assert/strict'
import { findBossAttack, selectBossAttack } from './boss-attack-selection.js'

const attacks = [
  { id: 'low', weight: 50 },
  { id: 'medium', weight: 32 },
  { id: 'high', weight: 18 },
]

test('selectBossAttack follows the configured weighted boundaries', () => {
  assert.equal(selectBossAttack(attacks, 0).id, 'low')
  assert.equal(selectBossAttack(attacks, 0.4999).id, 'low')
  assert.equal(selectBossAttack(attacks, 0.5).id, 'medium')
  assert.equal(selectBossAttack(attacks, 0.8199).id, 'medium')
  assert.equal(selectBossAttack(attacks, 0.82).id, 'high')
  assert.equal(selectBossAttack(attacks, 0.9999).id, 'high')
})

test('findBossAttack only accepts a configured attack id', () => {
  assert.equal(findBossAttack(attacks, 'medium'), attacks[1])
  assert.equal(findBossAttack(attacks, 'forged'), null)
})
