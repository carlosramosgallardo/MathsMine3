import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { applyRigidBipedGait, mountRigidBipedLimbs } from './rigid-biped-limbs.js'

test('rigid biped split mounts four articulated limb pivots without skinning', () => {
  const bodyPivot = new THREE.Group()
  const fit = new THREE.Group()
  const clone = new THREE.Group()
  bodyPivot.add(fit)
  fit.add(clone)
  const material = new THREE.MeshBasicMaterial()
  for (const [x, y, sx, sy] of [
    [0, 1.25, 0.7, 1.1],
    [-0.48, 1.3, 0.22, 0.8], [0.48, 1.3, 0.22, 0.8],
    [-0.2, 0.4, 0.25, 0.8], [0.2, 0.4, 0.25, 0.8],
  ]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.3), material)
    mesh.position.set(x, y, 0)
    clone.add(mesh)
  }
  clone.updateMatrixWorld(true)
  const limbs = mountRigidBipedLimbs(THREE, bodyPivot, fit, clone)
  assert.deepEqual(Object.keys(limbs).sort(), ['leftArm', 'leftLeg', 'rightArm', 'rightLeg'])
  assert.equal(bodyPivot.userData.rigidBipedLimbs, limbs)
})

test('rigid gait moves opposite arms and legs while leaving geometry rigid', () => {
  const makeLimb = () => ({ rotation: { x: 0 }, position: { y: 1 }, userData: { baseY: 1 } })
  const limbs = {
    leftArm: makeLimb(), rightArm: makeLimb(), leftLeg: makeLimb(), rightLeg: makeLimb(),
  }
  const bodyPivot = { userData: { rigidBipedLimbs: limbs } }
  assert.equal(applyRigidBipedGait(bodyPivot, Math.PI / 2, 1), true)
  assert.ok(limbs.leftLeg.rotation.x > 0)
  assert.ok(limbs.rightLeg.rotation.x < 0)
  assert.ok(limbs.leftArm.rotation.x < 0)
  assert.ok(limbs.rightArm.rotation.x > 0)
})
