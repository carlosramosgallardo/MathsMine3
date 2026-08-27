import test from 'node:test'
import assert from 'node:assert/strict'
import {
  holdMileiChainsaw,
  releaseMileiChainsaw,
  stopMileiChainsawLoop,
  mileiChainsawHoldCount,
  syncMileiPatrolChainsaw,
} from './milei-chainsaw-audio.js'

test('chainsaw holds keep the loop until every reason is released', () => {
  stopMileiChainsawLoop()
  holdMileiChainsaw('walk')
  holdMileiChainsaw('tip')
  assert.equal(mileiChainsawHoldCount(), 2)
  releaseMileiChainsaw('tip')
  assert.equal(mileiChainsawHoldCount(), 1)
  releaseMileiChainsaw('walk')
  assert.equal(mileiChainsawHoldCount(), 0)
})

test('closing the tip does not kill a walking chainsaw', () => {
  stopMileiChainsawLoop()
  holdMileiChainsaw('walk')
  holdMileiChainsaw('tip')
  releaseMileiChainsaw('tip')
  releaseMileiChainsaw('hit')
  assert.equal(mileiChainsawHoldCount(), 1)
  stopMileiChainsawLoop()
})

test('patrol sync holds while walking and releases at the plinth', () => {
  stopMileiChainsawLoop()
  const motion = {
    patrol: { phase: 'walking' },
    root: { position: { x: 10, z: 10 } },
  }
  syncMileiPatrolChainsaw(motion, 10, 10)
  assert.equal(mileiChainsawHoldCount(), 1)
  motion.patrol.phase = 'idle'
  syncMileiPatrolChainsaw(motion, 10, 10)
  assert.equal(mileiChainsawHoldCount(), 0)
})
