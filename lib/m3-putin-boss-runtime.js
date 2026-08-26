import { unitRandom } from '@/lib/game-random'
import {
  M3_PUTIN_BOSS_ATTACK_COOLDOWN_MS,
  M3_PUTIN_BOSS_ATTACK_RANGE,
  M3_PUTIN_BOSS_ENGAGE_DELAY_MS,
  M3_PUTIN_BOSS_HIT_RANGE,
  M3_PUTIN_BOSS_IDLE_FACING,
  M3_PUTIN_BOSS_MODEL_URL,
  M3_PUTIN_BOSS_SCALE,
  M3_PUTIN_BOSS_SPEED_MULT,
  M3_PUTIN_BOSS_SPAWN,
} from './m3-putin-boss'
import { setBossMaskEyesRed } from './boss-head-photo'
import { humanoidGlbHeadBounds, humanoidGlbHitBounds } from './humanoid-glb'
import { createFixedTexturedStatueVisual } from './fixed-textured-statue'
import { advanceShowcaseSpin, approachYaw, bossFacingFromDelta } from './map-boss-facing'
import { swayHumanoidArms } from './humanoid-body'
import { bossMoveDelta, syncCapsuleLocomotion } from './capsule-anim-driver'

const MOVE_SPD = 47

/**
 * Textured Putin prop (Sketchfab CC BY). Rigid multi-mesh — home/combat pose
 * the whole bodyPivot like Kim (no capsule skinned overlay).
 */
export function createM3PutinBossVisual(THREE, lowDetail = false) {
  const bulk = 1.0
  const { gx, gy } = M3_PUTIN_BOSS_SPAWN
  const visual = createFixedTexturedStatueVisual(THREE, {
    name: 'm3PutinBoss',
    bodyName: 'm3PutinBossBody',
    flagKey: 'm3PutinBoss',
    modelUrl: M3_PUTIN_BOSS_MODEL_URL,
    scale: M3_PUTIN_BOSS_SCALE,
    gx,
    gy,
    placeholderColor: '#3f3f46',
    lowDetail,
    eyeSize: 0.055,
    eyeLine: 0.48,
    shadowRadius: 0.55,
    renderOrder: 6,
    walkableStatue: false,
    withCapsuleDriver: true,
    capsuleBulk: bulk,
    capsuleSleeve: 'bare',
    capsuleSkinSeed: 'putin',
    capsuleColors: {
      skin: '#e8c4a8',
      torso: '#1e293b',
      arms: '#e8c4a8',
      legs: '#0f172a',
      shoes: '#111827',
      sole: '#020617',
      belt: '#1c1916',
    },
  })
  visual.group.userData.headY = humanoidGlbHeadBounds(bulk).centerY * M3_PUTIN_BOSS_SCALE
  return visual
}

export const M3_PUTIN_BOSS_LOCAL_BOUNDS = humanoidGlbHitBounds(0.36)

export function createBossRuntime(state) {
  return {
    gx: M3_PUTIN_BOSS_SPAWN.gx,
    gy: M3_PUTIN_BOSS_SPAWN.gy,
    targetWallet: null,
    facing: M3_PUTIN_BOSS_IDLE_FACING,
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
  canMoveTo = null,
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
        const dxF = nearestFighter.gx - M3_PUTIN_BOSS_SPAWN.gx
        const dyF = nearestFighter.gy - M3_PUTIN_BOSS_SPAWN.gy
        const dF = Math.hypot(dxF, dyF) || 1
        const lean = Math.min(0.25, dF * 0.5)
        const tx = M3_PUTIN_BOSS_SPAWN.gx + (dxF / dF) * lean
        const ty = M3_PUTIN_BOSS_SPAWN.gy + (dyF / dF) * lean
        const blend = Math.min(1, dt * 3)
        runtime.gx += (tx - runtime.gx) * blend
        runtime.gy += (ty - runtime.gy) * blend
      } else {
        runtime.waiting = false
        runtime.gx = M3_PUTIN_BOSS_SPAWN.gx + Math.sin(runtime.idlePhase) * 0.08
        runtime.gy = M3_PUTIN_BOSS_SPAWN.gy + Math.cos(runtime.idlePhase * 0.9) * 0.08
        runtime.facing = M3_PUTIN_BOSS_IDLE_FACING + advanceShowcaseSpin(runtime, dt)
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
  const speed = (MOVE_SPD / 40) * M3_PUTIN_BOSS_SPEED_MULT * dt
  const inAttackRange = dist <= M3_PUTIN_BOSS_ATTACK_RANGE

  if (!inAttackRange) {
    const step = Math.min(dist - M3_PUTIN_BOSS_ATTACK_RANGE, speed)
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
  const moved = bossMoveDelta(runtime)
  const bobScale = group.userData.bodyPivot?.userData?.capsuleAnimDriver ? 0.28 : 1
  const bob = active
    ? (attacking ? Math.sin(time * 14) * 0.05 : Math.sin(time * 4.5) * 0.03)
    : Math.sin(time * 2.2 + runtime.idlePhase) * 0.06
  const hitFlash = runtime.hitFlashUntil > performance.now()
  // Textured skull has no mask eyes; eye sprites flip red in combat / on hit only.
  setBossMaskEyesRed(group, active || hitFlash)
  const floorY = Number.isFinite(groundY) ? groundY : 0

  group.position.set(runtime.gx, floorY, runtime.gy)
  group.rotation.y = Number.isFinite(runtime.facing) ? runtime.facing : M3_PUTIN_BOSS_IDLE_FACING
  const bodyPivot = group.userData.bodyPivot
  if (bodyPivot) {
    const deck = bodyPivot.userData.baseY || 0
    bodyPivot.position.y = deck + bob * bobScale
    bodyPivot.scale.setScalar(hitFlash ? 1.04 : attacking ? 1.08 : 1)
    bodyPivot.position.z = attacking ? -0.12 : 0
    bodyPivot.rotation.x = attacking ? 0.06 : 0
    swayHumanoidArms(bodyPivot, time, active ? 1.5 : 1)
    if (attacking) {
      const at = Math.min(1, (performance.now() - runtime.lastAttackMs) / 680)
      const windupP = Math.min(1, at / 0.30)
      const strikeP = at >= 0.30 ? Math.min(1, (at - 0.30) / 0.25) : 0
      const arms = bodyPivot.userData?.humanArms
      const legs = bodyPivot.userData?.humanLegs
      if (arms) {
        const [lArm, rArm] = arms
        const aX = windupP * (-0.52) + strikeP * 1.70
        rArm.rotation.x = aX
        lArm.rotation.x = aX
        rArm.rotation.z = (rArm.userData.baseRotZ || 0) - 0.10
        lArm.rotation.z = (lArm.userData.baseRotZ || 0) + 0.10
      }
      if (legs) {
        const jumpH = Math.sin(at * Math.PI)
        legs[0].rotation.z = -jumpH * 0.44
        legs[1].rotation.z = jumpH * 0.44
        legs[0].rotation.x = 0
        legs[1].rotation.x = 0
      }
    } else {
      syncCapsuleLocomotion(bodyPivot, runtime, { moved, attacking: false })
    }
  }

  group.updateMatrix()
  group.updateMatrixWorld(true)
  if (bodyPivot) {
    bodyPivot.updateMatrix()
    bodyPivot.updateMatrixWorld(true)
  }
}
