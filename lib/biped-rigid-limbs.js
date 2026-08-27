/**
 * Rigid biped limb shells for textured / sculpt GLBs with no skeleton
 * (Putin, Kim, Milei, Zelensky, Macron).
 *
 * Capsule drivers already swing arms/legs; the suit stays A-pose unless we
 * carve it into torso + four rigid shells and parent those to the capsules.
 */

import {
  bakeMeshIntoParent,
  reparentGeometry,
  splitRigidLimbGeometry,
} from './rigid-limb-split.js'

export const BIPED_LIMB_IDS = Object.freeze(['la', 'ra', 'll', 'rl'])

/** Planted fit-local thresholds (feet y=0, crown ≈ 1.075). */
export const PUTIN_BIPED_PROFILE = Object.freeze({
  torsoY: 0.78,
  armLo: 0.38,
  armHi: 0.95,
  armX: 0.17,
  legHi: 0.50,
  legX: 0.045,
})

/** Softer arm cut for bulkier coats (Kim / Milei). */
export const COAT_BIPED_PROFILE = Object.freeze({
  ...PUTIN_BIPED_PROFILE,
  armX: 0.14,
  legX: 0.04,
})

export function classifyStandingBipedVertex(x, y, profile = PUTIN_BIPED_PROFILE) {
  if (y > profile.torsoY) return 'torso'
  if (y > profile.armLo && y < profile.armHi && Math.abs(x) > profile.armX) {
    return x < 0 ? 'la' : 'ra'
  }
  if (y < profile.legHi && Math.abs(x) > profile.legX) {
    return x < 0 ? 'll' : 'rl'
  }
  return 'torso'
}

export function splitBipedGeometry(THREE, geometry, classifyFn) {
  const classify = classifyFn || ((x, y) => classifyStandingBipedVertex(x, y))
  return splitRigidLimbGeometry(THREE, geometry, {
    partIds: ['torso', ...BIPED_LIMB_IDS],
    classify: (x, y, z) => classify(x, y, z),
    withUv: true,
    withColor: Boolean(geometry?.attributes?.color),
  })
}

function addLimbShell(THREE, host, geo, mesh, id) {
  const shell = new THREE.Mesh(geo, mesh.material)
  shell.name = `biped_${id}_${mesh.name || 'mesh'}`
  shell.frustumCulled = false
  shell.castShadow = mesh.castShadow
  shell.receiveShadow = mesh.receiveShadow
  shell.renderOrder = mesh.renderOrder
  host.add(shell)
  return shell
}

/**
 * Carve every mesh under statue/quadruped fit into torso + limb shells and
 * parent limb shells to the invisible capsule arm/leg pivots.
 */
export function mountBipedLimbsOnCapsules(THREE, bodyPivot, {
  profile = PUTIN_BIPED_PROFILE,
  classify = null,
} = {}) {
  if (!THREE || !bodyPivot) return null
  const fit = bodyPivot.userData.statueGlbFit || bodyPivot.userData.quadrupedGlbFit
  const arms = bodyPivot.userData.humanArms
  const legs = bodyPivot.userData.humanLegs
  if (!fit || !arms?.[0] || !arms?.[1] || !legs?.[0] || !legs?.[1]) return null
  if (bodyPivot.userData.bipedLimbsMounted) return bodyPivot.userData.bipedLimbs

  const classifyFn = classify || ((x, y) => classifyStandingBipedVertex(x, y, profile))
  const targets = {
    torso: fit,
    la: arms[0],
    ra: arms[1],
    ll: legs[0],
    rl: legs[1],
  }

  const sourceMeshes = []
  fit.traverse((obj) => {
    if (obj.isMesh && obj.geometry) sourceMeshes.push(obj)
  })
  if (!sourceMeshes.length) return null

  const mounted = { torso: [], la: [], ra: [], ll: [], rl: [] }
  bodyPivot.updateMatrixWorld(true)

  for (const mesh of sourceMeshes) {
    const baked = bakeMeshIntoParent(THREE, bodyPivot, mesh)
    const parts = splitBipedGeometry(THREE, baked, classifyFn)
    baked.dispose()
    if (!parts) continue
    mesh.visible = false

    for (const id of ['torso', ...BIPED_LIMB_IDS]) {
      const geo = parts[id]
      if (!geo) continue
      const host = targets[id]
      if (id !== 'torso') reparentGeometry(THREE, geo, bodyPivot, host)
      mounted[id].push(addLimbShell(THREE, host, geo, mesh, id))
    }
  }

  bodyPivot.userData.bipedLimbs = mounted
  bodyPivot.userData.bipedLimbsMounted = true
  const flashMeshes = []
  for (const id of ['torso', ...BIPED_LIMB_IDS]) flashMeshes.push(...mounted[id])
  bodyPivot.userData.quadrupedGlbMeshes = flashMeshes
  return mounted
}
