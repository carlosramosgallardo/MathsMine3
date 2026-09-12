import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { addRetroCar, addRetroLedger, addRetroCrawler, addRetroHead, addRetroNukePanels } from './mining-retro-props.js'
import { onRlCarImageReady } from './rl-badge.js'

test('retro props build immediately without textures or model requests', () => {
  for (const build of [addRetroCar, addRetroLedger, addRetroCrawler, addRetroHead, addRetroNukePanels]) {
    const root = new THREE.Group()
    build(THREE, root)
    let triangles = 0
    root.traverse(object => {
      if (!object.isMesh) return
      assert.equal(object.material.map, null)
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
    })
    assert.ok(triangles > 0 && triangles < 300)
    assert.ok(new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).length() < 2)
  }
})

test('retro actors expose the readiness flags used by existing gameplay', () => {
  const car = new THREE.Group(), ledger = new THREE.Group(), crawler = new THREE.Group()
  addRetroCar(THREE, car); addRetroLedger(THREE, ledger); addRetroCrawler(THREE, crawler)
  assert.equal(car.userData.rlCarModelAttached, true)
  assert.equal(ledger.userData.ledgerReady, true)
  assert.equal(crawler.userData.quadruped, true)
  const bounds = new THREE.Box3().setFromObject(crawler)
  assert.ok(Math.abs(bounds.max.y - 1.075) < .005)
})

test('RL badge is ready synchronously without WebGL initialization', () => {
  let ready = false
  onRlCarImageReady(() => { ready = true })
  assert.equal(ready, true)
})
