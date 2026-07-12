import {
  M3_PUTIN_BOSS_ATTACK_COOLDOWN_MS,
  M3_PUTIN_BOSS_ATTACK_RANGE,
  M3_PUTIN_BOSS_ENGAGE_DELAY_MS,
  M3_PUTIN_BOSS_HIT_RANGE,
  M3_PUTIN_BOSS_IDLE_FACING,
  M3_PUTIN_BOSS_SCALE,
  M3_PUTIN_BOSS_SPEED_MULT,
  M3_PUTIN_BOSS_SPAWN,
  M3_PUTIN_MASK_TEXTURE_URL,
} from './m3-putin-boss'
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

  const skinBright = mat('#f4d4bc', 0.55, 0.06)
  const camoDark = mat('#2a3820', 0.78, 0.08)
  const flagWhite = basic('#f8fafc')
  const flagBlue = basic('#2563eb')
  const flagRed = basic('#dc2626')

  const addBox = (parent, w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  // Low-poly humanoid: shirtless torso, camo trousers, white sneakers.
  const body = buildHumanoidBody(THREE, bodyPivot, {
    mat,
    lowDetail,
    bulk: 1.10,
    handStyle: 'rj45',
    colors: {
      skin: '#e8c4a8',
      torso: '#e8c4a8',
      arms: '#e8c4a8',
      legs: '#3d5c2a',
      shoes: '#e5e7eb',
    },
  })

  // Pec/abs highlights on the bare chest front, plus the camo belt.
  if (!lowDetail) {
    addBox(bodyPivot, 0.055, 0.04, 0.012, skinBright, -0.055, 0.63, -0.134)
    addBox(bodyPivot, 0.055, 0.04, 0.012, skinBright, 0.055, 0.63, -0.134)
    addBox(bodyPivot, 0.045, 0.035, 0.012, skinBright, -0.035, 0.52, -0.128)
    addBox(bodyPivot, 0.045, 0.035, 0.012, skinBright, 0.035, 0.52, -0.128)
    addBox(bodyPivot, 0.045, 0.035, 0.012, skinBright, -0.035, 0.465, -0.126)
    addBox(bodyPivot, 0.045, 0.035, 0.012, skinBright, 0.035, 0.465, -0.126)
  }
  addBox(bodyPivot, 0.26, 0.045, 0.03, camoDark, 0, 0.335, -0.115)

  // Russian armband on the left upper arm — moves with the arm group.
  addBox(body.leftArm, 0.045, 0.035, 0.02, flagWhite, 0, -0.075, -0.055)
  addBox(body.leftArm, 0.045, 0.035, 0.02, flagBlue, 0, -0.11, -0.055)
  addBox(body.leftArm, 0.045, 0.035, 0.02, flagRed, 0, -0.145, -0.055)

  const headHeight = 0.64
  attachBossMaskHead(THREE, bodyPivot, M3_PUTIN_MASK_TEXTURE_URL, lowDetail, {
    name: 'm3PutinHeadPhoto',
    planeWidth: 0.45,
    planeHeight: headHeight,
    y: bossHeadFlushMountY(headHeight),
    // Mount origin = skull centre; 0.02 centres the head over the torso box.
    z: 0.02,
    renderOrder: 12,
    moldColor: '#2a3820',
    cutout: true,
    uvLayout: { frontU0: 0, frontU: 1, frontV0: 0, frontV: 1 },
    // Measured portrait pupil centres, image fractions.
    eyes: { points: [{ u: 0.352, v: 0.459 }, { u: 0.653, v: 0.460 }] },
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
  group.userData.headY = bossHeadFlushMountY(headHeight) * M3_PUTIN_BOSS_SCALE
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
  headTop: BOSS_TORSO_TOP_Y + 0.64,
  headBottom: BOSS_TORSO_TOP_Y,
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
    // Boss walks back to spawn via the !fighting path — no instant snap.
    return runtime
  }

  if (!fighting) {
    runtime.engageAt = 0
    runtime.targetWallet = null
    runtime.idlePhase += dt * 1.4
    const dxS = M3_PUTIN_BOSS_SPAWN.gx - runtime.gx
    const dyS = M3_PUTIN_BOSS_SPAWN.gy - runtime.gy
    const distToSpawn = Math.hypot(dxS, dyS)
    const returnSpeed = (MOVE_SPD / 40) * M3_PUTIN_BOSS_SPEED_MULT * dt
    if (distToSpawn > 0.15) {
      runtime.gx += (dxS / distToSpawn) * Math.min(distToSpawn, returnSpeed)
      runtime.gy += (dyS / distToSpawn) * Math.min(distToSpawn, returnSpeed)
      runtime.facing = bossFacingFromDelta(dxS, dyS)
    } else {
      runtime.gx = M3_PUTIN_BOSS_SPAWN.gx + Math.sin(runtime.idlePhase) * 0.08
      runtime.gy = M3_PUTIN_BOSS_SPAWN.gy + Math.cos(runtime.idlePhase * 0.9) * 0.08
      runtime.facing = M3_PUTIN_BOSS_IDLE_FACING + advanceShowcaseSpin(runtime, dt)
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
  // Fighting bosses switch their holo eyes to red; back to the tint when idle.
  setBossMaskEyesRed(group, active)
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
    // Subtle random human arm sway; a touch stronger while fighting.
    swayHumanoidArms(bodyPivot, time, active ? 1.6 : 1)
    // Attack pose: both arms thrust forward (military precision) + V-spread legs
    if (attacking) {
      const at = Math.min(1, (performance.now() - runtime.lastAttackMs) / 520)
      const windupP = Math.min(1, at / 0.30)
      const strikeP = at >= 0.30 ? Math.min(1, (at - 0.30) / 0.25) : 0
      const arms = bodyPivot.userData?.humanArms
      const legs = bodyPivot.userData?.humanLegs
      if (arms) {
        const [lArm, rArm] = arms
        const aX = windupP * (-0.52) + strikeP * 1.70
        lArm.rotation.x = aX
        rArm.rotation.x = aX
        lArm.rotation.z = (lArm.userData.baseRotZ || 0) + 0.10
        rArm.rotation.z = (rArm.userData.baseRotZ || 0) - 0.10
      }
      if (legs) {
        const spread = Math.sin(at * Math.PI) * 0.38
        legs[0].rotation.z = -spread
        legs[1].rotation.z =  spread
        legs[0].rotation.x = 0
        legs[1].rotation.x = 0
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
