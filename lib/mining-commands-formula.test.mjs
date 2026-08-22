import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateArithmetic, evaluateMarketFormula } from './mining-commands.js'

test('evaluateArithmetic matches basic market formulas', () => {
  assert.equal(evaluateArithmetic('1+2*3'), 7)
  assert.equal(evaluateArithmetic('(5*(4000+1))+(12*(300+1))+((6000+3*1)/3)'), 5 * 4001 + 12 * 301 + (6003 / 3))
  assert.equal(evaluateArithmetic('22222%999'), 22222 % 999)
  assert.ok(Math.abs(evaluateArithmetic('log10(100)') - 2) < 1e-12)
})

test('evaluateMarketFormula substitutes x and rejects letters', () => {
  assert.equal(evaluateMarketFormula('/cmd => 10 + x = ?', 3), 13)
  assert.equal(evaluateMarketFormula('/ping -c 4 gateway.mainframe', 1), 0)
})
