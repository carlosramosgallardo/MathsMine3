/**
 * Auto-rig for a static A-pose humanoid scan.
 *
 * Downloaded body scans ship as one static mesh, but the game poses characters
 * by copying the capsule rig onto named bones (see lib/humanoid-glb.js). This
 * derives those joints from the geometry itself — leg/arm axes, crotch, neck
 * pinch — and paints smooth skin weights, so any A-pose body can be dropped in
 * without hand-authoring a skeleton.
 *
 * Space in / out: Y-up, feet on y=0, facing +Z, character left on +X.
 */

/** Parent → child chain; leaf bones inherit their parent's direction. */
export const BONE_CHAIN = [
  ['Hips', null],
  ['Spine', 'Hips'],
  ['Chest', 'Spine'],
  ['Neck', 'Chest'],
  ['Head', 'Neck'],
  ['LeftShoulder', 'Chest'],
  ['LeftUpperArm', 'LeftShoulder'],
  ['LeftLowerArm', 'LeftUpperArm'],
  ['LeftHand', 'LeftLowerArm'],
  ['RightShoulder', 'Chest'],
  ['RightUpperArm', 'RightShoulder'],
  ['RightLowerArm', 'RightUpperArm'],
  ['RightHand', 'RightLowerArm'],
  ['LeftUpperLeg', 'Hips'],
  ['LeftLowerLeg', 'LeftUpperLeg'],
  ['LeftFoot', 'LeftLowerLeg'],
  ['RightUpperLeg', 'Hips'],
  ['RightLowerLeg', 'RightUpperLeg'],
  ['RightFoot', 'RightLowerLeg'],
]

const BANDS = 128

/** Vertex indices bucketed by height, plus the |x| / z envelope of each slice. */
function sliceMesh(packed, height) {
  const bands = Array.from({ length: BANDS }, () => ({
    items: [], maxAbsX: 0, minZ: Infinity, maxZ: -Infinity,
  }))
  for (let v = 0; v < packed.length / 3; v += 1) {
    const y = packed[v * 3 + 1]
    const band = bands[Math.min(BANDS - 1, Math.max(0, Math.floor((y / height) * BANDS)))]
    band.items.push(v)
    const absX = Math.abs(packed[v * 3])
    if (absX > band.maxAbsX) band.maxAbsX = absX
    if (packed[v * 3 + 2] < band.minZ) band.minZ = packed[v * 3 + 2]
    if (packed[v * 3 + 2] > band.maxZ) band.maxZ = packed[v * 3 + 2]
  }
  return bands
}

const bandIndex = (y, height) => Math.min(BANDS - 1, Math.max(0, Math.floor((y / height) * BANDS)))
const bandY = (index, height) => ((index + 0.5) / BANDS) * height

function lowestY(packed, filter) {
  let low = Infinity
  for (let v = 0; v < packed.length / 3; v += 1) {
    if (!filter(packed[v * 3], packed[v * 3 + 1], packed[v * 3 + 2])) continue
    if (packed[v * 3 + 1] < low) low = packed[v * 3 + 1]
  }
  return low
}

/**
 * Follow one limb up the body: start from a seed slice centre and, band by
 * band, re-centre on the vertices closest to where the limb was. Far more
 * reliable on an A-pose than slicing by a fixed |x| threshold, because arms
 * and torso overlap in x near the shoulder.
 */
function traceLimb(packed, bands, { seedY, stopY, height, side, radius, inner = false }) {
  const from = bandIndex(seedY, height)
  const to = bandIndex(stopY, height)
  const step = to >= from ? 1 : -1
  let center = null
  const path = []
  for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
    const band = bands[i]
    if (!band.items.length) continue
    let sx = 0; let sz = 0; let n = 0
    for (const v of band.items) {
      const x = packed[v * 3]
      const z = packed[v * 3 + 2]
      if (side && Math.sign(x) !== side) continue
      if (center) {
        if (Math.hypot(x - center.x, z - center.z) > radius) continue
      } else if (inner ? Math.abs(x) > radius : Math.abs(x) < radius) {
        continue
      }
      sx += x; sz += z; n += 1
    }
    if (n < 4) continue
    center = { x: sx / n, z: sz / n }
    path.push({ y: bandY(i, height), x: center.x, z: center.z })
  }
  return path
}

/** Point on a traced limb at a given height (nearest sample). */
function atHeight(path, y, fallback) {
  if (!path.length) return fallback
  let best = path[0]
  for (const point of path) {
    if (Math.abs(point.y - y) < Math.abs(best.y - y)) best = point
  }
  return best
}

/** Depth centre of a slice, ignoring the arms so the belly does not bias it. */
function torsoDepthCenter(packed, bands, height, loY, hiY, armMinX) {
  let minZ = Infinity; let maxZ = -Infinity
  for (let i = bandIndex(loY, height); i <= bandIndex(hiY, height); i += 1) {
    for (const v of bands[i].items) {
      if (Math.abs(packed[v * 3]) > armMinX) continue
      const z = packed[v * 3 + 2]
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
  }
  return Number.isFinite(minZ) ? (minZ + maxZ) / 2 : 0
}

/**
 * Landmarks of an A-pose body, all derived from the mesh: neck pinch, crotch,
 * ankle (where the foot stops being long in z) and traced arm / leg axes.
 */
export function measureHumanoid(packed, height) {
  const bands = sliceMesh(packed, height)

  let neckIndex = Math.floor(BANDS * 0.85)
  let neckWidth = Infinity
  for (let i = Math.floor(BANDS * 0.78); i < Math.floor(BANDS * 0.93); i += 1) {
    if (bands[i].items.length && bands[i].maxAbsX < neckWidth) { neckWidth = bands[i].maxAbsX; neckIndex = i }
  }
  const neckY = bandY(neckIndex, height)
  const crotchY = lowestY(packed, (x, y) => Math.abs(x) < height * 0.02 && y < height * 0.62)

  let ankleIndex = Math.floor(BANDS * 0.05)
  const footDepth = Math.max(...bands.slice(0, Math.floor(BANDS * 0.1)).map((b) => (b.maxZ - b.minZ) || 0))
  for (let i = 0; i < Math.floor(BANDS * 0.2); i += 1) {
    if (!bands[i].items.length) continue
    if (bands[i].maxZ - bands[i].minZ < footDepth * 0.62) { ankleIndex = i; break }
  }
  const ankleY = bandY(ankleIndex, height)

  const shoulderY = neckY - height * 0.095
  const hipsY = crotchY + height * 0.055
  // The hands are the outermost geometry of an A-pose; the fingertips give the
  // bottom of the arm chain.
  let maxAbsX = 0
  for (let v = 0; v < packed.length / 3; v += 1) maxAbsX = Math.max(maxAbsX, Math.abs(packed[v * 3]))
  const armMinX = maxAbsX * 0.62
  const handTipY = lowestY(packed, (x) => Math.abs(x) > armMinX)
  const wristY = handTipY + height * 0.075
  const elbowY = (shoulderY + wristY) / 2

  const side = (sign) => {
    const arm = traceLimb(packed, bands, {
      seedY: handTipY + height * 0.02,
      stopY: shoulderY,
      height,
      side: sign,
      radius: height * 0.075,
    })
    const leg = traceLimb(packed, bands, {
      seedY: ankleY,
      stopY: hipsY,
      height,
      side: sign,
      radius: height * 0.09,
      inner: true,
    })
    const fallbackArm = { x: sign * height * 0.2, z: 0 }
    const fallbackLeg = { x: sign * height * 0.05, z: 0 }
    const shoulder = atHeight(arm, shoulderY, fallbackArm)
    return {
      shoulder,
      elbow: atHeight(arm, elbowY, fallbackArm),
      wrist: atHeight(arm, wristY, fallbackArm),
      hand: atHeight(arm, handTipY + height * 0.03, fallbackArm),
      hip: atHeight(leg, hipsY, fallbackLeg),
      knee: atHeight(leg, (crotchY + ankleY) / 2, fallbackLeg),
      ankle: atHeight(leg, ankleY, fallbackLeg),
      toe: atHeight(leg, ankleY * 0.5, fallbackLeg),
    }
  }

  return {
    height,
    neckY,
    crotchY,
    hipsY,
    shoulderY,
    elbowY,
    wristY,
    handTipY,
    ankleY,
    armMinX,
    left: side(1),
    right: side(-1),
    hipsZ: torsoDepthCenter(packed, bands, height, hipsY - height * 0.03, hipsY + height * 0.03, armMinX),
    spineZ: torsoDepthCenter(packed, bands, height, (hipsY + shoulderY) / 2 - height * 0.03, (hipsY + shoulderY) / 2 + height * 0.03, armMinX),
    chestZ: torsoDepthCenter(packed, bands, height, shoulderY - height * 0.08, shoulderY, armMinX),
    headZ: torsoDepthCenter(packed, bands, height, neckY, height, armMinX),
  }
}

/** Rest positions (model space) for every bone in BONE_CHAIN. */
export function buildSkeleton(m) {
  const h = m.height
  const chestY = m.shoulderY - h * 0.06
  const spineY = (m.hipsY + chestY) / 2
  const joints = {
    Hips: [0, m.hipsY, m.hipsZ],
    Spine: [0, spineY, m.spineZ],
    Chest: [0, chestY, m.chestZ],
    Neck: [0, m.neckY, m.headZ],
    Head: [0, m.neckY + h * 0.035, m.headZ],
  }
  for (const [name, side] of [['Left', m.left], ['Right', m.right]]) {
    joints[`${name}Shoulder`] = [side.shoulder.x * 0.45, m.shoulderY, side.shoulder.z]
    joints[`${name}UpperArm`] = [side.shoulder.x, m.shoulderY - h * 0.01, side.shoulder.z]
    joints[`${name}LowerArm`] = [side.elbow.x, m.elbowY, side.elbow.z]
    joints[`${name}Hand`] = [side.wrist.x, m.wristY, side.wrist.z]
    joints[`${name}UpperLeg`] = [side.hip.x, m.hipsY, side.hip.z]
    joints[`${name}LowerLeg`] = [side.knee.x, (m.crotchY + m.ankleY) / 2, side.knee.z]
    joints[`${name}Foot`] = [side.ankle.x, m.ankleY, side.ankle.z]
  }
  const tips = {
    Head: [0, h, joints.Head[2]],
    LeftHand: [m.left.hand.x, m.handTipY, m.left.hand.z],
    RightHand: [m.right.hand.x, m.handTipY, m.right.hand.z],
    LeftFoot: [m.left.toe.x, 0, m.left.toe.z - h * 0.05],
    RightFoot: [m.right.toe.x, 0, m.right.toe.z - h * 0.05],
  }
  return { joints, tips }
}

function distanceToSegment(px, py, pz, a, b) {
  const abx = b[0] - a[0]; const aby = b[1] - a[1]; const abz = b[2] - a[2]
  const apx = px - a[0]; const apy = py - a[1]; const apz = pz - a[2]
  const lenSq = abx * abx + aby * aby + abz * abz
  const t = lenSq > 1e-9 ? Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / lenSq)) : 0
  const dx = apx - abx * t; const dy = apy - aby * t; const dz = apz - abz * t
  return Math.hypot(dx, dy, dz)
}

const SIDE_OF = (name) => (name.startsWith('Left') ? 1 : name.startsWith('Right') ? -1 : 0)

/**
 * Inverse-distance skin weights against each bone segment, limited to four
 * influences, with limbs masked to their own side so an arm never drags the
 * opposite shoulder. Weights are then relaxed over the welded topology, which
 * is what keeps shoulders and hips from creasing when the capsule rig bends.
 */
export function computeSkinWeights(packed, skeleton, { height, armMinX, smoothing = 8, welded = null }) {
  const names = BONE_CHAIN.map(([name]) => name)
  const segments = names.map((name) => {
    const start = skeleton.joints[name]
    const childName = BONE_CHAIN.find(([, parent]) => parent === name)?.[0]
    const end = childName ? skeleton.joints[childName] : skeleton.tips[name] || start
    return { name, start, end: skeleton.tips[name] && !childName ? skeleton.tips[name] : end }
  })
  const count = packed.length / 3
  const joints = new Uint8Array(count * 4)
  const weights = new Float32Array(count * 4)
  const scored = new Float64Array(names.length)
  const centerBand = height * 0.03

  for (let v = 0; v < count; v += 1) {
    const x = packed[v * 3]; const y = packed[v * 3 + 1]; const z = packed[v * 3 + 2]
    for (let b = 0; b < segments.length; b += 1) {
      const seg = segments[b]
      const side = SIDE_OF(seg.name)
      let mask = 1
      if (side !== 0) {
        // Fade a limb's influence out across the body midline.
        mask = Math.max(0, Math.min(1, (x * side + centerBand) / (centerBand * 2)))
        if (Math.abs(x) < armMinX && seg.name.includes('Arm')) mask *= 0.25
      }
      if (mask <= 0) { scored[b] = 0; continue }
      const d = distanceToSegment(x, y, z, seg.start, seg.end) + height * 0.004
      scored[b] = mask / (d * d * d)
    }
    let total = 0
    for (let k = 0; k < 4; k += 1) {
      let bestIndex = -1
      let bestScore = 0
      for (let b = 0; b < scored.length; b += 1) {
        if (scored[b] > bestScore) { bestScore = scored[b]; bestIndex = b }
      }
      if (bestIndex < 0) break
      joints[v * 4 + k] = bestIndex
      weights[v * 4 + k] = bestScore
      total += bestScore
      scored[bestIndex] = 0
    }
    if (total > 0) for (let k = 0; k < 4; k += 1) weights[v * 4 + k] /= total
  }

  if (welded && smoothing > 0) relaxWeights(joints, weights, welded, names.length, smoothing)
  return { joints, weights, boneNames: names }
}

/** Laplacian relaxation of the weight field over welded vertex neighbours. */
function relaxWeights(joints, weights, welded, boneCount, iterations) {
  const { neighbors, offsets, groupOf, groupCount } = welded
  const dense = new Float32Array(groupCount * boneCount)
  const members = new Float32Array(groupCount)
  const count = joints.length / 4
  for (let v = 0; v < count; v += 1) {
    const g = groupOf[v]
    members[g] += 1
    for (let k = 0; k < 4; k += 1) dense[g * boneCount + joints[v * 4 + k]] += weights[v * 4 + k]
  }
  for (let g = 0; g < groupCount; g += 1) {
    const n = members[g] || 1
    for (let b = 0; b < boneCount; b += 1) dense[g * boneCount + b] /= n
  }
  let src = dense
  let dst = new Float32Array(dense.length)
  for (let step = 0; step < iterations; step += 1) {
    for (let g = 0; g < groupCount; g += 1) {
      const from = offsets[g]
      const to = offsets[g + 1]
      const share = to - from
      for (let b = 0; b < boneCount; b += 1) {
        let sum = src[g * boneCount + b]
        for (let n = from; n < to; n += 1) sum += src[neighbors[n] * boneCount + b]
        dst[g * boneCount + b] = sum / (share + 1)
      }
    }
    const swap = src; src = dst; dst = swap
  }
  for (let v = 0; v < count; v += 1) {
    const g = groupOf[v]
    const picks = []
    for (let b = 0; b < boneCount; b += 1) {
      const w = src[g * boneCount + b]
      if (w > 0.001) picks.push([b, w])
    }
    picks.sort((a, b) => b[1] - a[1])
    const top = picks.slice(0, 4)
    const total = top.reduce((sum, [, w]) => sum + w, 0) || 1
    for (let k = 0; k < 4; k += 1) {
      joints[v * 4 + k] = top[k] ? top[k][0] : 0
      weights[v * 4 + k] = top[k] ? top[k][1] / total : 0
    }
  }
}

/** Linear-blend skinning on the CPU — used to preview a posed bake. */
export function skinPoint(out, x, y, z, jointIndices, jointWeights, matrices) {
  let ox = 0; let oy = 0; let oz = 0
  for (let k = 0; k < 4; k += 1) {
    const w = jointWeights[k]
    if (!w) continue
    const m = matrices[jointIndices[k]]
    ox += w * (m[0] * x + m[4] * y + m[8] * z + m[12])
    oy += w * (m[1] * x + m[5] * y + m[9] * z + m[13])
    oz += w * (m[2] * x + m[6] * y + m[10] * z + m[14])
  }
  out[0] = ox; out[1] = oy; out[2] = oz
  return out
}
