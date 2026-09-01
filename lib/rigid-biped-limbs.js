import { bakeMeshIntoParent, splitRigidLimbGeometry } from './rigid-limb-split.js'

export const RIGID_BIPED_LIMB_IDS = Object.freeze(['leftArm', 'rightArm', 'leftLeg', 'rightLeg'])

function classifyStandingVertex(bounds, x, y) {
  const h = Math.max(0.001, bounds.max.y - bounds.min.y)
  const w = Math.max(0.001, bounds.max.x - bounds.min.x)
  const cx = (bounds.min.x + bounds.max.x) * 0.5
  const yn = (y - bounds.min.y) / h
  const side = x < cx ? 'left' : 'right'
  if (yn < 0.49 && Math.abs(x - cx) > w * 0.025) return `${side}Leg`
  if (yn > 0.39 && yn < 0.84 && Math.abs(x - cx) > w * 0.17) return `${side}Arm`
  return 'torso'
}

function standingJoints(bounds) {
  const h = Math.max(0.001, bounds.max.y - bounds.min.y)
  const w = Math.max(0.001, bounds.max.x - bounds.min.x)
  const cx = (bounds.min.x + bounds.max.x) * 0.5
  const cz = (bounds.min.z + bounds.max.z) * 0.5
  return {
    leftArm: { x: cx - w * 0.19, y: bounds.min.y + h * 0.73, z: cz },
    rightArm: { x: cx + w * 0.19, y: bounds.min.y + h * 0.73, z: cz },
    leftLeg: { x: cx - w * 0.09, y: bounds.min.y + h * 0.48, z: cz },
    rightLeg: { x: cx + w * 0.09, y: bounds.min.y + h * 0.48, z: cz },
  }
}

function shiftGeometryToJoint(geometry, joint) {
  const pos = geometry.attributes.position
  for (let index = 0; index < pos.count; index += 1) {
    pos.setXYZ(index, pos.getX(index) - joint.x, pos.getY(index) - joint.y, pos.getZ(index) - joint.z)
  }
  pos.needsUpdate = true
  geometry.computeBoundingSphere()
}

/**
 * Converts a non-skinned standing GLB into rigid torso/limb shells. Clothing
 * never stretches: every triangle remains unchanged and moves with one pivot.
 */
export function mountRigidBipedLimbs(THREE, bodyPivot, fit, clone) {
  if (!THREE || !bodyPivot || !fit || !clone || bodyPivot.userData.rigidBipedLimbs) return null
  const sources = []
  clone.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position || object.isSkinnedMesh) return
    sources.push({
      mesh: object,
      geometry: bakeMeshIntoParent(THREE, fit, object),
      material: object.material,
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
    })
  })
  if (!sources.length) return null

  const bounds = new THREE.Box3()
  for (const source of sources) {
    source.geometry.computeBoundingBox()
    if (source.geometry.boundingBox) bounds.union(source.geometry.boundingBox)
  }
  if (bounds.isEmpty()) return null

  const joints = standingJoints(bounds)
  const pivots = {}
  for (const id of RIGID_BIPED_LIMB_IDS) {
    const pivot = new THREE.Group()
    const joint = joints[id]
    pivot.name = `rigidBiped_${id}`
    pivot.position.set(joint.x, joint.y, joint.z)
    pivot.userData.baseY = joint.y
    fit.add(pivot)
    pivots[id] = pivot
  }

  let torsoCount = 0
  for (const source of sources) {
    const geometry = source.geometry
    const parts = splitRigidLimbGeometry(THREE, geometry, {
      partIds: ['torso', ...RIGID_BIPED_LIMB_IDS],
      classify: (x, y) => classifyStandingVertex(bounds, x, y),
      withColor: Boolean(geometry.attributes.color),
      withUv: Boolean(geometry.attributes.uv),
    })
    geometry.dispose()
    if (!parts) continue
    for (const [id, partGeometry] of Object.entries(parts)) {
      if (!partGeometry) continue
      const mesh = new THREE.Mesh(partGeometry, source.material)
      mesh.name = `rigidBipedMesh_${id}`
      mesh.frustumCulled = false
      mesh.castShadow = source.castShadow
      mesh.receiveShadow = source.receiveShadow
      if (id === 'torso') {
        fit.add(mesh)
        torsoCount += 1
      } else {
        shiftGeometryToJoint(partGeometry, joints[id])
        pivots[id].add(mesh)
      }
    }
    source.mesh.removeFromParent()
  }
  if (!torsoCount) return null
  bodyPivot.userData.rigidBipedLimbs = pivots
  bodyPivot.userData.rigidBipedJoints = joints
  return pivots
}

/** Rigid, low-amplitude human gait: visible motion without opening garment seams. */
export function applyRigidBipedGait(bodyPivot, phase = 0, amount = 0, { armScale = 0.9 } = {}) {
  const limbs = bodyPivot?.userData?.rigidBipedLimbs
  if (!limbs) return false
  const gain = Math.max(0, Math.min(1, Number(amount) || 0))
  const swing = Math.sin(Number(phase) || 0)
  // Roughly ±28° legs / ±24° arms at full gain: obvious on trailer-wide
  // shots, but still restrained enough that rigid garment seams stay closed.
  const legPitch = swing * 0.49 * gain
  const armPitch = swing * 0.42 * gain * armScale
  limbs.leftLeg.rotation.x = legPitch
  limbs.rightLeg.rotation.x = -legPitch
  limbs.leftArm.rotation.x = -armPitch
  limbs.rightArm.rotation.x = armPitch
  const lift = Math.max(0, swing) * 0.045 * gain
  const oppositeLift = Math.max(0, -swing) * 0.045 * gain
  limbs.leftLeg.position.y = limbs.leftLeg.userData.baseY + lift
  limbs.rightLeg.position.y = limbs.rightLeg.userData.baseY + oppositeLift
  return true
}
