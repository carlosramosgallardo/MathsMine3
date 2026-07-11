import { roundedVoxelGeometry } from './rounded-voxel'
import { attachBotEyeGlows } from './boss-head-photo'

/**
 * Low-poly humanoid body — the "option 2" mold shared by bosses, the statue
 * and the wallet bots. Same footprint as the voxel bodies it replaces:
 * feet on y=0, torso top at 0.72 (BOSS_TORSO_TOP_Y) so mask heads and the
 * bot head mount unchanged, and overall half-width ≤ 0.38 so hit bounds,
 * scales and camera framing stay valid.
 *
 * Everything is capsules/spheres/tapered cylinders — no assets, no skinning:
 * per-avatar cost stays comparable to the voxel build and works with any
 * material factory (Lambert in lowDetail, Standard otherwise).
 *
 * options.mat(color, roughness, metalness) — caller's material factory.
 * options.colors — { skin, torso, arms, hands, legs, shoes }.
 * options.bulk — physique width multiplier (1 = slim, ~1.1 = broad).
 * options.handStyle — 'sphere' (default), 'rj45' (bosses/statue: an RJ45
 *   connector with gold contacts instead of a fist) or 'miniusb' (bots/players:
 *   a metal mini-USB plug pointing down; the right one docks into the staff's
 *   mini-USB port).
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
  } = options
  const b = bulk
  const seg = lowDetail ? 6 : 12
  const capSeg = lowDetail ? 2 : 4

  const skinMat = mat(colors.skin, 0.58, 0.06)
  const torsoMat = mat(colors.torso, 0.5, 0.22)
  const armMat = mat(colors.arms ?? colors.torso, 0.52, 0.2)
  const handMat = colors.hands ? mat(colors.hands, 0.55, 0.08) : skinMat
  const legMat = mat(colors.legs, 0.56, 0.18)
  const shoeMat = mat(colors.shoes, 0.7, 0.3)

  const parts = { bodyMeshes: [] }
  const add = (mesh, target = parent) => {
    target.add(mesh)
    parts.bodyMeshes.push(mesh)
    return mesh
  }

  // Pelvis
  const hips = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, seg + 4, seg), torsoMat))
  hips.scale.set(0.30 * b, 0.20, 0.24)
  hips.position.set(0, 0.36, 0)
  parts.hips = hips

  // Torso: tapered trunk + chest/shoulder cap + deltoids
  const trunk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.28, seg + 4), torsoMat))
  trunk.scale.set(1.5 * b, 1, 0.85)
  trunk.position.set(0, 0.54, 0)
  parts.torso = trunk
  const chest = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, seg + 4, seg), torsoMat))
  chest.scale.set(0.44 * b, 0.20, 0.26)
  chest.position.set(0, 0.665, 0)
  parts.chest = chest

  // RJ45 connector hand: pale plastic shell, dark port face with gold
  // contacts, and the latch clip on the back — pointing down like a fist.
  // Sized to match the USB Type-A plug on the bots' staff (.15 × .22 × .095).
  const makeRj45Hand = () => {
    const hand = new THREE.Group()
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.15, 0.085), mat('#d8e7ef', 0.22, 0.72))
    parts.bodyMeshes.push(shell)
    hand.add(shell)
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.062), new THREE.MeshBasicMaterial({ color: '#041019' }))
    face.position.y = -0.082
    parts.bodyMeshes.push(face)
    hand.add(face)
    const goldMat = new THREE.MeshBasicMaterial({ color: '#facc15' })
    for (const px of [-0.03, 0, 0.03]) {
      const contact = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.036), goldMat)
      contact.position.set(px, -0.088, 0)
      parts.bodyMeshes.push(contact)
      hand.add(contact)
    }
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.09, 0.022), mat('#b7c6d1', 0.3, 0.5))
    clip.position.set(0, 0.008, 0.056)
    parts.bodyMeshes.push(clip)
    hand.add(clip)
    return hand
  }

  // Mini-USB connector hand: wallet-coloured rubber overmold at the wrist and
  // a flattened tapering metal shell pointing down (insertion axis -y), with a
  // dark contact face at the tip. 4-segment cylinders rotated 45° + z-squash
  // give the trapezoid-ish mini-USB cross-section without custom geometry.
  const makeMiniUsbHand = () => {
    const hand = new THREE.Group()
    const mold = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.052, 0.075, seg), handMat)
    mold.position.y = 0.012
    parts.bodyMeshes.push(mold)
    hand.add(mold)
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.030, 0.06, 4, 1), mat('#cbd8e0', 0.25, 0.8))
    shell.rotation.y = Math.PI / 4
    shell.scale.z = 0.62
    shell.position.y = -0.055
    parts.bodyMeshes.push(shell)
    hand.add(shell)
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.020, 0.012, 4, 1), new THREE.MeshBasicMaterial({ color: '#041019' }))
    face.rotation.y = Math.PI / 4
    face.scale.z = 0.62
    face.position.y = -0.086
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
    arm.userData.swayPhase = Math.random() * Math.PI * 2
    parent.add(arm)

    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, seg), armMat)
    deltoid.scale.set(0.115, 0.10, 0.11)
    parts.bodyMeshes.push(deltoid)
    arm.add(deltoid)
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.13, capSeg, seg), armMat)
    upper.position.set(0, -0.115, 0)
    parts.bodyMeshes.push(upper)
    arm.add(upper)
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, capSeg, seg), armMat)
    forearm.position.set(0, -0.30, -0.018)
    forearm.rotation.x = -0.14
    parts.bodyMeshes.push(forearm)
    arm.add(forearm)
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

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.13, capSeg, seg), legMat)
    thigh.position.set(0, -0.085, 0)
    parts.bodyMeshes.push(thigh)
    leg.add(thigh)
    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.13, capSeg, seg), legMat)
    calf.position.set(0, -0.235, -0.006)
    parts.bodyMeshes.push(calf)
    leg.add(calf)
    const shoe = new THREE.Mesh(roundedVoxelGeometry(THREE, 0.11, 0.055, 0.21), shoeMat)
    shoe.position.set(0, -0.3125, -0.028)
    // Step animations offset from this base instead of voxel-era constants.
    shoe.userData.baseY = shoe.position.y
    parts.bodyMeshes.push(shoe)
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

  return parts
}

/**
 * Rounded robot head — the bosses/statue-style skull ellipsoid instead of the
 * old voxel box, keeping the dark socket band and ear pods. The eyes are the
 * boss/statue additive halo glows (attachBotEyeGlows) tagged for
 * setBossMaskEyesRed, replacing the old visor band + display pixel. Same
 * mount height (centre y 0.82) so head references, tags and the RL-car
 * mounted pose stay valid. Returns { head } for userData wiring.
 */
export function buildBotRoundHead(THREE, parent, { headMat, frameMat, earMat, eyeColor = '#22d3ee', lowDetail = false }) {
  const seg = lowDetail ? 10 : 18
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, seg, Math.max(8, seg - 4)), headMat)
  head.scale.set(0.34, 0.28, 0.31)
  head.position.y = 0.82
  parent.add(head)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.10, 0.02), frameMat)
  frame.position.set(0, 0.84, -0.145)
  parent.add(frame)
  attachBotEyeGlows(THREE, parent, { color: eyeColor, y: 0.845, z: -0.162 })
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.5, Math.max(8, seg - 6), 8), earMat)
    ear.scale.set(0.075, 0.11, 0.11)
    ear.position.set(side * 0.175, 0.81, 0)
    parent.add(ear)
  }
  return { head }
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

/** Front surface z of the humanoid chest (local -z is the facing side). */
export const HUMANOID_CHEST_FRONT_Z = -0.135
