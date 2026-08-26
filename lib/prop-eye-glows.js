/**
 * Reposition `bossEyeGlow` sprites onto real eye sockets when possible.
 *
 * Priority:
 * 1. Named eye nodes/meshes (`LeftEye`, `RightEye`, `*Eyeball*`, …)
 * 2. Head-named meshes (`Head_*`) frontal band
 * 3. Percentile AABB of the whole fit (last resort)
 */
export function placeEyeGlowsFromFit(THREE, parent, {
  eyeLine = 0.78,
  spacingFrac = 0.11,
  forwardFrac = 0.08,
  faceSign = -1,
  padPct = 0.05,
  extraHeads = null,
  size = null,
} = {}) {
  if (!parent || !THREE) return
  const fit = parent.userData?.statueGlbFit || parent.userData?.quadrupedGlbFit
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
    named.sort((a, b) => a.x - b.x)
    placePair(glows, 0, named[0], named[1], size)
    return
  }

  const headPts = sampleHeadFrontPoints(fit, inv, v)
  const bands = [{ eyeLine, forwardFrac, points: headPts }]
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

    // Prefer the face side with more head verts in the front half.
    let sign = faceSign < 0 ? -1 : 1
    if (pts && pts.length >= 24) {
      const midZ = (box.min.z + box.max.z) * 0.5
      let lo = 0, hi = 0
      for (const p of pts) {
        if (p.z < midZ) lo += 1
        else hi += 1
      }
      // Face toward the denser / more protruding side for head samples.
      sign = lo >= hi ? -1 : 1
    }
    const frac = Number.isFinite(band.forwardFrac) ? band.forwardFrac : forwardFrac
    const faceZ = sign < 0
      ? box.min.z + sizeV.z * frac
      : box.max.z - sizeV.z * frac
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
    glows[start].position.copy(left)
    if (Number.isFinite(size) && size > 0) glows[start].scale.setScalar(size)
  }
  if (glows[start + 1]) {
    glows[start + 1].position.copy(right)
    if (Number.isFinite(size) && size > 0) glows[start + 1].scale.setScalar(size)
  }
}

function findNamedEyeCenters(THREE, fit, inv, box3, v) {
  const centers = []
  fit.traverse((obj) => {
    const name = String(obj.name || '')
    if (!/left.?eye|right.?eye|eyeball|cornea|pupil/i.test(name)) return
    if (obj.isMesh && obj.geometry) {
      box3.setFromObject(obj)
      if (box3.isEmpty()) return
      box3.getCenter(v)
    } else {
      v.set(0, 0, 0)
      obj.getWorldPosition(v)
    }
    v.applyMatrix4(inv)
    centers.push(v.clone())
  })
  // Deduplicate near-identical (mesh + bone).
  const uniq = []
  for (const c of centers) {
    if (uniq.some((u) => u.distanceToSquared(c) < 1e-4)) continue
    uniq.push(c)
  }
  return uniq
}

function sampleAllPoints(fit, inv, v) {
  const pts = []
  fit.traverse((obj) => {
    if (!obj.isMesh?.geometry?.attributes?.position) return
    const pos = obj.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 3500))
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld).applyMatrix4(inv)
      pts.push({ x: v.x, y: v.y, z: v.z })
    }
  })
  return pts
}

function sampleHeadFrontPoints(fit, inv, v) {
  const all = []
  const headish = []
  fit.traverse((obj) => {
    if (!obj.isMesh?.geometry?.attributes?.position) return
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
  // Upper 28% of the full figure height ≈ skull.
  let minY = Infinity, maxY = -Infinity
  for (const p of all) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const cut = minY + (maxY - minY) * 0.72
  const band = (headish.length >= 24 ? headish : all).filter((p) => p.y >= cut)
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
