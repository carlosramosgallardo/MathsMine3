import { attachBotEyeGlows } from './boss-head-photo'
import { attachHumanoidGlb, humanoidGlbHandSpan, HUMANOID_GLB_URL } from './humanoid-glb'
import { unitRandom } from '@/lib/game-random'

/**
 * Low-poly humanoid rig — shared by bosses, statues and wallet bots.
 * Same footprint as the voxel bodies it replaced: feet on y=0, torso top
 * at 0.72 (BOSS_TORSO_TOP_Y) so mask heads and the bot head mount stay
 * put, half-width ≤ 0.38 so hit bounds, scales and camera framing stay
 * valid. Visual mesh is public/models/man.glb (A-pose body + clips); capsule
 * flesh hides once it loads. USB/RJ45 parent to the hand bones so the plug
 * follows the arm and aims forward when a boss points; until then they ride
 * the animation wrist.
 *
 * options.mat(color, roughness, metalness) — caller's material factory.
 * options.colors — { skin, torso, arms, hands, legs, shoes, sole, belt }.
 * options.bulk — physique width multiplier (1 = slim, ~1.1 = broad).
 * options.handStyle — 'sphere' (default), 'rj45' (bosses/statue: an RJ45
 *   connector with gold contacts instead of a fist) or 'miniusb' (bots/players:
 *   a metal mini-USB plug pointing down; the right one docks into the staff's
 *   mini-USB port).
 * options.sleeve — 'long' (default, suits), 'short' (tees), 'bare' (shirtless).
 * options.photoHead — bosses/statues: hide the scanned skull so the portrait
 *   head stays. Bots keep the scanned head.
 * options.glbUrl — per-character body GLB; defaults to the shared man.glb.
 * options.preserveMap — keep the baked albedo (textured character scans)
 *   instead of tinting cloth bands over a neutral body.
 *
 * Returns named parts; arm/leg groups pivot at shoulder/hip and carry
 * userData.baseX/baseY so animations can offset from the build pose instead
 * of hardcoding voxel-era coordinates. The arm groups are also registered on
 * parent.userData.humanArms so swayHumanoidArms() can find them.
 */
export function buildHumanoidBody(THREE, parent, options) {
  const {
    mat,
    colors,
    lowDetail = false,
    bulk = 1,
    handStyle = 'sphere',
    // 'long' (suits), 'short' (tees), 'bare' (shirtless — Putin).
    sleeve = 'long',
    photoHead = false,
    glbUrl = HUMANOID_GLB_URL,
    preserveMap = false,
  } = options
  const b = bulk
  const seg = lowDetail ? 6 : 12
  const capSeg = lowDetail ? 2 : 4
  const shirted = String(colors.torso || '').toLowerCase() !== String(colors.skin || '').toLowerCase()

  const skinMat = mat(colors.skin, 0.74, 0.02)
  const torsoMat = mat(colors.torso, 0.88, 0)
  const armMat = mat(colors.arms ?? colors.torso, 0.88, 0)
  const handMat = colors.hands ? mat(colors.hands, 0.74, 0.02) : skinMat
  const legMat = mat(colors.legs, 0.86, 0)
  const shoeMat = mat(colors.shoes, 0.62, 0.04)
  const soleMat = mat(colors.sole || '#1a1917', 0.78, 0.03)
  const beltMat = mat(colors.belt || '#1c1916', 0.7, 0.06)
  const upperArmMat = sleeve === 'bare' ? skinMat : armMat
  const forearmMat = sleeve === 'long' ? armMat : skinMat

  const parts = { bodyMeshes: [] }
  const add = (mesh, target = parent) => {
    target.add(mesh)
    parts.bodyMeshes.push(mesh)
    return mesh
  }

  // Pelvis is trousers, not the same cloth as the chest — avoids the onesie/bot look.
  const hips = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, seg + 4, seg), legMat))
  hips.scale.set(0.30 * b, 0.18, 0.23)
  hips.position.set(0, 0.35, 0)
  parts.hips = hips
  const belt = add(new THREE.Mesh(new THREE.CylinderGeometry(0.168 * b, 0.168 * b, 0.03, seg + 2), beltMat))
  belt.position.set(0, 0.405, 0)

  // Torso: tapered trunk + chest. Shirt hem overlaps the belt so it tucks in.
  const trunk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.125, 0.26, seg + 4), torsoMat))
  trunk.scale.set(1.48 * b, 1, 0.82)
  trunk.position.set(0, 0.545, 0)
  parts.torso = trunk
  const chest = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, seg + 4, seg), torsoMat))
  chest.scale.set(0.40 * b, 0.17, 0.22)
  chest.position.set(0, 0.655, 0.01)
  parts.chest = chest
  const traps = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, 8), torsoMat))
  traps.scale.set(0.36 * b, 0.08, 0.16)
  traps.position.set(0, 0.695, 0.04)
  const waist = add(new THREE.Mesh(new THREE.CylinderGeometry(0.13 * b, 0.16 * b, 0.10, seg + 2), torsoMat))
  waist.scale.set(1.15, 1, 0.78)
  waist.position.set(0, 0.455, 0)
  if (!lowDetail) {
    const pecMat = shirted ? torsoMat : skinMat
    for (const side of [-1, 1]) {
      const pec = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, 8), pecMat))
      pec.scale.set(0.13 * b, 0.09, 0.07)
      pec.position.set(side * 0.09 * b, 0.625, -0.10)
      const lat = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), torsoMat))
      lat.scale.set(0.08 * b, 0.12, 0.07)
      lat.position.set(side * 0.16 * b, 0.54, 0.04)
    }
  }
  if (!shirted && !lowDetail) {
    for (const [ay, az] of [[0.54, -0.10], [0.49, -0.095], [0.445, -0.09]]) {
      for (const side of [-1, 1]) {
        const abs = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 6), skinMat))
        abs.scale.set(0.055 * b, 0.028, 0.03)
        abs.position.set(side * 0.04 * b, ay, az)
      }
    }
  }
  if (shirted) {
    const hem = add(new THREE.Mesh(new THREE.CylinderGeometry(0.20 * b, 0.19 * b, 0.05, seg + 2), torsoMat))
    hem.position.set(0, 0.42, 0)
    const collar = add(new THREE.Mesh(new THREE.TorusGeometry(0.072 * b, 0.016, 5, seg), torsoMat))
    collar.rotation.x = Math.PI / 2
    collar.position.set(0, 0.698, 0.01)
  }

  // RJ45 connector hand: pale plastic shell, dark port face with gold
  // contacts, and the latch clip on the back — pointing down like a fist.
  // Sized to the scanned palm (not the old staff-scale Type-A plug).
  const makeRj45Hand = () => {
    const hand = new THREE.Group()
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.058, 0.032), mat('#d8e7ef', 0.22, 0.72))
    parts.bodyMeshes.push(shell)
    hand.add(shell)
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.008, 0.024), new THREE.MeshBasicMaterial({ color: '#041019' }))
    face.position.y = -0.032
    parts.bodyMeshes.push(face)
    hand.add(face)
    const goldMat = new THREE.MeshBasicMaterial({ color: '#facc15' })
    for (const px of [-0.012, 0, 0.012]) {
      const contact = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.014), goldMat)
      contact.position.set(px, -0.035, 0)
      parts.bodyMeshes.push(contact)
      hand.add(contact)
    }
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.034, 0.009), mat('#b7c6d1', 0.3, 0.5))
    clip.position.set(0, 0.003, 0.022)
    parts.bodyMeshes.push(clip)
    hand.add(clip)
    return hand
  }

  // Mini-USB connector hand: wallet-coloured rubber overmold at the wrist and
  // a flattened tapering metal shell pointing down (insertion axis -y), with a
  // dark contact face at the tip. Fits the scanned palm the same as the RJ45.
  const makeMiniUsbHand = () => {
    const hand = new THREE.Group()
    const mold = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.028, seg), handMat)
    mold.position.y = 0.004
    parts.bodyMeshes.push(mold)
    hand.add(mold)
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.024, 4, 1), mat('#cbd8e0', 0.25, 0.8))
    shell.rotation.y = Math.PI / 4
    shell.scale.z = 0.62
    shell.position.y = -0.022
    parts.bodyMeshes.push(shell)
    hand.add(shell)
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.006, 4, 1), new THREE.MeshBasicMaterial({ color: '#041019' }))
    face.rotation.y = Math.PI / 4
    face.scale.z = 0.62
    face.position.y = -0.036
    parts.bodyMeshes.push(face)
    hand.add(face)
    return hand
  }

  // Arms: pivot at the shoulder; slight A-pose so they read relaxed
  const makeArm = (side) => {
    const arm = new THREE.Group()
    arm.position.set(side * 0.235 * b, 0.655, 0)
    arm.userData.baseX = arm.position.x
    arm.userData.baseY = arm.position.y
    // Positive-away tilt: the arm tip leans outward from the torso.
    arm.rotation.z = side * 0.09
    arm.userData.baseRotZ = arm.rotation.z
    arm.userData.swayPhase = unitRandom() * Math.PI * 2
    parent.add(arm)

    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, seg), upperArmMat)
    deltoid.scale.set(0.12, 0.10, 0.11)
    parts.bodyMeshes.push(deltoid)
    arm.add(deltoid)
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.11, capSeg, seg), upperArmMat)
    upper.position.set(0, -0.112, 0)
    parts.bodyMeshes.push(upper)
    arm.add(upper)
    if (!lowDetail) {
      const bicep = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, 8), upperArmMat)
      bicep.scale.set(0.055, 0.07, 0.05)
      bicep.position.set(-side * 0.02, -0.12, -0.03)
      parts.bodyMeshes.push(bicep)
      arm.add(bicep)
    }
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), forearmMat)
    elbow.position.set(0, -0.22, -0.008)
    parts.bodyMeshes.push(elbow)
    arm.add(elbow)
    if (sleeve === 'short') {
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.01, 4, seg), armMat)
      cuff.rotation.x = Math.PI / 2
      cuff.position.set(0, -0.20, 0)
      parts.bodyMeshes.push(cuff)
      arm.add(cuff)
    }
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.11, capSeg, seg), forearmMat)
    forearm.position.set(0, -0.30, -0.018)
    forearm.rotation.x = -0.14
    parts.bodyMeshes.push(forearm)
    arm.add(forearm)
    if (sleeve === 'long') {
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.009, 4, seg), armMat)
      cuff.rotation.x = Math.PI / 2
      cuff.position.set(0, -0.365, -0.038)
      parts.bodyMeshes.push(cuff)
      arm.add(cuff)
    }
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.035, seg), skinMat)
    wrist.position.set(0, -0.388, -0.044)
    parts.bodyMeshes.push(wrist)
    arm.add(wrist)
    let hand
    if (handStyle === 'rj45') {
      hand = makeRj45Hand()
    } else if (handStyle === 'miniusb') {
      hand = makeMiniUsbHand()
    } else {
      hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, seg, seg), handMat)
      parts.bodyMeshes.push(hand)
    }
    hand.position.set(0, -0.415, -0.05)
    if (handStyle === 'rj45' || handStyle === 'miniusb') {
      const native = handStyle === 'rj45' ? 0.058 : 0.052
      hand.userData.connectorNative = native
      hand.scale.setScalar(humanoidGlbHandSpan(b) / native)
    }
    arm.add(hand)
    return { arm, hand, upper, forearm }
  }
  const left = makeArm(-1)
  const right = makeArm(1)
  parts.leftArm = left.arm
  parts.rightArm = right.arm
  parts.leftHand = left.hand
  parts.rightHand = right.hand

  // Legs: pivot at the hip; thigh + calf + shoe
  const makeLeg = (side) => {
    const leg = new THREE.Group()
    leg.position.set(side * 0.105 * b, 0.34, 0)
    leg.userData.baseX = leg.position.x
    leg.userData.baseY = leg.position.y
    parent.add(leg)

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.11, capSeg, seg), legMat)
    thigh.position.set(0, -0.08, 0)
    parts.bodyMeshes.push(thigh)
    leg.add(thigh)
    if (!lowDetail) {
      const glute = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, 8), legMat)
      glute.scale.set(0.09, 0.08, 0.07)
      glute.position.set(0, -0.02, 0.05)
      parts.bodyMeshes.push(glute)
      leg.add(glute)
      const quad = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, 8), legMat)
      quad.scale.set(0.07, 0.09, 0.055)
      quad.position.set(0, -0.09, -0.04)
      parts.bodyMeshes.push(quad)
      leg.add(quad)
    }
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.046, seg, 8), legMat)
    knee.position.set(0, -0.155, 0)
    parts.bodyMeshes.push(knee)
    leg.add(knee)
    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.11, capSeg, seg), legMat)
    calf.position.set(0, -0.23, -0.004)
    parts.bodyMeshes.push(calf)
    leg.add(calf)
    if (!lowDetail) {
      const calfBelly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), legMat)
      calfBelly.scale.set(0.05, 0.07, 0.055)
      calfBelly.position.set(0, -0.22, 0.03)
      parts.bodyMeshes.push(calfBelly)
      leg.add(calfBelly)
    }

    const shoe = new THREE.Group()
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, 8), shoeMat)
    upper.scale.set(0.09, 0.042, 0.12)
    upper.position.set(0, 0.01, -0.018)
    parts.bodyMeshes.push(upper)
    shoe.add(upper)
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), shoeMat)
    toe.scale.set(0.068, 0.032, 0.075)
    toe.position.set(0, 0.004, -0.082)
    parts.bodyMeshes.push(toe)
    shoe.add(toe)
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.014, 0.17), soleMat)
    sole.position.set(0, -0.016, -0.028)
    parts.bodyMeshes.push(sole)
    shoe.add(sole)
    shoe.position.set(0, -0.3125, -0.028)
    shoe.userData.baseY = shoe.position.y
    leg.add(shoe)
    return { leg, shoe }
  }
  const legL = makeLeg(-1)
  const legR = makeLeg(1)
  parts.leftLeg = legL.leg
  parts.rightLeg = legR.leg
  parts.leftShoe = legL.shoe
  parts.rightShoe = legR.shoe

  // Registered on the parent so animation loops can find the limbs without
  // each caller wiring its own references.
  parent.userData.humanArms = [parts.leftArm, parts.rightArm]
  parent.userData.humanLegs = [parts.leftLeg, parts.rightLeg]

  attachHumanoidGlb(THREE, parent, {
    bulk: b,
    hideHead: photoHead,
    colors,
    sleeve,
    bodyMeshes: parts.bodyMeshes,
    hands: [parts.leftHand, parts.rightHand],
    url: glbUrl,
    preserveMap,
  })

  return parts
}

const HUMAN_SKIN_TONES = ['#f3d5c0', '#e8c4a8', '#d4a574', '#c68642', '#8d5524', '#f1c27d']
const HUMAN_HAIR_TONES = ['#1a1410', '#2c1b12', '#3d2918', '#5c3d24', '#1c1916', '#4a3020', '#0a0908']

function hashSeed(seed) {
  const s = String(seed || '')
  let n = 0
  for (let i = 0; i < s.length; i += 1) n = (n * 31 + s.charCodeAt(i)) >>> 0
  return n
}

/** Stable flesh tone from a wallet colour / address string. No extra textures. */
export function humanSkinFromSeed(seed) {
  return HUMAN_SKIN_TONES[hashSeed(seed) % HUMAN_SKIN_TONES.length]
}

/** Natural hair colour from the same seed — not the neon wallet cloth colour. */
export function humanHairFromSeed(seed) {
  return HUMAN_HAIR_TONES[(hashSeed(seed) >>> 8) % HUMAN_HAIR_TONES.length]
}

/**
 * Human head for wallet avatars. Same mount (centre y 0.82) and overall volume
 * as the old robot skull + antenna (crown ~1.075) so hit refs, tags and the
 * RL-car seated pose stay valid. Sclera + iris at idle; attachBotEyeGlows
 * stay hidden until combat red.
 */
export function buildHumanHead(THREE, parent, { skinMat, hairMat, eyeColor = '#22d3ee', lowDetail = false }) {
  const heads = parent.userData.proceduralHeadMeshes || []
  parent.userData.proceduralHeadMeshes = heads
  const addHead = (mesh) => {
    parent.add(mesh)
    heads.push(mesh)
    if (parent.userData.humanoidGlbReady && parent.userData.useGlbHead) mesh.visible = false
    return mesh
  }
  const seg = lowDetail ? 10 : 18
  const earSeg = Math.max(8, seg - 6)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, Math.max(8, seg - 4)), skinMat)
  head.scale.set(0.29, 0.27, 0.26)
  head.position.y = 0.83
  addHead(head)
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, Math.max(8, seg - 4)), skinMat)
  jaw.scale.set(0.22, 0.15, 0.20)
  jaw.position.set(0, 0.70, -0.02)
  addHead(jaw)
  if (!lowDetail) {
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), skinMat)
    chin.scale.set(0.08, 0.055, 0.07)
    chin.position.set(0, 0.635, -0.10)
    addHead(chin)
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.078, 0.09, seg), skinMat)
  neck.position.y = 0.735
  addHead(neck)
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.5, earSeg, 8), skinMat)
  brow.scale.set(0.20, 0.035, 0.07)
  brow.position.set(0, 0.905, -0.11)
  addHead(brow)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.5, earSeg, 8), skinMat)
  nose.scale.set(0.035, 0.055, 0.06)
  nose.position.set(0, 0.805, -0.155)
  addHead(nose)
  if (!lowDetail) {
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), skinMat)
    mouth.scale.set(0.07, 0.016, 0.03)
    mouth.position.set(0, 0.72, -0.14)
    addHead(mouth)
  }
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, Math.max(8, seg - 4)), hairMat)
  hair.scale.set(0.32, 0.20, 0.29)
  hair.position.set(0, 0.97, 0.04)
  addHead(hair)
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.5, earSeg, 8), hairMat)
  backHair.scale.set(0.26, 0.16, 0.12)
  backHair.position.set(0, 0.90, 0.12)
  addHead(backHair)
  const scleraMat = new THREE.MeshBasicMaterial({ color: '#f4f1ea' })
  const irisMat = new THREE.MeshBasicMaterial({ color: '#1a1410' })
  for (const side of [-1, 1]) {
    if (!lowDetail) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.5, earSeg, 8), skinMat)
      cheek.scale.set(0.07, 0.08, 0.055)
      cheek.position.set(side * 0.11, 0.77, -0.08)
      addHead(cheek)
    }
    const sideHair = new THREE.Mesh(new THREE.SphereGeometry(0.5, earSeg, 8), hairMat)
    sideHair.scale.set(0.065, 0.13, 0.09)
    sideHair.position.set(side * 0.155, 0.87, 0.03)
    addHead(sideHair)
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.5, earSeg, 8), skinMat)
    ear.scale.set(0.035, 0.075, 0.05)
    ear.position.set(side * 0.165, 0.81, 0.025)
    addHead(ear)
    if (!lowDetail) {
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), skinMat)
      lid.scale.set(0.038, 0.014, 0.02)
      lid.position.set(side * 0.054, 0.862, -0.145)
      addHead(lid)
    }
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), scleraMat)
    sclera.position.set(side * 0.054, 0.845, -0.148)
    addHead(sclera)
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), irisMat)
    iris.position.set(side * 0.054, 0.845, -0.168)
    addHead(iris)
  }
  attachBotEyeGlows(THREE, parent, {
    color: eyeColor,
    y: 0.845,
    z: -0.172,
    size: 0.038,
    spacing: 0.054,
    idleOpacity: 0,
  })
  return { head }
}

/** @deprecated robot skull; wallet avatars use buildHumanHead. */
export function buildBotRoundHead(THREE, parent, { headMat, frameMat, earMat, eyeColor = '#22d3ee', lowDetail = false }) {
  return buildHumanHead(THREE, parent, {
    skinMat: headMat,
    hairMat: earMat || frameMat || headMat,
    eyeColor,
    lowDetail,
  })
}

/**
 * Human-style walk: legs swing alternately from the hip (shoes ride along at
 * the leg tip, always visible). `phase` is the stride phase (radians); pass 0
 * to reset to standing. `amp` is the swing amplitude in radians.
 */
export function walkHumanoidLegs(host, phase, amp = 0.5) {
  const legs = host?.userData?.humanLegs
  if (!legs) return
  legs[0].rotation.x = Math.sin(phase) * amp
  legs[1].rotation.x = Math.sin(phase + Math.PI) * amp
}

/**
 * Subtle random idle sway for the humanoid arms — small rotations around the
 * build pose, desynchronised per arm via the random swayPhase, so figures
 * read as alive humans instead of statues. Call per frame with scene time.
 * `host` is the object buildHumanoidBody attached to (bodyPivot / avatar).
 */
export function swayHumanoidArms(host, time, intensity = 1) {
  const arms = host?.userData?.humanArms
  if (!arms) return
  for (const arm of arms) {
    const phase = arm.userData.swayPhase || 0
    arm.rotation.x = Math.sin(time * 0.9 + phase) * 0.055 * intensity
    arm.rotation.z = (arm.userData.baseRotZ || 0) + Math.sin(time * 0.63 + phase * 1.7) * 0.045 * intensity
  }
}

/**
 * Mid-air flap — the ON-FOOT jump gesture: arms flapping like wings (as if
 * trying to fly) while the legs pedal an invisible bicycle. Distinct from
 * flailHumanoidJump (the RL-car jump gesture). Reuses each limb's swayPhase
 * seed so no two avatars flap in sync; walk/sway overwrite on landing.
 */
export function flapHumanoidJump(host, time) {
  const arms = host?.userData?.humanArms
  if (arms) {
    for (const arm of arms) {
      const side = (arm.userData.baseX ?? arm.position.x) >= 0 ? 1 : -1
      const phase = arm.userData.swayPhase || 0
      // Wing beat: swings between ~35° and ~125° away from the torso.
      arm.rotation.z = side * (1.4 + Math.sin(time * 12 + phase * 0.3) * 0.8)
      arm.rotation.x = Math.sin(time * 12 + phase * 0.3 + Math.PI / 2) * 0.2
    }
  }
  const legs = host?.userData?.humanLegs
  if (legs) {
    for (const leg of legs) {
      const legPhase = (leg.userData?.baseX ?? 0) >= 0 ? 0 : Math.PI
      leg.rotation.x = -0.25 + Math.sin(time * 12 + legPhase) * 0.65
    }
  }
}

/**
 * Mid-air flail — the RL-CAR jump gesture: both arms thrown up in a V,
 * wiggling, knees tucked, so jumps read as a gleeful "wheee!". Reuses each
 * limb's swayPhase seed so no two avatars flail in sync. The normal
 * walk/sway calls overwrite these rotations on landing, so no restore pass
 * is needed.
 */
export function flailHumanoidJump(host, time) {
  const arms = host?.userData?.humanArms
  if (arms) {
    for (const arm of arms) {
      const side = (arm.userData.baseX ?? arm.position.x) >= 0 ? 1 : -1
      const phase = arm.userData.swayPhase || 0
      arm.rotation.z = side * (2.35 + Math.sin(time * 13 + phase) * 0.42)
      arm.rotation.x = Math.sin(time * 9.5 + phase * 1.7) * 0.38
    }
  }
  const legs = host?.userData?.humanLegs
  if (legs) {
    for (const leg of legs) {
      const phase = (leg.userData?.baseX ?? 0) >= 0 ? 0 : 1.4
      leg.rotation.x = -0.55 + Math.sin(time * 11 + phase) * 0.14
    }
  }
}

/** Front surface z of the humanoid chest (local -z is the facing side). */
export const HUMANOID_CHEST_FRONT_Z = -0.135
