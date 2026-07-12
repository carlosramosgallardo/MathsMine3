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
import { buildHumanoidBody, swayHumanoidArms } from './humanoid-body'
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

  const shirtMat = mat('#f8fafc', 0.42, 0.08)
  const suitDark = mat('#0f2847', 0.68, 0.22)
  const tieMat = basic('#dc2626')

  const addBox = (parent, w, h, d, material, x, y, z, rotZ = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    if (rotZ) mesh.rotation.z = rotZ
    parent.add(mesh)
    return mesh
  }

  // Low-poly humanoid in the navy suit — broad build.
  const body = buildHumanoidBody(THREE, bodyPivot, {
    mat,
    lowDetail,
    bulk: 1.12,
    handStyle: 'rj45',
    colors: {
      skin: '#e8b896',
      torso: '#1a3a6e',
      legs: '#1a3a6e',
      shoes: '#141414',
    },
  })

  // Suit decor on the chest front (-z): shirt V, lapels, long red tie.
  addBox(bodyPivot, 0.15, 0.13, 0.014, shirtMat, 0, 0.645, -0.138)
  addBox(bodyPivot, 0.07, 0.19, 0.012, suitDark, -0.075, 0.60, -0.142, 0.32)
  addBox(bodyPivot, 0.07, 0.19, 0.012, suitDark, 0.075, 0.60, -0.142, -0.32)
  addBox(bodyPivot, 0.075, 0.05, 0.02, tieMat, 0, 0.655, -0.146)
  addBox(bodyPivot, 0.06, 0.28, 0.016, tieMat, 0, 0.50, -0.146)

  // USA armband on the left upper arm — moves with the arm group.
  const flagRed = basic('#b22234')
  const flagWhite = basic('#f8fafc')
  const flagNavy = basic('#3c3b6e')
  addBox(body.leftArm, 0.045, 0.035, 0.02, flagRed, 0, -0.075, -0.055)
  addBox(body.leftArm, 0.045, 0.035, 0.02, flagWhite, 0, -0.11, -0.055)
  addBox(body.leftArm, 0.045, 0.035, 0.02, flagRed, 0, -0.145, -0.055)
  addBox(body.leftArm, 0.02, 0.018, 0.012, flagNavy, -0.014, -0.068, -0.062)

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
    return runtime
  }

  if (!fighting) {
    runtime.engageAt = 0
    runtime.targetWallet = null
    runtime.idlePhase += dt * 1.4
    const dxS = M5_TRUMP_BOSS_SPAWN.gx - runtime.gx
    const dyS = M5_TRUMP_BOSS_SPAWN.gy - runtime.gy
    const distToSpawn = Math.hypot(dxS, dyS)
    const returnSpeed = (MOVE_SPD / 40) * M5_TRUMP_BOSS_SPEED_MULT * dt
    if (distToSpawn > 0.15) {
      runtime.gx += (dxS / distToSpawn) * Math.min(distToSpawn, returnSpeed)
      runtime.gy += (dyS / distToSpawn) * Math.min(distToSpawn, returnSpeed)
      runtime.facing = bossFacingFromDelta(dxS, dyS)
    } else {
      runtime.gx = M5_TRUMP_BOSS_SPAWN.gx + Math.sin(runtime.idlePhase) * 0.08
      runtime.gy = M5_TRUMP_BOSS_SPAWN.gy + Math.cos(runtime.idlePhase * 0.9) * 0.08
      runtime.facing = M5_TRUMP_BOSS_IDLE_FACING + advanceShowcaseSpin(runtime, dt)
    }
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
    // Subtle random human arm sway; a touch stronger while fighting.
    swayHumanoidArms(bodyPivot, time, active ? 1.6 : 1)
    // Attack pose: arms blast wide then right arm jabs forward + lateral leg spread
    if (attacking) {
      const at = Math.min(1, (performance.now() - runtime.lastAttackMs) / 520)
      const spreadP = Math.min(1, at / 0.30)
      const pointP  = at > 0.45 ? Math.min(1, (at - 0.45) / 0.22) : 0
      const arms = bodyPivot.userData?.humanArms
      const legs = bodyPivot.userData?.humanLegs
      if (arms) {
        const [lArm, rArm] = arms
        lArm.rotation.x = spreadP * 0.22
        rArm.rotation.x = spreadP * 0.22 + pointP * 0.85
        lArm.rotation.z = (lArm.userData.baseRotZ || 0) + spreadP * 1.22
        rArm.rotation.z = (rArm.userData.baseRotZ || 0) - spreadP * 1.22 + pointP * 0.58
      }
      if (legs) {
        const spread = Math.sin(at * Math.PI) * 0.40
        legs[0].rotation.z = -spread
        legs[1].rotation.z =  spread
        legs[0].rotation.x = Math.sin(at * Math.PI) * 0.16
        legs[1].rotation.x = Math.sin(at * Math.PI) * 0.16
      }
    } else {
      const legs = bodyPivot.userData?.humanLegs
      if (legs) {
        legs[0].rotation.x = 0; legs[0].rotation.z = 0
        legs[1].rotation.x = 0; legs[1].rotation.z = 0
      }
    }
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
