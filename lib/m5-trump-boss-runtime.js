import {
  M5_TRUMP_BOSS_ATTACK_COOLDOWN_MS,
  M5_TRUMP_BOSS_ATTACK_RANGE,
  M5_TRUMP_BOSS_HIT_RANGE,
  M5_TRUMP_BOSS_NAME,
  M5_TRUMP_BOSS_SCALE,
  M5_TRUMP_BOSS_SPEED_MULT,
  M5_TRUMP_BOSS_SPAWN,
} from './m5-trump-boss'

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
  const shirtMat = mat('#f8fafc', 0.42, 0.08)
  const skinMat = mat('#e8b896', 0.62, 0.08)
  const skinBright = mat('#f4c9a8', 0.55, 0.06)
  const blushMat = mat('#eba888', 0.72, 0.04)
  const hairMat = mat('#e8b830', 0.48, 0.12)
  const hairBright = mat('#ffe566', 0.42, 0.14)
  const browMat = mat('#c4942a', 0.5, 0.05)
  const tieMat = basic('#dc2626')
  const shoeMat = mat('#141414', 0.75, 0.35)

  const addBox = (parent, w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  // Legs & shoes
  addBox(bodyPivot, 0.16, 0.42, 0.14, suitMat, -0.10, 0.21, 0.02)
  addBox(bodyPivot, 0.16, 0.42, 0.14, suitMat, 0.10, 0.21, 0.02)
  addBox(bodyPivot, 0.17, 0.06, 0.22, shoeMat, -0.10, 0.03, -0.02)
  addBox(bodyPivot, 0.17, 0.06, 0.22, shoeMat, 0.10, 0.03, -0.02)

  // Jacket torso
  addBox(bodyPivot, 0.52, 0.48, 0.30, suitMat, 0, 0.56, 0)
  addBox(bodyPivot, 0.54, 0.05, 0.32, suitDark, 0, 0.34, 0)
  addBox(bodyPivot, 0.22, 0.38, 0.02, shirtMat, 0, 0.58, -0.152)
  addBox(bodyPivot, 0.08, 0.18, 0.02, suitDark, -0.07, 0.62, -0.154)
  addBox(bodyPivot, 0.08, 0.18, 0.02, suitDark, 0.07, 0.62, -0.154)
  addBox(bodyPivot, 0.06, 0.52, 0.025, tieMat, 0, 0.46, -0.158)

  // Arms at sides, clenched fists
  addBox(bodyPivot, 0.12, 0.38, 0.14, suitMat, -0.34, 0.50, 0)
  addBox(bodyPivot, 0.12, 0.38, 0.14, suitMat, 0.34, 0.50, 0)
  addBox(bodyPivot, 0.11, 0.11, 0.12, skinBright, -0.34, 0.28, -0.02)
  addBox(bodyPivot, 0.11, 0.11, 0.12, skinBright, 0.34, 0.28, -0.02)
  addBox(bodyPivot, 0.04, 0.04, 0.02, shirtMat, -0.34, 0.50, -0.152)
  addBox(bodyPivot, 0.04, 0.04, 0.02, shirtMat, 0.34, 0.50, -0.152)

  // Neck & chibi head
  addBox(bodyPivot, 0.10, 0.06, 0.10, skinMat, 0, 0.82, 0)
  addBox(bodyPivot, 0.38, 0.34, 0.30, skinMat, 0, 1.02, 0)
  addBox(bodyPivot, 0.06, 0.04, 0.01, blushMat, -0.12, 0.98, -0.152)
  addBox(bodyPivot, 0.06, 0.04, 0.01, blushMat, 0.12, 0.98, -0.152)

  // Blonde swept-back hair with quiff
  addBox(bodyPivot, 0.40, 0.12, 0.32, hairMat, 0, 1.24, 0.02)
  addBox(bodyPivot, 0.42, 0.18, 0.22, hairMat, 0, 1.18, -0.08)
  addBox(bodyPivot, 0.14, 0.22, 0.28, hairBright, -0.24, 1.08, 0.02)
  addBox(bodyPivot, 0.14, 0.22, 0.28, hairBright, 0.24, 1.08, 0.02)
  addBox(bodyPivot, 0.12, 0.10, 0.18, hairBright, 0, 1.28, -0.12)

  // Face details
  addBox(bodyPivot, 0.08, 0.025, 0.01, browMat, -0.08, 1.06, -0.152)
  addBox(bodyPivot, 0.08, 0.025, 0.01, browMat, 0.08, 1.06, -0.152)
  addBox(bodyPivot, 0.04, 0.025, 0.01, basic('#1a1208'), -0.08, 1.03, -0.153)
  addBox(bodyPivot, 0.04, 0.025, 0.01, basic('#1a1208'), 0.08, 1.03, -0.153)
  addBox(bodyPivot, 0.10, 0.015, 0.01, mat('#c48878', 0.6, 0), 0, 0.92, -0.153)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  group.add(shadow)

  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 256
  labelCanvas.height = 64
  const lctx = labelCanvas.getContext('2d')
  lctx.fillStyle = 'rgba(0,0,0,0.55)'
  lctx.fillRect(0, 0, 256, 64)
  lctx.fillStyle = '#fbbf24'
  lctx.font = 'bold 28px monospace'
  lctx.textAlign = 'center'
  lctx.textBaseline = 'middle'
  lctx.fillText(M5_TRUMP_BOSS_NAME, 128, 34)
  const labelTex = new THREE.CanvasTexture(labelCanvas)
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }))
  label.scale.set(1.8, 0.45, 1)
  label.position.y = 2.55 * M5_TRUMP_BOSS_SCALE
  label.renderOrder = 7
  group.add(label)

  bodyPivot.rotation.y = Math.PI
  group.scale.setScalar(M5_TRUMP_BOSS_SCALE)
  group.matrixAutoUpdate = true
  group.userData.bodyPivot = bodyPivot
  group.userData.nameLabel = label
  group.userData.headY = 1.02 * M5_TRUMP_BOSS_SCALE
  group.position.set(M5_TRUMP_BOSS_SPAWN.gx, 0, M5_TRUMP_BOSS_SPAWN.gy)

  return { group, bodyPivot, label }
}

export const M5_TRUMP_BOSS_LOCAL_BOUNDS = Object.freeze({
  headTop: 1.32,
  headBottom: 0.96,
  feet: 0.04,
  halfWidth: 0.38,
})

export function createBossRuntime(state) {
  return {
    gx: M5_TRUMP_BOSS_SPAWN.gx,
    gy: M5_TRUMP_BOSS_SPAWN.gy,
    targetWallet: null,
    facing: Math.PI,
    lastAttackMs: 0,
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
  let hitZone = 'body'

  if (threeState?.camera && Number.isFinite(crossX) && Number.isFinite(crossY)) {
    const headTopW = scale * bounds.headTop
    const headBotW = scale * bounds.headBottom
    const feetW = scale * bounds.feet
    const halfW = scale * bounds.halfWidth
    const sv = threeState._v3a
    if (!sv) return null

    sv.set(bossGx, headTopW, bossGy)
    sv.project(threeState.camera)
    if (sv.z > 1) return null
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

    const padX = 8
    const minX = Math.min(pxLeft, pxRight) - padX
    const maxX = Math.max(pxLeft, pxRight) + padX
    const minY = Math.min(pyHeadTop, pyHeadBottom) - 6
    const maxY = pyFeet + 8

    if (crossX < minX || crossX > maxX || crossY < minY || crossY > maxY) return null

    const headPad = 4
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

function bossFacingFromDelta(dx, dy) {
  return -Math.atan2(dx, dy) - Math.PI / 2
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
}) {
  if (!runtime || mapId !== '5') return runtime
  const state = bossState?.state || 'idle'
  runtime.visible = state !== 'dead'
  if (state === 'dead') {
    runtime.combatEngaged = false
    return runtime
  }

  if (state === 'active') runtime.combatEngaged = true
  const fighting = state === 'active' || runtime.combatEngaged

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
    runtime.gx = M5_TRUMP_BOSS_SPAWN.gx
    runtime.gy = M5_TRUMP_BOSS_SPAWN.gy
    return runtime
  }

  if (!fighting) {
    runtime.idlePhase += dt * 1.4
    runtime.gx = M5_TRUMP_BOSS_SPAWN.gx + Math.sin(runtime.idlePhase) * 0.08
    runtime.gy = M5_TRUMP_BOSS_SPAWN.gy + Math.cos(runtime.idlePhase * 0.9) * 0.08
    runtime.targetWallet = null
    runtime.facing = Math.PI + Math.sin(runtime.idlePhase * 0.5) * 0.12
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

  const dx = target.gx - runtime.gx
  const dy = target.gy - runtime.gy
  const dist = Math.hypot(dx, dy) || 0.001
  runtime.facing = bossFacingFromDelta(dx, dy)
  const speed = (MOVE_SPD / 40) * M5_TRUMP_BOSS_SPEED_MULT * dt
  const inAttackRange = dist <= M5_TRUMP_BOSS_ATTACK_RANGE

  if (!inAttackRange) {
    runtime.gx += (dx / dist) * speed
    runtime.gy += (dy / dist) * speed
  }

  if (!inAttackRange) return runtime

  const now = performance.now()
  if (now - runtime.lastAttackMs < M5_TRUMP_BOSS_ATTACK_COOLDOWN_MS) return runtime
  runtime.lastAttackMs = now
  runtime.attackUntil = now + 420

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

export function syncBossVisual(group, runtime, bossState, time) {
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

  group.position.set(runtime.gx, 0, runtime.gy)
  group.rotation.y = Number.isFinite(runtime.facing) ? runtime.facing : Math.PI

  const bodyPivot = group.userData.bodyPivot
  if (bodyPivot) {
    bodyPivot.position.y = bob
    bodyPivot.scale.setScalar(hitFlash ? 1.04 : attacking ? 1.08 : 1)
    bodyPivot.position.z = attacking ? -0.12 : 0
  }

  const label = group.userData.nameLabel
  if (label) {
    label.position.y = 2.55 * M5_TRUMP_BOSS_SCALE + bob
  }
  if (label?.material?.color) {
    label.material.color.set(active ? '#fb923c' : '#fbbf24')
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
