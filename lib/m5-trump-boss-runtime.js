import {
  M5_TRUMP_BOSS_ATTACK_COOLDOWN_MS,
  M5_TRUMP_BOSS_ATTACK_RANGE,
  M5_TRUMP_BOSS_ENGAGE_DELAY_MS,
  M5_TRUMP_BOSS_HIT_RANGE,
  M5_TRUMP_BOSS_IDLE_FACING,
  M5_TRUMP_BOSS_SCALE,
  M5_TRUMP_BOSS_SPEED_MULT,
  M5_TRUMP_BOSS_SPAWN,
  M5_TRUMP_MASK_TEXTURE_URL,
} from './m5-trump-boss'
import { attachBossMaskHead, bossHeadFlushMountY, BOSS_TORSO_TOP_Y, setBossMaskEyesRed } from './boss-head-photo'
import { roundedVoxelGeometry } from './rounded-voxel'
import { advanceShowcaseSpin, bossFacingFromDelta } from './map-boss-facing'

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

/** Voxel-style 3D boss avatar — same rendering pipeline as wallet robots, 2× scale. */
export function createM5TrumpBossVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'm5TrumpBoss'
  group.userData.m5TrumpBoss = true

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm5TrumpBossBody'
  group.add(bodyPivot)

  const mat = (color, roughness, metalness) => bossMaterial(THREE, color, lowDetail, roughness, metalness)
  const basic = (color) => new THREE.MeshBasicMaterial({ color })

  const suitMat = mat('#1a3a6e', 0.55, 0.28)
  const suitDark = mat('#0f2847', 0.68, 0.22)
  const suitLight = mat('#24558f', 0.5, 0.25)
  const shirtMat = mat('#f8fafc', 0.42, 0.08)
  const skinMat = mat('#e8b896', 0.62, 0.08)
  const skinBright = mat('#f4c9a8', 0.55, 0.06)
  const tieMat = basic('#dc2626')
  const shoeMat = mat('#141414', 0.75, 0.35)

  const addBox = (parent, w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(roundedVoxelGeometry(THREE, w, h, d), material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  // Legs & shoes
  addBox(bodyPivot, 0.16, 0.42, 0.14, suitMat, -0.10, 0.21, 0.02)
  addBox(bodyPivot, 0.16, 0.42, 0.14, suitMat, 0.10, 0.21, 0.02)
  addBox(bodyPivot, 0.17, 0.06, 0.22, shoeMat, -0.10, 0.03, -0.02)
  addBox(bodyPivot, 0.17, 0.06, 0.22, shoeMat, 0.10, 0.03, -0.02)

  // Jacket torso — shirt and lapels behind the portrait cube
  addBox(bodyPivot, 0.52, 0.44, 0.30, suitMat, 0, 0.50, 0.02)
  addBox(bodyPivot, 0.54, 0.05, 0.32, suitDark, 0, 0.30, 0)
  addBox(bodyPivot, 0.08, 0.16, 0.02, suitDark, -0.07, 0.58, 0.05)
  addBox(bodyPivot, 0.08, 0.16, 0.02, suitDark, 0.07, 0.58, 0.05)
  addBox(bodyPivot, 0.06, 0.46, 0.025, tieMat, 0, 0.44, 0.04)
  if (!lowDetail) {
    addBox(bodyPivot, 0.26, 0.10, 0.05, shirtMat, 0, 0.665, -0.055)
    addBox(bodyPivot, 0.15, 0.05, 0.034, tieMat, 0, 0.635, -0.184)
    addBox(bodyPivot, 0.11, 0.08, 0.03, shirtMat, -0.09, 0.615, -0.178)
    addBox(bodyPivot, 0.11, 0.08, 0.03, shirtMat, 0.09, 0.615, -0.178)
    addBox(bodyPivot, 0.18, 0.34, 0.026, suitDark, -0.115, 0.50, -0.152)
    addBox(bodyPivot, 0.18, 0.34, 0.026, suitDark, 0.115, 0.50, -0.152)
    addBox(bodyPivot, 0.15, 0.30, 0.028, shirtMat, 0, 0.51, -0.166)
    addBox(bodyPivot, 0.07, 0.36, 0.032, tieMat, 0, 0.43, -0.184)
    addBox(bodyPivot, 0.09, 0.055, 0.034, tieMat, 0, 0.62, -0.186)
    addBox(bodyPivot, 0.12, 0.035, 0.024, suitLight, -0.16, 0.63, -0.166)
    addBox(bodyPivot, 0.12, 0.035, 0.024, suitLight, 0.16, 0.63, -0.166)
  }

  // Arms at sides, clenched fists
  addBox(bodyPivot, 0.12, 0.38, 0.14, suitMat, -0.34, 0.50, 0)
  addBox(bodyPivot, 0.12, 0.38, 0.14, suitMat, 0.34, 0.50, 0)
  // USA armband — red/white/red stripes with the blue canton top-left.
  const flagRed = basic('#b22234')
  const flagWhite = basic('#f8fafc')
  const flagNavy = basic('#3c3b6e')
  addBox(bodyPivot, 0.04, 0.10, 0.02, flagRed, -0.34, 0.60, -0.152)
  addBox(bodyPivot, 0.04, 0.10, 0.02, flagWhite, -0.34, 0.50, -0.152)
  addBox(bodyPivot, 0.04, 0.10, 0.02, flagRed, -0.34, 0.40, -0.152)
  addBox(bodyPivot, 0.022, 0.05, 0.014, flagNavy, -0.352, 0.625, -0.158)
  if (!lowDetail) {
    addBox(bodyPivot, 0.11, 0.055, 0.026, shirtMat, -0.34, 0.34, -0.083)
    addBox(bodyPivot, 0.11, 0.055, 0.026, shirtMat, 0.34, 0.34, -0.083)
  }
  addBox(bodyPivot, 0.11, 0.11, 0.12, skinBright, -0.34, 0.28, -0.02)
  addBox(bodyPivot, 0.11, 0.11, 0.12, skinBright, 0.34, 0.28, -0.02)
  addBox(bodyPivot, 0.04, 0.04, 0.02, shirtMat, -0.34, 0.50, 0.04)
  addBox(bodyPivot, 0.04, 0.04, 0.02, shirtMat, 0.34, 0.50, 0.04)

  const headHeight = 0.64
  attachBossMaskHead(THREE, bodyPivot, M5_TRUMP_MASK_TEXTURE_URL, lowDetail, {
    name: 'm5TrumpHeadPhoto',
    planeWidth: 0.46,
    planeHeight: headHeight,
    y: bossHeadFlushMountY(headHeight),
    // Mount origin = skull centre; 0.02 centres the head over the torso box.
    z: 0.02,
    renderOrder: 12,
    moldColor: '#1a3a6e',
    cutout: true,
    uvLayout: { frontU0: 0, frontU: 1, frontV0: 0, frontV: 1 },
    // Measured portrait pupil centres (wide-open eyes, high on the face).
    eyes: { points: [{ u: 0.360, v: 0.360 }, { u: 0.652, v: 0.352 }] },
  })

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  group.add(shadow)

  bodyPivot.rotation.y = Math.PI
  group.scale.setScalar(M5_TRUMP_BOSS_SCALE)
  group.matrixAutoUpdate = true
  group.userData.bodyPivot = bodyPivot
  group.userData.headY = bossHeadFlushMountY(headHeight) * M5_TRUMP_BOSS_SCALE
  group.position.set(M5_TRUMP_BOSS_SPAWN.gx, 0, M5_TRUMP_BOSS_SPAWN.gy)

  return { group, bodyPivot }
}

export const M5_TRUMP_BOSS_LOCAL_BOUNDS = Object.freeze({
  headTop: BOSS_TORSO_TOP_Y + 0.64,
  headBottom: BOSS_TORSO_TOP_Y,
  feet: 0.04,
  halfWidth: 0.38,
})

export function createBossRuntime(state) {
  return {
    gx: M5_TRUMP_BOSS_SPAWN.gx,
    gy: M5_TRUMP_BOSS_SPAWN.gy,
    targetWallet: null,
    facing: M5_TRUMP_BOSS_IDLE_FACING,
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

/**
 * Screen-space boss hit test — crosshair must be on the boss mesh; head only when
 * the reticle is inside the projected head bounds (same approach as PvP avatars).
 */
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
  if (dist > M5_TRUMP_BOSS_HIT_RANGE) return null
  if (dist > 1.2) {
    const aimDx = Math.cos(playerAngle)
    const aimDy = Math.sin(playerAngle)
    if (dx * aimDx + dy * aimDy < 0.15) return null
  }

  const scale = M5_TRUMP_BOSS_SCALE
  const bossGx = runtime.gx
  const bossGy = runtime.gy
  const bounds = M5_TRUMP_BOSS_LOCAL_BOUNDS
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

  return {
    dist,
    hitZone,
    bossGx,
    bossGy,
  }
}

/** @deprecated use resolveBossSwingTarget */
export function canPlayerHitBoss(args) {
  return resolveBossSwingTarget({
    ...args,
    crossX: null,
    crossY: null,
    canvasW: 640,
    canvasH: 400,
    threeState: null,
  })
}

function listAliveFightersOnM5(presenceMap, mapId, myIdentity, myDead) {
  const fighters = []
  if (mapId !== '5') return fighters
  for (const [wallet, pres] of Object.entries(presenceMap || {})) {
    if ((pres.mapId || '1') !== '5') continue
    if (pres.isDead) continue
    fighters.push({
      wallet,
      gx: Number(pres.gx ?? (pres.col ?? 0) + 0.5),
      gy: Number(pres.gy ?? (pres.row ?? 0) + 0.5),
    })
  }
  if (myIdentity && !myDead && mapId === '5') {
    const mi = myIdentity.toLowerCase()
    const exists = fighters.some(f => f.wallet.toLowerCase() === mi)
    if (!exists) {
      fighters.push({ wallet: myIdentity, gx: null, gy: null, isLocal: true })
    }
  }
  return fighters
}

export function updateM5TrumpBoss({
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
  if (!runtime || mapId !== '5') return runtime
  const state = bossState?.state || 'idle'
  runtime.visible = state !== 'dead'
  if (state === 'dead') {
    runtime.combatEngaged = false
    return runtime
  }

  if (state === 'active') runtime.combatEngaged = true
  // During a Node Dice storm the boss hunts even from its waiting state.
  const fighting = state === 'active' || runtime.combatEngaged || stormAggro

  const fighters = listAliveFightersOnM5(presenceMap, mapId, myIdentity, myDead)
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
    runtime.gx = M5_TRUMP_BOSS_SPAWN.gx
    runtime.gy = M5_TRUMP_BOSS_SPAWN.gy
    return runtime
  }

  if (!fighting) {
    runtime.engageAt = 0
    runtime.idlePhase += dt * 1.4
    runtime.gx = M5_TRUMP_BOSS_SPAWN.gx + Math.sin(runtime.idlePhase) * 0.08
    runtime.gy = M5_TRUMP_BOSS_SPAWN.gy + Math.cos(runtime.idlePhase * 0.9) * 0.08
    runtime.targetWallet = null
    // Idle showcase spin: full slow turns with random direction flips.
    runtime.facing = M5_TRUMP_BOSS_IDLE_FACING + advanceShowcaseSpin(runtime, dt)
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
  const speed = (MOVE_SPD / 40) * M5_TRUMP_BOSS_SPEED_MULT * dt
  const inAttackRange = dist <= M5_TRUMP_BOSS_ATTACK_RANGE

  if (!inAttackRange) {
    runtime.gx += (dx / dist) * speed
    runtime.gy += (dy / dist) * speed
    return runtime
  }

  const now = performance.now()
  if (now - runtime.engageAt < M5_TRUMP_BOSS_ENGAGE_DELAY_MS) return runtime
  if (now - runtime.lastAttackMs < M5_TRUMP_BOSS_ATTACK_COOLDOWN_MS) return runtime
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
  // Fighting bosses switch their holo eyes to red; back to the tint when idle.
  setBossMaskEyesRed(group, active)
  const attacking = runtime.attackUntil > performance.now()
  const bob = active
    ? (attacking ? Math.sin(time * 14) * 0.05 : Math.sin(time * 4.5) * 0.03)
    : Math.sin(time * 2.2 + runtime.idlePhase) * 0.06
  const hitFlash = runtime.hitFlashUntil > performance.now()
  const floorY = Number.isFinite(groundY) ? groundY : 0

  group.position.set(runtime.gx, floorY, runtime.gy)
  group.rotation.y = Number.isFinite(runtime.facing) ? runtime.facing : M5_TRUMP_BOSS_IDLE_FACING

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

export function bossScreenTarget(runtime, camGX, camGY, angle, pitch, projScale, hProj, viewCY, cosP, sinP) {
  if (!runtime || runtime.visible === false) return null
  const rx = runtime.gx - camGX
  const ry = runtime.gy - camGY
  const tY = Math.cos(angle) * rx + Math.sin(angle) * ry
  const tX = -Math.sin(angle) * rx + Math.cos(angle) * ry
  if (tY < 0.2 || tY > 3.2) return null
  const sx = hProj * (tX / tY) + projScale * 0.5
  const sy = viewCY - ((tY * cosP + 0 * sinP) / tY) * projScale
  return { dist: tY, tX, tY, sx, sy, hitZone: Math.abs(sx - projScale * 0.5) < 18 && sy < viewCY - 8 ? 'head' : 'body' }
}
