/**
 * Held Ledger Nano S — replaces the procedural USB staff for players and bots.
 *
 * Source: Sketchfab "Ledger Nano S" by rtql8d (CC BY 4.0), baked by
 * scripts/bake-prop-glb.mjs into public/models/tool-usb.glb. Held like a short
 * sword / baton: USB-port end at the tool pivot (hand dock), body extending up
 * and a little outward. On a hit the tip aims at the look/crosshair.
 */
export const LEDGER_TOOL_URL = '/models/tool-usb.glb'

/** Parent-space length of the held device (crown is 1.075). */
export const LEDGER_HOLD_LENGTH = 0.38

/**
 * Rest lean baked into the GLB fit: mostly upright, a little forward so the
 * stick reads as a short sword instead of a hip-holstered baton.
 */
export const LEDGER_HOLD_ANGLE = -0.16

/**
 * Tool-group rest: tip up, slightly forward (−Z) and out (+X) of a right-hand
 * grip. poseLedgerSwing blends from this toward the look/crosshair on the cut.
 */
export const LEDGER_REST = Object.freeze({
  x: -0.14,
  y: 0.08,
  z: -0.32,
})

/** Rest tip direction in tool-parent space (matches LEDGER_REST on local +Y). */
export const LEDGER_REST_DIR = Object.freeze({
  x: 0.30,
  y: 1,
  z: -0.22,
})

/** Overhead baton smash — windup high behind the shoulder, slam down-diagonal. */
export const LEDGER_SWING = Object.freeze({
  pitch: 1.85,
  yaw: 0.72,
  roll: 0.55,
  cutPitch: 1.15,
  cutYaw: 0.38,
  jumpPitch: 1.35,
  jumpWaggle: 0.32,
  carJumpPitch: 1.2,
  carJumpWaggle: 0.38,
})

/** Right-arm hold: sword guard, elbow in, blade up and a little out. */
export const LEDGER_HOLD_ARM = Object.freeze({
  pitch: 0.88,
  roll: -0.32,
})

/** Euler that points the tool's local +Y (USB tip) at a parent-space direction. */
export function ledgerTipEuler(aimX, aimY, aimZ) {
  const len = Math.hypot(aimX, aimY, aimZ) || 1
  const x = aimX / len
  const y = aimY / len
  const z = aimZ / len
  return {
    x: Math.atan2(z, y || 1e-8),
    y: 0,
    z: Math.atan2(-x, y || 1e-8),
  }
}

let protoPromise = null

async function loadLedgerPrototype(THREE) {
  if (typeof window === 'undefined') return null
  if (protoPromise) return protoPromise
  protoPromise = import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(LEDGER_TOOL_URL))
    .then((gltf) => {
      const root = gltf.scene
      // Source lies along Z (USB ↔ keychain). Measure and pin the USB end to the
      // origin so the mini-USB hand docks into the port, then stand the body up.
      const box = new THREE.Box3().setFromObject(root)
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)
      // Prefer the more negative Z as the USB end (connector sits past the body).
      const usbZ = box.min.z
      root.position.set(-center.x, -center.y, -usbZ)
      root.updateMatrixWorld(true)
      const length = Math.max(size.x, size.y, size.z) || 1
      const scale = LEDGER_HOLD_LENGTH / length
      const fit = new THREE.Group()
      fit.name = 'ledgerToolFit'
      fit.add(root)
      // Z → Y (stand up), then lean like a held baton.
      fit.rotation.x = -Math.PI / 2
      fit.rotation.z = LEDGER_HOLD_ANGLE
      fit.scale.setScalar(scale)
      return { fit, materials: collectMaterials(root) }
    })
    .catch((err) => {
      protoPromise = null
      console.warn('[ledger-tool]', err)
      return null
    })
  return protoPromise
}

function collectMaterials(root) {
  const mats = []
  root.traverse((obj) => {
    if (!obj.isMesh) return
    obj.frustumCulled = false
    if (obj.material && !mats.includes(obj.material)) mats.push(obj.material)
  })
  return mats
}

/**
 * Build the held-tool group. Until the GLB streams in, a thin dark stick keeps
 * the grip readable; the GLB replaces it. Pivot stays at the hand dock point —
 * swing animations rotate this group.
 */
export function createLedgerTool(THREE, {
  position = [0.26, 0.62, -0.06],
  tint = null,
} = {}) {
  const tool = new THREE.Group()
  tool.name = 'ledgerTool'
  tool.position.set(position[0], position[1], position[2])

  const placeholder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, LEDGER_HOLD_LENGTH, 8),
    new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55, metalness: 0.35 }),
  )
  placeholder.rotation.z = LEDGER_HOLD_ANGLE
  placeholder.position.set(
    Math.sin(-LEDGER_HOLD_ANGLE) * LEDGER_HOLD_LENGTH * 0.5,
    Math.cos(-LEDGER_HOLD_ANGLE) * LEDGER_HOLD_LENGTH * 0.5,
    0,
  )
  tool.add(placeholder)

  loadLedgerPrototype(THREE).then((proto) => {
    if (!proto || !tool.parent) return
    const clone = proto.fit.clone(true)
    clone.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return
      obj.material = obj.material.clone()
      if (obj.material.map) {
        obj.material.map.colorSpace = THREE.SRGBColorSpace
        obj.material.map.anisotropy = 4
      }
      if (tint && /plastic|black|matte/i.test(obj.material.name || '')) {
        obj.material.color?.set(tint)
      }
    })
    placeholder.removeFromParent()
    placeholder.geometry.dispose()
    placeholder.material.dispose()
    tool.add(clone)
    tool.userData.ledgerReady = true
  })

  return tool
}

/** Apply a combat/jump baton pose onto the tool group. */
export function poseLedgerSwing(tool, {
  swing = 0,
  jump = false,
  carJump = false,
  time = 0,
  aimX = null,
  aimY = null,
  aimZ = null,
} = {}) {
  if (!tool) return
  if (jump && carJump) {
    tool.rotation.x = -LEDGER_SWING.carJumpPitch + Math.sin(time * 11) * LEDGER_SWING.carJumpWaggle
    tool.rotation.z = Math.sin(time * 7.3) * LEDGER_SWING.carJumpWaggle
    tool.rotation.y = 0
    return
  }
  if (jump) {
    tool.rotation.x = -LEDGER_SWING.jumpPitch + Math.sin(time * 13) * 0.4
    tool.rotation.z = 0
    tool.rotation.y = 0
    return
  }
  const s = Math.max(0, Math.min(1, Number(swing) || 0))
  if (s <= 0.001) {
    tool.rotation.x = LEDGER_REST.x
    tool.rotation.y = LEDGER_REST.y
    tool.rotation.z = LEDGER_REST.z
    return
  }
  const hasAim = Number.isFinite(aimX) && Number.isFinite(aimY) && Number.isFinite(aimZ)
  if (hasAim) {
    const tip = ledgerTipEuler(
      LEDGER_REST_DIR.x + (aimX - LEDGER_REST_DIR.x) * s,
      LEDGER_REST_DIR.y + (aimY - LEDGER_REST_DIR.y) * s,
      LEDGER_REST_DIR.z + (aimZ - LEDGER_REST_DIR.z) * s,
    )
    tool.rotation.x = LEDGER_REST.x + (tip.x - LEDGER_REST.x) * s
    tool.rotation.y = LEDGER_REST.y + (tip.y - LEDGER_REST.y) * s
    tool.rotation.z = LEDGER_REST.z + (tip.z - LEDGER_REST.z) * s
    return
  }
  // Windup raises the baton behind the shoulder; cut slams it down-diagonal.
  const raise = Math.sin(Math.min(1, s / 0.42) * Math.PI * 0.5) * (s < 0.55 ? 1 : Math.max(0, 1 - (s - 0.55) / 0.45))
  const cut = s > 0.38 ? Math.sin(Math.min(1, (s - 0.38) / 0.42) * Math.PI) : 0
  tool.rotation.x = LEDGER_REST.x - raise * LEDGER_SWING.pitch + cut * LEDGER_SWING.cutPitch
  tool.rotation.y = LEDGER_REST.y + cut * LEDGER_SWING.yaw - raise * 0.18
  tool.rotation.z = LEDGER_REST.z + raise * LEDGER_SWING.roll - cut * LEDGER_SWING.cutYaw
}

/**
 * Right-arm windup → overhead baton smash matching poseLedgerSwing.
 * `swing` is the same 0..1 envelope used for the tool (sin of progress π).
 */
export function poseLedgerSwingArm(bodyParts, swing = 0) {
  const arm = bodyParts?.rightArm
  if (!arm) return
  const s = Math.max(0, Math.min(1, Number(swing) || 0))
  if (s <= 0.001) {
    if (Number.isFinite(arm.userData.holdPitch)) {
      arm.rotation.x = arm.userData.holdPitch
      arm.rotation.z = (arm.userData.baseRotZ || 0) + (arm.userData.holdRoll || 0)
    }
    return
  }
  const raise = Math.sin(Math.min(1, s / 0.42) * Math.PI * 0.5) * (s < 0.55 ? 1 : Math.max(0, 1 - (s - 0.55) / 0.45))
  const cut = s > 0.38 ? Math.sin(Math.min(1, (s - 0.38) / 0.42) * Math.PI) : 0
  const hold = Number(arm.userData.holdPitch) || LEDGER_HOLD_ARM.pitch
  // Raise behind the head, then whip forward/down like a police baton.
  arm.rotation.x = hold - raise * 1.75 + cut * 2.15
  arm.rotation.z = (arm.userData.baseRotZ || 0) + (arm.userData.holdRoll || 0)
    - raise * 0.85 - cut * 0.35
}

/**
 * Nudge the right arm into a sword/baton guard: forward and slightly across
 * the torso so the mini-USB hand meets the Ledger ready to strike.
 */
export function poseLedgerHoldArm(bodyParts) {
  const arm = bodyParts?.rightArm
  if (!arm) return
  arm.userData.holdPitch = LEDGER_HOLD_ARM.pitch
  arm.userData.holdRoll = LEDGER_HOLD_ARM.roll
  arm.rotation.x = arm.userData.holdPitch
  arm.rotation.z = (arm.userData.baseRotZ || 0) + arm.userData.holdRoll
}
