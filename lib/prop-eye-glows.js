/**
 * Reposition `bossEyeGlow` sprites onto real eye sockets when possible.
 *
 * Priority:
 * 1. Named eye nodes/meshes (`LeftEye`, `RightEye`, `*Eyeball*`, …)
 * 2. Head-named meshes / upper skull band with nose-tip face axis
 * 3. Percentile AABB of the whole fit (last resort)
 *
 * Face axis uses the nose tip (central-column Z extent from the skull median),
 * never “denser half” — the back of the head is usually denser and used to put
 * glows behind the character.
 */
export function placeEyeGlowsFromFit(THREE, parent, {
  /** 0–1 within the skull band (chin→crown). Eyes sit mid-face ≈ 0.45–0.55. */
  eyeLine = 0.48,
  spacingFrac = 0.11,
  /** How far to inset from the face plane into the sockets (0 = on surface). */
  forwardFrac = 0.06,
  /** -1 / 1 locks face axis; null/0 = auto from nose tip. */
  faceSign = null,
  padPct = 0.05,
  extraHeads = null,
  size = null,
  /** Fraction of full height that counts as skull (from crown). */
  skullFrac = 0.18,
} = {}) {
  if (!parent || !THREE) return
  const fit = parent.userData?.statueGlbFit
    || parent.userData?.quadrupedGlbFit
    || parent.userData?.humanoidGlbFit
  if (!fit) return

  const glows = []
  parent.traverse((obj) => {
    if (obj.userData?.bossEyeGlow) glows.push(obj)
  })
  if (!glows.length) return

  parent.updateMatrixWorld(true)
  fit.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert()
  const v = new THREE.Vector3()
  const box3 = new THREE.Box3()
  const named = findNamedEyeCenters(THREE, fit, inv, box3, v)
  if (named.length >= 2 && !extraHeads?.length) {
    // Nudge slightly along face normal so sprites sit on the cornea, not buried.
    const face = detectFaceSignFromPoints(
      named.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      {
        min: {
          x: Math.min(named[0].x, named[1].x),
          y: Math.min(named[0].y, named[1].y),
          z: Math.min(named[0].z, named[1].z),
        },
        max: {
          x: Math.max(named[0].x, named[1].x),
          y: Math.max(named[0].y, named[1].y),
          z: Math.max(named[0].z, named[1].z),
        },
      },
    )
    const nudge = (face < 0 ? -1 : 1) * 0.012
    placePair(
      glows,
      0,
      { x: named[0].x, y: named[0].y, z: named[0].z + nudge },
      { x: named[1].x, y: named[1].y, z: named[1].z + nudge },
      size,
    )
    return
  }

  const headPts = sampleSkullPoints(fit, inv, v, skullFrac)
  const bands = [{ eyeLine, forwardFrac, spacingFrac, points: headPts }]
  if (Array.isArray(extraHeads)) {
    for (const h of extraHeads) {
      if (h && Number.isFinite(h.eyeLine)) bands.push({ ...h, points: null })
    }
  }

  let gi = 0
  for (const band of bands) {
    const pts = band.points
    const box = pts && pts.length >= 24
      ? percentileBox(pts, padPct)
      : percentileBox(sampleAllPoints(fit, inv, v), padPct)
    if (!box) return
    const sizeV = {
      x: box.max.x - box.min.x,
      y: box.max.y - box.min.y,
      z: box.max.z - box.min.z,
    }
    if (!(sizeV.y > 0.01) || !(sizeV.x > 0.01)) return

    const bandFace = Number.isFinite(band.faceSign) ? band.faceSign : faceSign
    let sign
    if ([1, -1].includes(Number(bandFace))) sign = Number(bandFace)
    else if (pts && pts.length >= 24) sign = detectFaceSignFromPoints(pts, box)
    else sign = -1

    const frac = Number.isFinite(band.forwardFrac) ? band.forwardFrac : forwardFrac
    // Sit just in front of the face plane so additive sprites are visible.
    const faceZ = sign < 0
      ? box.min.z + sizeV.z * Math.min(0.35, Math.max(0, frac))
      : box.max.z - sizeV.z * Math.min(0.35, Math.max(0, frac))
    const midX = (box.min.x + box.max.x) * 0.5
    const halfEye = Math.max(0.014, sizeV.x * (band.spacingFrac ?? spacingFrac))
    const y = box.min.y + sizeV.y * band.eyeLine
    const z = faceZ + (Number.isFinite(band.zBias) ? band.zBias : 0)
    for (const side of [-1, 1]) {
      const glow = glows[gi++]
      if (!glow) return
      glow.position.set(midX + side * halfEye, y, z)
      if (Number.isFinite(size) && size > 0) glow.scale.setScalar(size)
    }
  }
}

function placePair(glows, start, left, right, size) {
  if (glows[start]) {
    glows[start].position.set(left.x, left.y, left.z)
    if (Number.isFinite(size) && size > 0) glows[start].scale.setScalar(size)
  }
  if (glows[start + 1]) {
    glows[start + 1].position.set(right.x, right.y, right.z)
    if (Number.isFinite(size) && size > 0) glows[start + 1].scale.setScalar(size)
  }
}

/**
 * Plant eye sprites at explicit parent-local centres (L/R pairs in order).
 * Used when AABB bands miss (Trump crawler + Bibi rider, etc.).
 */
export function placeEyeGlowsAtLocalPoints(parent, points, size = null) {
  if (!parent || !Array.isArray(points) || points.length < 2) return
  const glows = []
  parent.traverse((obj) => {
    if (obj.userData?.bossEyeGlow) glows.push(obj)
  })
  for (let i = 0; i + 1 < points.length && i + 1 < glows.length; i += 2) {
    placePair(glows, i, points[i], points[i + 1], size)
  }
}

/**
 * Warm-skin clusters on the Trump/Bibi sculpt after π plant:
 * rider (high Y) + crawler head (mid Y, forward −Z). Returns 4 centres L/R.
 */
export function findTrumpBibiEyeCenters(THREE, parent) {
  const fit = parent?.userData?.quadrupedGlbFit
  if (!fit || !THREE) return null
  parent.updateMatrixWorld(true)
  fit.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert()
  const v = new THREE.Vector3()
  const c = new THREE.Color()
  const rider = []
  const crawl = []
  fit.traverse((obj) => {
    if (!obj.isMesh?.geometry?.attributes?.position) return
    if (obj.visible === false) return
    const pos = obj.geometry.attributes.position
    const col = obj.geometry.attributes.color
    if (!col) return
    const step = Math.max(1, Math.floor(pos.count / 4000))
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld).applyMatrix4(inv)
      if (col.isBufferAttribute) {
        c.fromBufferAttribute(col, i)
      } else continue
      const r = c.r
      const g = c.g
      const b = c.b
      const mid = (r + g + b) / 3
      const warm = r - b
      if (!(warm > 0.03 && r >= g * 0.88 && mid > 0.22 && mid < 0.92)) continue
      if (v.y > 0.95) rider.push({ x: v.x, y: v.y, z: v.z })
      else if (v.y > 0.38 && v.y < 0.78 && v.z < -0.25) crawl.push({ x: v.x, y: v.y, z: v.z })
    }
  })
  if (rider.length < 40 || crawl.length < 40) return null
  const pairFromCluster = (pts, faceSign) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
    }
    const midX = (minX + maxX) * 0.5
    const eyeY = minY + (maxY - minY) * 0.55
    const depth = maxZ - minZ
    const faceZ = faceSign < 0
      ? minZ + depth * 0.08
      : maxZ - depth * 0.08
    const half = Math.max(0.016, (maxX - minX) * 0.18)
    return [
      { x: midX - half, y: eyeY, z: faceZ },
      { x: midX + half, y: eyeY, z: faceZ },
    ]
  }
  // After HUMANOID_GLB_YAW (π) both faces look down −Z.
  return [...pairFromCluster(rider, -1), ...pairFromCluster(crawl, -1)]
}

/**
 * Nose tip: in the central X strip, compare extent from the Z-median toward
 * −Z vs +Z. The longer side is the face (noses stick out; skull backs are blunt).
 * After HUMANOID_GLB_YAW (π) plant, camera-facing props look down −Z — when the
 * two extents are within 25%, prefer −1 so hair/collars do not flip the glows
 * onto the occiput (Putin / Kim / Milei).
 */
function detectFaceSignFromPoints(pts, box) {
  const midX = (box.min.x + box.max.x) * 0.5
  const width = Math.max(0.01, box.max.x - box.min.x)
  const strip = []
  for (const p of pts) {
    if (Math.abs(p.x - midX) > width * 0.22) continue
    strip.push(p.z)
  }
  const zs = (strip.length >= 8 ? strip : pts.map((p) => p.z)).slice().sort((a, b) => a - b)
  const med = zs[Math.floor(zs.length * 0.5)]
  const zLo = zs[Math.floor(zs.length * 0.05)]
  const zHi = zs[Math.min(zs.length - 1, Math.floor(zs.length * 0.95))]
  const towardNeg = med - zLo
  const towardPos = zHi - med
  if (towardNeg >= towardPos * 1.25) return -1
  if (towardPos >= towardNeg * 1.25) return 1
  return -1
}

function findNamedEyeCenters(THREE, fit, inv, box3, v) {
  const centers = []
  fit.traverse((obj) => {
    const name = String(obj.name || '')
    if (!/left.?eye|right.?eye|eyeball|cornea|pupil/i.test(name)) return
    // Prefer mesh geometry centres over empty bone pivots when both exist.
    if (obj.isMesh && obj.geometry) {
      if (!obj.visible) return
      box3.setFromObject(obj)
      if (box3.isEmpty()) return
      box3.getCenter(v)
    } else if (obj.isMesh) {
      return
    } else {
      v.set(0, 0, 0)
      obj.getWorldPosition(v)
    }
    v.applyMatrix4(inv)
    centers.push(v.clone())
  })
  const uniq = []
  for (const c of centers) {
    if (uniq.some((u) => u.distanceToSquared(c) < 1e-4)) continue
    uniq.push(c)
  }
  if (uniq.length < 2) return uniq
  uniq.sort((a, b) => a.x - b.x)
  const midX = (uniq[0].x + uniq.at(-1).x) * 0.5
  const left = uniq.filter((c) => c.x <= midX)
  const right = uniq.filter((c) => c.x > midX)
  if (!left.length || !right.length) return [uniq[0], uniq.at(-1)]
  const avg = (arr) => {
    const o = new THREE.Vector3()
    for (const c of arr) o.add(c)
    return o.multiplyScalar(1 / arr.length)
  }
  return [avg(left), avg(right)]
}

function sampleAllPoints(fit, inv, v) {
  const pts = []
  fit.traverse((obj) => {
    if (!obj.isMesh?.geometry?.attributes?.position) return
    if (obj.visible === false) return
    const pos = obj.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 3500))
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld).applyMatrix4(inv)
      pts.push({ x: v.x, y: v.y, z: v.z })
    }
  })
  return pts
}

/** Upper `skullFrac` of the figure (or named head meshes) ≈ skull volume. */
function sampleSkullPoints(fit, inv, v, skullFrac = 0.18) {
  const all = []
  const headish = []
  fit.traverse((obj) => {
    if (!obj.isMesh?.geometry?.attributes?.position) return
    if (obj.visible === false) return
    const name = String(obj.name || '')
    const isHead = /head|face|skull|cranium/i.test(name)
    const pos = obj.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 2500))
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld).applyMatrix4(inv)
      const p = { x: v.x, y: v.y, z: v.z }
      all.push(p)
      if (isHead) headish.push(p)
    }
  })
  if (!all.length) return []
  let minY = Infinity, maxY = -Infinity
  for (const p of all) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const frac = Math.min(0.35, Math.max(0.12, skullFrac))
  const cut = maxY - (maxY - minY) * frac
  const pool = headish.length >= 24 ? headish : all
  const band = pool.filter((p) => p.y >= cut)
  return band.length >= 16 ? band : all.filter((p) => p.y >= cut)
}

function percentileBox(pts, padPct) {
  if (!pts?.length) return null
  const xs = pts.map((p) => p.x).sort((a, b) => a - b)
  const ys = pts.map((p) => p.y).sort((a, b) => a - b)
  const zs = pts.map((p) => p.z).sort((a, b) => a - b)
  const pct = (arr, t) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(arr.length * t)))]
  const lo = Math.min(0.2, Math.max(0, padPct))
  const hi = 1 - lo
  return {
    min: { x: pct(xs, lo), y: pct(ys, lo), z: pct(zs, lo) },
    max: { x: pct(xs, hi), y: pct(ys, hi), z: pct(zs, hi) },
  }
}
