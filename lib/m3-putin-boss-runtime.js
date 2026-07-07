import {
  M3_PUTIN_BOSS_ATTACK_COOLDOWN_MS,
  M3_PUTIN_BOSS_ATTACK_RANGE,
  M3_PUTIN_BOSS_ENGAGE_DELAY_MS,
  M3_PUTIN_BOSS_HIT_RANGE,
  M3_PUTIN_BOSS_IDLE_FACING,
  M3_PUTIN_BOSS_SCALE,
  M3_PUTIN_BOSS_SPEED_MULT,
  M3_PUTIN_BOSS_SPAWN,
  M3_PUTIN_HEAD_TEXTURE_URL,
} from './m3-putin-boss'
import { attachBossHeadPhoto } from './boss-head-photo'
import { bossFacingFromDelta } from './map-boss-facing'

const MOVE_SPD = 47

function bossMaterial(THREE, color, lowDetail, roughness = 0.5, metalness = 0.28) {
  if (lowDetail) {
    return new THREE.MeshLambertMaterial({
      color,
      emissive: new THREE.Color(color).multiplyScalar(0.06),
    })
  }
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

/** Voxel Putin — shirtless torso, camo pants, Russian armband. */
export function createM3PutinBossVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'm3PutinBoss'
  group.userData.m3PutinBoss = true

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm3PutinBossBody'
  group.add(bodyPivot)

  const mat = (color, roughness, metalness) => bossMaterial(THREE, color, lowDetail, roughness, metalness)
  const basic = (color) => new THREE.MeshBasicMaterial({ color })

  const skinMat = mat('#e8c4a8', 0.62, 0.08)
  const skinBright = mat('#f4d4bc', 0.55, 0.06)
  const camoGreen = mat('#3d5c2a', 0.72, 0.12)
  const camoBrown = mat('#5c4a32', 0.74, 0.1)
  const camoDark = mat('#2a3820', 0.78, 0.08)
  const shoeMat = mat('#e5e7eb', 0.55, 0.08)
  const flagWhite = basic('#f8fafc')
  const flagBlue = basic('#2563eb')
  const flagRed = basic('#dc2626')

  const addBox = (parent, w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  // Camo legs & white sneakers
  addBox(bodyPivot, 0.16, 0.42, 0.14, camoGreen, -0.10, 0.21, 0.02)
  addBox(bodyPivot, 0.16, 0.42, 0.14, camoBrown, 0.10, 0.21, 0.02)
  addBox(bodyPivot, 0.06, 0.22, 0.02, camoDark, -0.10, 0.34, -0.14)
  addBox(bodyPivot, 0.06, 0.22, 0.02, camoDark, 0.10, 0.34, -0.14)
  addBox(bodyPivot, 0.17, 0.06, 0.22, shoeMat, -0.10, 0.03, -0.02)
  addBox(bodyPivot, 0.17, 0.06, 0.22, shoeMat, 0.10, 0.03, -0.02)

  // Shirtless torso & abs
  addBox(bodyPivot, 0.50, 0.46, 0.28, skinMat, 0, 0.56, 0)
  addBox(bodyPivot, 0.08, 0.06, 0.02, skinBright, -0.08, 0.52, -0.142)
  addBox(bodyPivot, 0.08, 0.06, 0.02, skinBright, 0.08, 0.52, -0.142)
  addBox(bodyPivot, 0.08, 0.06, 0.02, skinBright, 0, 0.44, -0.142)
  addBox(bodyPivot, 0.06, 0.05, 0.02, skinBright, -0.06, 0.60, -0.142)
  addBox(bodyPivot, 0.06, 0.05, 0.02, skinBright, 0.06, 0.60, -0.142)

  // Arms — left armband (Russian flag stripes)
  addBox(bodyPivot, 0.12, 0.36, 0.14, skinMat, -0.34, 0.50, 0)
  addBox(bodyPivot, 0.12, 0.36, 0.14, skinMat, 0.34, 0.50, 0)
  addBox(bodyPivot, 0.04, 0.10, 0.02, flagWhite, -0.34, 0.58, -0.152)
  addBox(bodyPivot, 0.04, 0.10, 0.02, flagBlue, -0.34, 0.48, -0.152)
  addBox(bodyPivot, 0.04, 0.10, 0.02, flagRed, -0.34, 0.38, -0.152)
  addBox(bodyPivot, 0.11, 0.11, 0.12, skinBright, -0.34, 0.28, -0.02)
  addBox(bodyPivot, 0.11, 0.11, 0.12, skinBright, 0.34, 0.28, -0.02)

  // Neck, head backing, and fixed photo face
  addBox(bodyPivot, 0.10, 0.06, 0.10, skinMat, 0, 0.82, 0)
  addBox(bodyPivot, 0.32, 0.30, 0.22, skinMat, 0, 1.00, 0.02)
  attachBossHeadPhoto(THREE, bodyPivot, M3_PUTIN_HEAD_TEXTURE_URL, lowDetail, {
    name: 'm3PutinHeadPhoto',
    planeWidth: 0.45,
    planeHeight: 0.58,
    y: 1.00,
    z: -0.132,
    headDepth: 0.42,
    sideColor: '#e8c4a8',
    topColor: '#9ca3af',
  })

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  group.add(shadow)

  bodyPivot.rotation.y = Math.PI
  group.scale.setScalar(M3_PUTIN_BOSS_SCALE)
  group.matrixAutoUpdate = true
  group.userData.bodyPivot = bodyPivot
  group.userData.headY = 1.00 * M3_PUTIN_BOSS_SCALE
  group.position.set(M3_PUTIN_BOSS_SPAWN.gx, 0, M3_PUTIN_BOSS_SPAWN.gy)
  group.frustumCulled = false
  bodyPivot.traverse(obj => {
    if (!obj.isMesh) return
    obj.frustumCulled = false
    obj.renderOrder = 6
  })

  return { group, bodyPivot }
}

export const M3_PUTIN_BOSS_LOCAL_BOUNDS = Object.freeze({
  headTop: 1.28,
  headBottom: 0.94,
  feet: 0.04,
  halfWidth: 0.36,
})

export function createBossRuntime(state) {
  return {
    gx: M3_PUTIN_BOSS_SPAWN.gx,
    gy: M3_PUTIN_BOSS_SPAWN.gy,
    targetWallet: null,
    facing: M3_PUTIN_BOSS_IDLE_FACING,
    lastAttackMs: 0,
    engageAt: 0,
    idlePhase: Math.random() * Math.PI * 2,
    visible: state !== 'dead',
    hitFlashUntil: 0,
    attackUntil: 0,
    combatEngaged: state === 'active',
  }
}

function fighterMatchesLocal(fighter, myWallet, myIdentity) {
  const fw = String(fighter?.wallet || '').toLowerCase()
  const mw = String(myWallet || '').toLowerCase()
  const mi = String(myIdentity || '').toLowerCase()
  return Boolean(fighter?.isLocal || (mw && fw === mw) || (mi && fw === mi))
}

export function resolveBossSwingTarget({
  runtime,
  bossState,
  playerGx,
  playerGy,
  playerAngle,
  crossX,
  crossY,
  canvasW,
  canvasH,
  threeState,
  groundY = 0,
  touchPadding = 0,
}) {
  if (!runtime || bossState?.state === 'dead' || runtime.visible === false) return null

  const dx = runtime.gx - playerGx
  const dy = runtime.gy - playerGy
  const dist = Math.hypot(dx, dy)
  if (dist > M3_PUTIN_BOSS_HIT_RANGE) return null
  if (dist > 1.2) {
    const aimDx = Math.cos(playerAngle)
    const aimDy = Math.sin(playerAngle)
    if (dx * aimDx + dy * aimDy < 0.15) return null
  }

  const scale = M3_PUTIN_BOSS_SCALE
  const bossGx = runtime.gx
  const bossGy = runtime.gy
  const bounds = M3_PUTIN_BOSS_LOCAL_BOUNDS
  const floorY = Number.isFinite(groundY) ? groundY : Number(runtime.floorY) || 0
  let hitZone = 'body'

  if (threeState?.camera && Number.isFinite(crossX) && Number.isFinite(crossY)) {
    const headTopW = floorY + scale * bounds.headTop
    const headBotW = floorY + scale * bounds.headBottom
    const feetW = floorY + scale * bounds.feet
    const halfW = scale * bounds.halfWidth
    const sv = threeState._v3a
    if (!sv) return dist <= 1.0 ? { dist, hitZone: 'body', bossGx, bossGy } : null

    sv.set(bossGx, headTopW, bossGy)
    sv.project(threeState.camera)
    if (sv.z > 1) return dist <= 1.0 ? { dist, hitZone: 'body', bossGx, bossGy } : null
    const pyHeadTop = (-sv.y + 1) / 2 * canvasH

    sv.set(bossGx, headBotW, bossGy)
    sv.project(threeState.camera)
    const pyHeadBottom = (-sv.y + 1) / 2 * canvasH

    sv.set(bossGx - halfW, headBotW, bossGy)
    sv.project(threeState.camera)
    const pxLeft = (sv.x + 1) / 2 * canvasW

    sv.set(bossGx + halfW, headBotW, bossGy)
    sv.project(threeState.camera)
    const pxRight = (sv.x + 1) / 2 * canvasW

    sv.set(bossGx, feetW, bossGy)
    sv.project(threeState.camera)
    const pyFeet = (-sv.y + 1) / 2 * canvasH

    const padX = 8 + touchPadding
    const minX = Math.min(pxLeft, pxRight) - padX
    const maxX = Math.max(pxLeft, pxRight) + padX
    const minY = Math.min(pyHeadTop, pyHeadBottom) - (6 + touchPadding)
    const maxY = pyFeet + (8 + touchPadding)

    if (crossX < minX || crossX > maxX || crossY < minY || crossY > maxY) {
      if (dist <= 1.0) return { dist, hitZone: 'body', bossGx, bossGy }
      return null
    }

    const headPad = 4 + Math.round(touchPadding * 0.5)
    hitZone = (crossY >= pyHeadTop - headPad && crossY <= pyHeadBottom + headPad) ? 'head' : 'body'
  } else if (dist > 0.55) {
    return null
  }

  return { dist, hitZone, bossGx, bossGy }
}

function listAliveFightersOnMap(presenceMap, mapId, myIdentity, myDead) {
  const fighters = []
  if (mapId !== '3') return fighters
  for (const [wallet, pres] of Object.entries(presenceMap || {})) {
    if ((pres.mapId || '1') !== '3') continue
    if (pres.isDead) continue
    fighters.push({
      wallet,
      gx: Number(pres.gx ?? (pres.col ?? 0) + 0.5),
      gy: Number(pres.gy ?? (pres.row ?? 0) + 0.5),
    })
  }
  if (myIdentity && !myDead && mapId === '3') {
    const mi = myIdentity.toLowerCase()
    const exists = fighters.some(f => f.wallet.toLowerCase() === mi)
    if (!exists) {
      fighters.push({ wallet: myIdentity, gx: null, gy: null, isLocal: true })
    }
  }
  return fighters
}

export function updateM3PutinBoss({
  runtime,
  bossState,
  dt,
  mapId,
  presenceMap,
  myIdentity,
  myWallet,
  myDead,
  localGx,
  localGy,
  onAttack,
  onRequestIdle,
  stormAggro = false,
}) {
  if (!runtime || mapId !== '3') return runtime
  const state = bossState?.state || 'idle'
  runtime.visible = state !== 'dead'
  if (state === 'dead') {
    runtime.combatEngaged = false
    return runtime
  }

  if (state === 'active') runtime.combatEngaged = true
  // During a Node Dice storm the boss hunts even from its waiting state.
  const fighting = state === 'active' || runtime.combatEngaged || stormAggro

  const fighters = listAliveFightersOnMap(presenceMap, mapId, myIdentity, myDead)
  for (const fighter of fighters) {
    if (fighter.isLocal) {
      fighter.gx = localGx
      fighter.gy = localGy
    }
  }

  if (fighting && fighters.length === 0) {
    onRequestIdle?.()
    runtime.targetWallet = null
    runtime.combatEngaged = false
    runtime.engageAt = 0
    runtime.gx = M3_PUTIN_BOSS_SPAWN.gx
    runtime.gy = M3_PUTIN_BOSS_SPAWN.gy
    return runtime
  }

  if (!fighting) {
    runtime.engageAt = 0
    runtime.idlePhase += dt * 1.4
    runtime.gx = M3_PUTIN_BOSS_SPAWN.gx + Math.sin(runtime.idlePhase) * 0.08
    runtime.gy = M3_PUTIN_BOSS_SPAWN.gy + Math.cos(runtime.idlePhase * 0.9) * 0.08
    runtime.targetWallet = null
    runtime.facing = M3_PUTIN_BOSS_IDLE_FACING + Math.sin(runtime.idlePhase * 0.5) * 0.12
    return runtime
  }

  let target = null
  let bestDist = Infinity
  for (const fighter of fighters) {
    if (!Number.isFinite(fighter.gx) || !Number.isFinite(fighter.gy)) continue
    const dist = Math.hypot(fighter.gx - runtime.gx, fighter.gy - runtime.gy)
    if (dist < bestDist) {
      bestDist = dist
      target = fighter
    }
  }
  runtime.targetWallet = target?.wallet || null
  if (!target) return runtime

  if (!runtime.engageAt) runtime.engageAt = performance.now()

  const dx = target.gx - runtime.gx
  const dy = target.gy - runtime.gy
  const dist = Math.hypot(dx, dy) || 0.001
  runtime.facing = bossFacingFromDelta(dx, dy)
  const speed = (MOVE_SPD / 40) * M3_PUTIN_BOSS_SPEED_MULT * dt
  const inAttackRange = dist <= M3_PUTIN_BOSS_ATTACK_RANGE

  if (!inAttackRange) {
    runtime.gx += (dx / dist) * speed
    runtime.gy += (dy / dist) * speed
    return runtime
  }

  const now = performance.now()
  if (now - runtime.engageAt < M3_PUTIN_BOSS_ENGAGE_DELAY_MS) return runtime
  if (now - runtime.lastAttackMs < M3_PUTIN_BOSS_ATTACK_COOLDOWN_MS) return runtime
  runtime.lastAttackMs = now
  runtime.attackUntil = now + 520

  if (!myDead && fighterMatchesLocal(target, myWallet, myIdentity)) {
    onAttack?.({
      wallet: myWallet || myIdentity,
      playerGx: localGx,
      playerGy: localGy,
      bossGx: runtime.gx,
      bossGy: runtime.gy,
    })
  }

  return runtime
}

export function syncBossVisual(group, runtime, bossState, time, groundY = 0) {
  if (!group || !runtime) return
  const visible = bossState?.state !== 'dead' && runtime.visible !== false
  group.visible = visible
  if (!visible) return

  const active = bossState?.state === 'active' || runtime.combatEngaged
  const attacking = runtime.attackUntil > performance.now()
  const bob = active
    ? (attacking ? Math.sin(time * 14) * 0.05 : Math.sin(time * 4.5) * 0.03)
    : Math.sin(time * 2.2 + runtime.idlePhase) * 0.06
  const hitFlash = runtime.hitFlashUntil > performance.now()
  const floorY = Number.isFinite(groundY) ? groundY : 0

  group.position.set(runtime.gx, floorY, runtime.gy)
  group.rotation.y = Number.isFinite(runtime.facing) ? runtime.facing : M3_PUTIN_BOSS_IDLE_FACING

  const bodyPivot = group.userData.bodyPivot
  if (bodyPivot) {
    bodyPivot.position.y = bob
    bodyPivot.scale.setScalar(hitFlash ? 1.04 : attacking ? 1.08 : 1)
    bodyPivot.position.z = attacking ? -0.12 : 0
  }

  group.updateMatrix()
  group.updateMatrixWorld(true)
  if (bodyPivot) {
    bodyPivot.updateMatrix()
    bodyPivot.updateMatrixWorld(true)
  }

  if (hitFlash && bodyPivot) {
    bodyPivot.traverse(obj => {
      if (!obj.isMesh || !obj.material?.emissive) return
      obj.material.emissive.set('#ef4444')
      obj.material.emissiveIntensity = 0.35
    })
  } else if (bodyPivot) {
    bodyPivot.traverse(obj => {
      if (!obj.isMesh || !obj.material?.emissive) return
      obj.material.emissive.set('#000000')
      obj.material.emissiveIntensity = 0
    })
  }
}
