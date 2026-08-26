/**
 * Reposition `bossEyeGlow` sprites onto a fitted prop's face(s).
 * Eyes are children of `parent` (usually bodyPivot); the fitted GLB lives under
 * `statueGlbFit` / `quadrupedGlbFit`.
 *
 * Uses a percentile AABB (default 5–95%) so thin outliers (Trump's dollar-stick,
 * antennae, etc.) cannot shove the eye line onto the forehead or into empty air.
 */
export function placeEyeGlowsFromFit(THREE, parent, {
  /** Fraction of fitted height for the primary (highest) eye line. */
  eyeLine = 0.78,
  /** Half-spacing as a fraction of fitted width. */
  spacingFrac = 0.11,
  /** How far the glow sits in front of the face plane (frac of depth). */
  forwardFrac = 0.08,
  /**
   * Which side of the AABB is the face in parent-local space.
   * Home statues plant with bodyPivot π + fit π → face toward −Z (camera).
   */
  faceSign = -1,
  /** Percentile trim for the robust AABB (0.05 = drop lowest/highest 5%). */
  padPct = 0.05,
  /**
   * Extra face bands for multi-head sculpts (e.g. Trump crawl + Bibi rider).
   * Each entry: { eyeLine, zBias?, forwardFrac? }.
   */
  extraHeads = null,
  /** Optional glow scale override once planted. */
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
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert()
  const v = new THREE.Vector3()
  const xs = [], ys = [], zs = []
  fit.updateMatrixWorld(true)
  fit.traverse((obj) => {
    if (!obj.isMesh?.geometry?.attributes?.position) return
    const pos = obj.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 4000))
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld).applyMatrix4(inv)
      xs.push(v.x); ys.push(v.y); zs.push(v.z)
    }
  })
  if (xs.length < 8) return

  const pct = (arr, t) => {
    const a = arr.slice().sort((p, q) => p - q)
    return a[Math.max(0, Math.min(a.length - 1, Math.floor(a.length * t)))]
  }
  const lo = Math.min(0.2, Math.max(0, padPct))
  const hi = 1 - lo
  const box = {
    min: { x: pct(xs, lo), y: pct(ys, lo), z: pct(zs, lo) },
    max: { x: pct(xs, hi), y: pct(ys, hi), z: pct(zs, hi) },
  }
  const sizeV = {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
  }
  if (!(sizeV.y > 0.01) || !(sizeV.x > 0.01)) return

  const sign = faceSign < 0 ? -1 : 1
  const faceZFor = (frac) => (sign < 0
    ? box.min.z + sizeV.z * frac
    : box.max.z - sizeV.z * frac)
  const midX = (box.min.x + box.max.x) * 0.5
  const halfEye = Math.max(0.018, sizeV.x * spacingFrac)

  const bands = [{ eyeLine, forwardFrac }]
  if (Array.isArray(extraHeads)) {
    for (const h of extraHeads) {
      if (h && Number.isFinite(h.eyeLine)) bands.push(h)
    }
  }

  let gi = 0
  for (const band of bands) {
    const frac = Number.isFinite(band.forwardFrac) ? band.forwardFrac : forwardFrac
    const y = box.min.y + sizeV.y * band.eyeLine
    const z = faceZFor(frac) + (Number.isFinite(band.zBias) ? band.zBias : 0)
    for (const side of [-1, 1]) {
      const glow = glows[gi++]
      if (!glow) return
      glow.position.set(midX + side * halfEye, y, z)
      if (Number.isFinite(size) && size > 0) glow.scale.setScalar(size)
    }
  }
}
