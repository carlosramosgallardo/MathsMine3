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

export function createM5TrumpBossVisual(THREE, texture) {
  const group = new THREE.Group()
  group.name = 'm5TrumpBoss'
  group.userData.m5TrumpBoss = true

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(spriteMat)
  sprite.scale.set(1.35 * M5_TRUMP_BOSS_SCALE, 2.05 * M5_TRUMP_BOSS_SCALE, 1)
  sprite.position.y = 1.05 * M5_TRUMP_BOSS_SCALE
  sprite.renderOrder = 6
  group.add(sprite)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55 * M5_TRUMP_BOSS_SCALE, 24),
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

  group.position.set(M5_TRUMP_BOSS_SPAWN.gx, 0, M5_TRUMP_BOSS_SPAWN.gy)
  return { group, sprite, label }
}

export function createBossRuntime(state) {
  return {
    gx: M5_TRUMP_BOSS_SPAWN.gx,
    gy: M5_TRUMP_BOSS_SPAWN.gy,
    targetWallet: null,
    lastAttackMs: 0,
    idlePhase: Math.random() * Math.PI * 2,
    visible: state !== 'dead',
  }
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
    const exists = fighters.some(f => f.wallet.toLowerCase() === myIdentity.toLowerCase())
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
  myDead,
  localGx,
  localGy,
  onAttack,
  onRequestIdle,
}) {
  if (!runtime || mapId !== '5') return runtime
  const state = bossState?.state || 'idle'
  runtime.visible = state !== 'dead'
  if (state === 'dead') return runtime

  const fighters = listAliveFightersOnM5(presenceMap, mapId, myIdentity, myDead)
  for (const fighter of fighters) {
    if (fighter.isLocal) {
      fighter.gx = localGx
      fighter.gy = localGy
    }
  }

  if (state === 'active' && fighters.length === 0) {
    onRequestIdle?.()
    runtime.targetWallet = null
    runtime.gx = M5_TRUMP_BOSS_SPAWN.gx
    runtime.gy = M5_TRUMP_BOSS_SPAWN.gy
    return runtime
  }

  if (state === 'idle') {
    runtime.idlePhase += dt * 1.4
    runtime.gx = M5_TRUMP_BOSS_SPAWN.gx + Math.sin(runtime.idlePhase) * 0.08
    runtime.gy = M5_TRUMP_BOSS_SPAWN.gy + Math.cos(runtime.idlePhase * 0.9) * 0.08
    runtime.targetWallet = null
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
  const speed = (MOVE_SPD / 40) * M5_TRUMP_BOSS_SPEED_MULT * dt

  if (dist > M5_TRUMP_BOSS_ATTACK_RANGE * 0.92) {
    runtime.gx += (dx / dist) * speed
    runtime.gy += (dy / dist) * speed
    return runtime
  }

  const now = performance.now()
  if (now - runtime.lastAttackMs < M5_TRUMP_BOSS_ATTACK_COOLDOWN_MS) return runtime
  runtime.lastAttackMs = now

  if (target.wallet?.toLowerCase() === myIdentity?.toLowerCase() && !myDead) {
    onAttack?.({
      wallet: myIdentity,
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
  group.position.set(runtime.gx, 0, runtime.gy)
  const bob = bossState?.state === 'idle' ? Math.sin(time * 2.2 + runtime.idlePhase) * 0.06 : Math.sin(time * 4.5) * 0.03
  const sprite = group.children.find(c => c.isSprite && c.position.y > 0.5)
  if (sprite) sprite.position.y = 1.05 * M5_TRUMP_BOSS_SCALE + bob
}

export function isBossInSwingRange(runtime, playerGx, playerGy) {
  if (!runtime || runtime.visible === false) return false
  return Math.hypot(playerGx - runtime.gx, playerGy - runtime.gy) <= M5_TRUMP_BOSS_HIT_RANGE
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
