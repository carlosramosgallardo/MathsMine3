/**
 * Held Ledger Nano S — replaces the procedural USB staff for players and bots.
 *
 * Source: Sketchfab "Ledger Nano S" by rtql8d (CC BY 4.0), baked by
 * scripts/bake-prop-glb.mjs into public/models/tool-usb.glb. The device is
 * oriented as a short baton: USB-port end at the tool pivot (where the hand's
 * mini-USB docks), body extending up and slightly outward so a humanoid grip
 * reads, not a full-body staff.
 */
export const LEDGER_TOOL_URL = '/models/tool-usb.glb'

/** Parent-space length of the held device (crown is 1.075). */
export const LEDGER_HOLD_LENGTH = 0.30

/**
 * Rest lean of the baton in the tool group: negative Z pitch tips the tip
 * forward/out, matching how a hand holds a short stick at the hip.
 */
export const LEDGER_HOLD_ANGLE = -0.52

/** Sword/stick slash — windup high, cut down-diagonal, slight follow-through. */
export const LEDGER_SWING = Object.freeze({
  pitch: 1.35,
  yaw: 0.55,
  roll: 0.42,
  jumpPitch: 1.35,
  jumpWaggle: 0.32,
  carJumpPitch: 1.2,
  carJumpWaggle: 0.38,
})

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
  position = [0.277, 0.168, -0.05],
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
  // Arc: raise behind the shoulder early, slash across, settle.
  const raise = Math.sin(s * Math.PI) // 0→1→0 over the swing
  const cut = Math.sin(Math.min(1, s * 1.15) * Math.PI)
  tool.rotation.x = -raise * LEDGER_SWING.pitch + cut * 0.35
  tool.rotation.y = cut * LEDGER_SWING.yaw
  tool.rotation.z = raise * LEDGER_SWING.roll - cut * 0.55
}

/**
 * Right-arm windup → diagonal slash matching poseLedgerSwing (third-person).
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
  const raise = Math.sin(s * Math.PI)
  const cut = Math.sin(Math.min(1, s * 1.15) * Math.PI)
  const hold = Number(arm.userData.holdPitch) || 0.42
  arm.rotation.x = hold - raise * 1.15 + cut * 1.55
  arm.rotation.z = (arm.userData.baseRotZ || 0) + (arm.userData.holdRoll || 0)
    - raise * 0.55 - cut * 0.25
}

/**
 * Nudge the right arm into a natural hold: slightly forward and in, so the
 * mini-USB hand meets the Ledger instead of hanging at a parade rest.
 */
export function poseLedgerHoldArm(bodyParts) {
  const arm = bodyParts?.rightArm
  if (!arm) return
  arm.userData.holdPitch = 0.42
  arm.userData.holdRoll = -0.08
  arm.rotation.x = arm.userData.holdPitch
  arm.rotation.z = (arm.userData.baseRotZ || 0) + arm.userData.holdRoll
}
