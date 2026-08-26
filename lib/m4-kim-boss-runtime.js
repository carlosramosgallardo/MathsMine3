import { unitRandom } from '@/lib/game-random'
import {
  M4_KIM_BOSS_ATTACK_COOLDOWN_MS,
  M4_KIM_BOSS_ATTACK_RANGE,
  M4_KIM_BOSS_ENGAGE_DELAY_MS,
  M4_KIM_BOSS_HIT_RANGE,
  M4_KIM_BOSS_IDLE_FACING,
  M4_KIM_BOSS_MODEL_URL,
  M4_KIM_BOSS_SCALE,
  M4_KIM_BOSS_SPEED_MULT,
  M4_KIM_BOSS_SPAWN,
} from './m4-kim-boss'
import { setBossMaskEyesRed } from './boss-head-photo'
import { swayHumanoidArms } from './humanoid-body'
import { humanoidGlbHeadBounds, humanoidGlbHitBounds } from './humanoid-glb'
import { createFixedTexturedStatueVisual } from './fixed-textured-statue'
import { advanceShowcaseSpin, approachYaw, bossFacingFromDelta } from './map-boss-facing'

const MOVE_SPD = 47

/**
 * Textured Kim Jong-un prop (Sketchfab CC BY). The whole body rides the
 * bodyPivot bob/lunge — no capsule limbs — so combat still reads without a
 * photo-mask head.
 */
export function createM4KimBossVisual(THREE, lowDetail = false) {
  const bulk = 1.08
  const { gx, gy } = M4_KIM_BOSS_SPAWN
  const visual = createFixedTexturedStatueVisual(THREE, {
    name: 'm4KimBoss',
    bodyName: 'm4KimBossBody',
    flagKey: 'm4KimBoss',
    modelUrl: M4_KIM_BOSS_MODEL_URL,
    scale: M4_KIM_BOSS_SCALE,
    gx,
    gy,
    placeholderColor: '#3f3f46',
    lowDetail,
    eyeSize: 0.075,
    shadowRadius: 0.58,
    renderOrder: 6,
    walkableStatue: false,
    eyePoints: [
      { x: -0.065, y: 1.52, z: 0.22 },
      { x: 0.065, y: 1.52, z: 0.22 },
    ],
  })
  visual.group.userData.headY = humanoidGlbHeadBounds(bulk).centerY * M4_KIM_BOSS_SCALE
  return visual
}

export const M4_KIM_BOSS_LOCAL_BOUNDS = humanoidGlbHitBounds(0.38)

export function createBossRuntime(state) {
  return {
    gx: M4_KIM_BOSS_SPAWN.gx,
    gy: M4_KIM_BOSS_SPAWN.gy,
    targetWallet: null,
    facing: M4_KIM_BOSS_IDLE_FACING,
    lastAttackMs: 0,
    engageAt: 0,
    idlePhase: unitRandom() * Math.PI * 2,
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
  if (dist > M4_KIM_BOSS_HIT_RANGE) return null
  if (dist > 1.2) {
    const aimDx = Math.cos(playerAngle)
    const aimDy = Math.sin(playerAngle)
    if (dx * aimDx + dy * aimDy < 0.15) return null
  }

  const scale = M4_KIM_BOSS_SCALE
  const bossGx = runtime.gx
  const bossGy = runtime.gy
  const bounds = M4_KIM_BOSS_LOCAL_BOUNDS
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
  if (mapId !== '4') return fighters
  for (const [wallet, pres] of Object.entries(presenceMap || {})) {
    if ((pres.mapId || '1') !== '4') continue
    if (pres.isDead) continue
    fighters.push({
      wallet,
      gx: Number(pres.gx ?? (pres.col ?? 0) + 0.5),
      gy: Number(pres.gy ?? (pres.row ?? 0) + 0.5),
    })
  }
  if (myIdentity && !myDead && mapId === '4') {
    const mi = myIdentity.toLowerCase()
    const exists = fighters.some(f => f.wallet.toLowerCase() === mi)
    if (!exists) {
      fighters.push({ wallet: myIdentity, gx: null, gy: null, isLocal: true })
    }
  }
  return fighters
}

export function updateM4KimBoss({
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
  canMoveTo = null,
}) {
  if (!runtime || mapId !== '4') return runtime
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
  // Presence coords for the local player are throttled/stale — always use live ones.
  const localCoordsOk = Number.isFinite(localGx) && Number.isFinite(localGy)
  for (const fighter of fighters) {
    if (fighter.isLocal || (localCoordsOk && fighterMatchesLocal(fighter, myWallet, myIdentity))) {
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
    runtime.idlePhase += dt * 1.2
    const dxS = M4_KIM_BOSS_SPAWN.gx - runtime.gx
    const dyS = M4_KIM_BOSS_SPAWN.gy - runtime.gy
    const distToSpawn = Math.hypot(dxS, dyS)
    const returnSpeed = (MOVE_SPD / 40) * M4_KIM_BOSS_SPEED_MULT * dt
    if (distToSpawn > 0.45) {
      const stepX = (dxS / distToSpawn) * Math.min(distToSpawn, returnSpeed)
      const stepY = (dyS / distToSpawn) * Math.min(distToSpawn, returnSpeed)
      const nx = runtime.gx + stepX, ny = runtime.gy + stepY
      if (!canMoveTo || canMoveTo(nx, ny)) {
        runtime.gx = nx; runtime.gy = ny
      } else if (!canMoveTo || canMoveTo(nx, runtime.gy)) {
        runtime.gx = nx
      } else if (!canMoveTo || canMoveTo(runtime.gx, ny)) {
        runtime.gy = ny
      }
      runtime.facing = approachYaw(runtime.facing, bossFacingFromDelta(dxS, dyS), dt, 5)
      runtime.waiting = false
    } else {
      let nearestFighter = null
      let nearestDist = Infinity
      for (const f of fighters) {
        if (!Number.isFinite(f.gx) || !Number.isFinite(f.gy)) continue
        const d = Math.hypot(f.gx - runtime.gx, f.gy - runtime.gy)
        if (d < nearestDist) { nearestDist = d; nearestFighter = f }
      }
      if (nearestFighter) {
        runtime.facing = approachYaw(runtime.facing, bossFacingFromDelta(nearestFighter.gx - runtime.gx, nearestFighter.gy - runtime.gy), dt, 4)
        runtime.waiting = true
        // Hold the spawn spot but lean a small step toward the nearest player.
        const dxF = nearestFighter.gx - M4_KIM_BOSS_SPAWN.gx
        const dyF = nearestFighter.gy - M4_KIM_BOSS_SPAWN.gy
        const dF = Math.hypot(dxF, dyF) || 1
        const lean = Math.min(0.25, dF * 0.5)
        const tx = M4_KIM_BOSS_SPAWN.gx + (dxF / dF) * lean
        const ty = M4_KIM_BOSS_SPAWN.gy + (dyF / dF) * lean
        const blend = Math.min(1, dt * 3)
        runtime.gx += (tx - runtime.gx) * blend
        runtime.gy += (ty - runtime.gy) * blend
      } else {
        runtime.waiting = false
        runtime.gx = M4_KIM_BOSS_SPAWN.gx + Math.sin(runtime.idlePhase) * 0.06
        runtime.gy = M4_KIM_BOSS_SPAWN.gy + Math.cos(runtime.idlePhase * 0.85) * 0.06
        runtime.facing = M4_KIM_BOSS_IDLE_FACING + advanceShowcaseSpin(runtime, dt)
      }
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
  runtime.facing = approachYaw(runtime.facing, bossFacingFromDelta(dx, dy), dt, 6)
  const speed = (MOVE_SPD / 40) * M4_KIM_BOSS_SPEED_MULT * dt
  const inAttackRange = dist <= M4_KIM_BOSS_ATTACK_RANGE

  if (!inAttackRange) {
    const step = Math.min(dist - M4_KIM_BOSS_ATTACK_RANGE, speed)
    const nx = runtime.gx + (dx / dist) * step
    const ny = runtime.gy + (dy / dist) * step
    if (!canMoveTo || canMoveTo(nx, ny)) {
      runtime.gx = nx; runtime.gy = ny
    } else if (!canMoveTo || canMoveTo(nx, runtime.gy)) {
      runtime.gx = nx
    } else if (!canMoveTo || canMoveTo(runtime.gx, ny)) {
      runtime.gy = ny
    }
    return runtime
  }

  const now = performance.now()
  if (now - runtime.engageAt < M4_KIM_BOSS_ENGAGE_DELAY_MS) return runtime
  if (now - runtime.lastAttackMs < M4_KIM_BOSS_ATTACK_COOLDOWN_MS) return runtime
  runtime.lastAttackMs = now
  runtime.attackUntil = now + 680

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
    ? (attacking ? Math.sin(time * 10) * 0.04 : Math.sin(time * 3.8) * 0.025)
    : Math.sin(time * 1.8 + runtime.idlePhase) * 0.05
  const hitFlash = runtime.hitFlashUntil > performance.now()
  // Eyes only — never paint the whole body red.
  setBossMaskEyesRed(group, active || hitFlash)
  const floorY = Number.isFinite(groundY) ? groundY : 0

  group.position.set(runtime.gx, floorY, runtime.gy)
  group.rotation.y = Number.isFinite(runtime.facing) ? runtime.facing : M4_KIM_BOSS_IDLE_FACING
  const bodyPivot = group.userData.bodyPivot
  if (bodyPivot) {
    bodyPivot.position.y = bob
    bodyPivot.scale.setScalar(hitFlash ? 1.04 : attacking ? 1.06 : 1)
    bodyPivot.position.z = attacking ? -0.18 : 0
    bodyPivot.rotation.x = attacking ? -0.22 : 0
    // Arm animation: waiting greeting > attack override > idle sway
    if (runtime.waiting && !attacking) {
      // Parade wave: both arms raised overhead, slow bilateral oscillation
      const arms = bodyPivot.userData?.humanArms
      if (arms) {
        const [lArm, rArm] = arms
        const wave = Math.sin(time * 3.2) * 0.28
        rArm.rotation.x = 2.5
        lArm.rotation.x = 2.5
        rArm.rotation.z = (rArm.userData.baseRotZ || 0) + wave
        lArm.rotation.z = (lArm.userData.baseRotZ || 0) - wave
      }
    } else {
      swayHumanoidArms(bodyPivot, time, active ? 1.6 : 1)
    }
    // Attack pose: right arm sweeps overhead then stabs forward + scissor kick
    if (attacking) {
      const at = Math.min(1, (performance.now() - runtime.lastAttackMs) / 680)
      const windupP = Math.min(1, at / 0.30)
      const strikeP = at >= 0.30 ? Math.min(1, (at - 0.30) / 0.25) : 0
      const arms = bodyPivot.userData?.humanArms
      const legs = bodyPivot.userData?.humanLegs
      if (arms) {
        const [lArm, rArm] = arms
        rArm.rotation.x = windupP * (-1.20) + strikeP * 2.05
        lArm.rotation.x = -0.38 * windupP
        rArm.rotation.z = (rArm.userData.baseRotZ || 0) - 0.40
        lArm.rotation.z = (lArm.userData.baseRotZ || 0) + 0.30
      }
      if (legs) {
        const scissor = Math.sin(at * Math.PI) * 0.48
        legs[0].rotation.x =  scissor
        legs[1].rotation.x = -scissor
        legs[0].rotation.z = 0
        legs[1].rotation.z = 0
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
}
