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

// The stand-ins are placeholders for the pixel-art GLB tier: each builder
// returns what it added so the caller can retire exactly that on arrival, and
// none of them claims the "model attached/ready" flags — those belong to the
// GLB (a placeholder that set rlCarModelAttached would make attachRlCarModel
// skip the real car). Trump's quadruped tag is the exception: motion reads it
// from the first frame, GLB or not.
test('retro stand-ins hand back their meshes and leave readiness to the GLB', () => {
  const car = new THREE.Group(), ledger = new THREE.Group(), crawler = new THREE.Group(), nuke = new THREE.Group()
  const carRoot = addRetroCar(THREE, car)
  const ledgerFit = addRetroLedger(THREE, ledger)
  const crawlerMeshes = addRetroCrawler(THREE, crawler)
  const nukeMeshes = addRetroNukePanels(THREE, nuke)
  assert.equal(carRoot.parent, car)
  assert.equal(ledgerFit.parent, ledger)
  assert.ok(crawlerMeshes.length > 0 && crawlerMeshes.every(m => m.parent === crawler))
  assert.ok(nukeMeshes.length > 0 && nukeMeshes.every(m => m.parent === nuke))
  assert.equal(car.userData.rlCarModelAttached, undefined)
  assert.equal(ledger.userData.ledgerReady, undefined)
  assert.equal(crawler.userData.quadruped, true)
  const bounds = new THREE.Box3().setFromObject(crawler)
  assert.ok(Math.abs(bounds.max.y - 1.075) < .005)
})

test('RL badge is ready synchronously without WebGL initialization', () => {
  let ready = false
  onRlCarImageReady(() => { ready = true })
  assert.equal(ready, true)
})
