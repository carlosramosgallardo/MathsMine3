/**
 * Experimental realistic head for the Zelensky statue: the depth-relief mesh
 * from public/models/zelensky-head-3d.glb (frontal heightmap, POSITION-only)
 * with the portrait photo planar-projected onto it. Compared to the mask
 * format, the relief gives the face real volume — lighting sculpts nose,
 * brow and cheeks — and the head is sized closer to human proportions.
 *
 * The GLB is trivial (one primitive, positions + indices) so it is parsed by
 * hand — no GLTFLoader dependency.
 */
export const ZELENSKY_HEAD_3D_URL = '/models/zelensky-head-3d.glb'
/** Same alpha-cutout portrait the mask head uses (m1-zelensky-statue). */
export const ZELENSKY_FACE_TEXTURE_URL = '/images/m1-zelensky-mask.webp'

// Model-space bounds of the relief (from the GLB): width ~0.99, height ~1.37,
// depth 0→0.149 toward +z. UVs and eye anchors are derived from these.
const MODEL_W = 0.99
const MODEL_H = 1.37
const MODEL_DEPTH = 0.149

/** Measured portrait pupil centres (image fractions, v from the top). */
const EYE_POINTS = [{ u: 0.347, v: 0.478 }, { u: 0.700, v: 0.476 }]

// Skull ellipsoid (model units) — the relief is draped onto its front cap so
// the face hugs the head like skin instead of floating as a flat cutout.
const SKULL = { rx: MODEL_W * 0.46, ry: MODEL_H * 0.44, rz: 0.30, cz: -0.32 }
// Relief features are compressed a touch when draped, plus a hair's gap so the
// flat (alpha-cut) background never z-fights the skull surface.
const RELIEF_SCALE = 0.85
const RELIEF_GAP = 0.01

/** Front z of the draped face surface at model-space (x, y). */
function wrapFrontZ(x, y, relief = 0) {
  const t = (x / SKULL.rx) ** 2 + (y / SKULL.ry) ** 2
  const cap = t < 1 ? SKULL.rz * Math.sqrt(1 - t) : 0
  return SKULL.cz + cap + RELIEF_GAP + relief * RELIEF_SCALE
}

let geometryPromise = null

async function loadReliefGeometry(THREE) {
  const res = await fetch(ZELENSKY_HEAD_3D_URL)
  if (!res.ok) throw new Error(`head glb ${res.status}`)
  const buf = await res.arrayBuffer()
  const dv = new DataView(buf)
  const jsonLen = dv.getUint32(12, true)
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)))
  const binStart = 20 + jsonLen + 8
  const prim = json.meshes[0].primitives[0]
  const readAccessor = (index) => {
    const acc = json.accessors[index]
    const view = json.bufferViews[acc.bufferView]
    const offset = binStart + (view.byteOffset || 0) + (acc.byteOffset || 0)
    const Ctor = acc.componentType === 5125 ? Uint32Array
      : acc.componentType === 5123 ? Uint16Array : Float32Array
    const comps = acc.type === 'VEC3' ? 3 : acc.type === 'VEC2' ? 2 : 1
    return new Ctor(buf, offset, acc.count * comps)
  }
  const positions = readAccessor(prim.attributes.POSITION)
  const indices = readAccessor(prim.indices)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))

  // Planar UVs from the xy bounding box — the relief spans the same frame as
  // the portrait photo, so this projects the face exactly onto its features.
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const spanX = bb.max.x - bb.min.x || 1
  const spanY = bb.max.y - bb.min.y || 1
  const uvs = new Float32Array((positions.length / 3) * 2)
  for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
    uvs[j] = (positions[i] - bb.min.x) / spanX
    uvs[j + 1] = (positions[i + 1] - bb.min.y) / spanY
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  // Centre x/y so the mount origin is the head centre; keep z as authored
  // (0 = back plane, +z = face relief).
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0)
  // Drape the flat relief onto the skull's front cap: each vertex rides the
  // ellipsoid surface with its authored feature depth added on top, so cheeks,
  // temples and forehead recede around the head like a real face.
  const arr = geo.attributes.position
  for (let i = 0; i < arr.count; i += 1) {
    arr.setZ(i, wrapFrontZ(arr.getX(i), arr.getY(i), arr.getZ(i)))
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Mounts the relief head on a humanoid bodyPivot. Returns the mount group
 * immediately (contents fill in as the mesh + texture load). Same origin
 * contract as attachBossMaskHead: the mount origin is the head centre, so
 * rotating the mount yaws/nods the head in place (head tracking just works).
 */
export function attachZelensky3DHead(THREE, bodyPivot, lowDetail = false, options = {}) {
  const {
    name = 'm1ZelenskyHead3D',
    headHeight = 0.52,
    y = 0,
    z = 0.02,
    renderOrder = 12,
    moldColor = '#4a4238',
    eyeColor = '#22d3ee',
  } = options

  const mount = new THREE.Group()
  mount.name = name
  mount.position.set(0, y, z)
  bodyPivot.add(mount)

  const scale = headHeight / MODEL_H
  // Inner group carries the π yaw (relief faces +z; the statue's visual front
  // is bodyPivot -z) and the human-size scale, so children use model units.
  const rig = new THREE.Group()
  rig.rotation.y = Math.PI
  rig.scale.setScalar(scale)
  mount.add(rig)

  // Skull behind the relief — an ellipsoid completing the head. It starts in
  // the mold colour and swaps to a generated hair/skin texture (sampled from
  // the portrait itself) so sides, back and neck continue the face naturally.
  const skullGeo = new THREE.SphereGeometry(1, lowDetail ? 12 : 24, lowDetail ? 10 : 18)
  const skullMat = lowDetail
    ? new THREE.MeshLambertMaterial({ color: moldColor })
    : new THREE.MeshStandardMaterial({ color: moldColor, roughness: 0.72, metalness: 0.02 })
  const skull = new THREE.Mesh(skullGeo, skullMat)
  // Same ellipsoid the relief is draped onto (SKULL) — face and skull read as
  // one head, the portrait sitting on the front cap like skin.
  skull.scale.set(SKULL.rx, SKULL.ry, SKULL.rz)
  skull.position.z = SKULL.cz
  skull.renderOrder = renderOrder - 1
  skull.frustumCulled = false
  rig.add(skull)
  buildSkullTexture(THREE).then((tex) => {
    if (!tex) return
    skullMat.map = tex
    skullMat.color.set('#ffffff')
    skullMat.needsUpdate = true
  }).catch(() => {})

  const finish = async () => {
    if (!geometryPromise) geometryPromise = loadReliefGeometry(THREE)
    const geo = await geometryPromise
    const material = lowDetail
      ? new THREE.MeshLambertMaterial({
          emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.5, alphaTest: 0.5,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshStandardMaterial({
          // Lower emissive than the mask heads: the whole point of the relief
          // is letting scene light sculpt the features. DoubleSide: the
          // heightmap mesh's winding is not guaranteed front-facing.
          emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.28,
          roughness: 0.62, metalness: 0, alphaTest: 0.5,
          side: THREE.DoubleSide,
        })
    const face = new THREE.Mesh(geo, material)
    face.renderOrder = renderOrder
    face.frustumCulled = false
    // Attach only once the portrait is on — an untextured relief flashes as a
    // solid white blob otherwise.
    new THREE.TextureLoader().load(ZELENSKY_FACE_TEXTURE_URL, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = lowDetail ? 1 : 4
      material.map = tex
      material.emissiveMap = tex
      material.needsUpdate = true
      rig.add(face)
    })
  }
  finish().catch(() => {})

  // Subtle eye glints at the measured pupils — tagged with the bossEyeGlow
  // contract so setBossMaskEyesRed flips them red while the tip is mined.
  const glowTex = makeGlintTexture(THREE)
  for (const point of EYE_POINTS) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex || undefined,
      color: eyeColor,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }))
    sprite.scale.setScalar(0.11)
    const ex = (point.u - 0.5) * MODEL_W
    const ey = (0.5 - point.v) * MODEL_H
    sprite.position.set(ex, ey, wrapFrontZ(ex, ey, MODEL_DEPTH * 0.7) + 0.03)
    sprite.renderOrder = renderOrder + 1
    sprite.frustumCulled = false
    sprite.userData.bossEyeGlow = true
    sprite.userData.bossEyeBaseColor = eyeColor
    rig.add(sprite)
  }

  return mount
}

/**
 * Paints the skull ellipsoid so the parts the relief doesn't cover continue
 * the portrait: hair over the top (reaching further down at the back of the
 * head), skin/neck below, with a soft hairline and light noise. Hair and skin
 * colours are sampled from the portrait itself so the tones always match.
 * Sphere UVs: u = longitude (0.25 faces the relief, 0.75 is the back of the
 * head), v = latitude (0 at the crown).
 */
let skullTexPromise = null
function buildSkullTexture(THREE) {
  if (skullTexPromise) return skullTexPromise
  skullTexPromise = (async () => {
    if (typeof document === 'undefined') return null
    const img = await new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof window.Image === 'undefined') return resolve(null)
      const im = new window.Image()
      im.onload = () => resolve(im)
      im.onerror = () => resolve(null)
      im.src = ZELENSKY_FACE_TEXTURE_URL
    })

    // Portrait-matched fallbacks; replaced by real samples when the image loads.
    let hair = [62, 54, 46]
    let skin = [201, 161, 134]
    if (img) {
      try {
        const probe = document.createElement('canvas')
        probe.width = img.width
        probe.height = img.height
        const pctx = probe.getContext('2d', { willReadFrequently: true })
        pctx.drawImage(img, 0, 0)
        const sample = (u, v) => {
          const d = pctx.getImageData(Math.round(u * img.width), Math.round(v * img.height), 1, 1).data
          return d[3] > 128 ? [d[0], d[1], d[2]] : null
        }
        const avg = (points) => {
          const hits = points.map(([u, v]) => sample(u, v)).filter(Boolean)
          if (!hits.length) return null
          return hits.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map(x => Math.round(x / hits.length))
        }
        hair = avg([[0.50, 0.10], [0.38, 0.11], [0.62, 0.11]]) || hair
        skin = avg([[0.30, 0.55], [0.70, 0.55], [0.50, 0.66]]) || skin
      } catch {}
    }

    const W = 256
    const H = 128
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const css = ([r, g, b], mul = 1) => `rgb(${Math.round(r * mul)},${Math.round(g * mul)},${Math.round(b * mul)})`

    // Base: skin with a slight darkening toward the jaw/neck.
    const skinGrad = ctx.createLinearGradient(0, 0, 0, H)
    skinGrad.addColorStop(0, css(skin))
    skinGrad.addColorStop(0.75, css(skin, 0.92))
    skinGrad.addColorStop(1, css(skin, 0.78))
    ctx.fillStyle = skinGrad
    ctx.fillRect(0, 0, W, H)

    // Hair, column by column: the hairline sits lower at the back of the head
    // (u = 0.75) and rises toward the sides; the front is hidden by the face.
    for (let px = 0; px < W; px += 1) {
      const u = px / W
      const back = Math.max(0, Math.cos((u - 0.75) * Math.PI * 2))
      const hairlineV = 0.52 + 0.22 * back
      const hairEnd = hairlineV * H
      const grad = ctx.createLinearGradient(0, 0, 0, hairEnd + 7)
      grad.addColorStop(0, css(hair, 1.06))
      grad.addColorStop(0.8, css(hair, 0.92))
      grad.addColorStop(1, `rgba(${hair[0]},${hair[1]},${hair[2]},0)`)
      ctx.fillStyle = grad
      ctx.fillRect(px, 0, 1, hairEnd + 7)
    }

    // Light noise so hair and skin don't read as flat bands.
    for (let i = 0; i < 900; i += 1) {
      const nx = Math.random() * W
      const ny = Math.random() * H
      const shade = Math.random() * 0.16 - 0.08
      ctx.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${Math.abs(shade)})`
      ctx.fillRect(nx, ny, 1.6, 1.2)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  })().catch(() => null)
  return skullTexPromise
}

const _glintCache = { tex: null }
function makeGlintTexture(THREE) {
  if (typeof document === 'undefined') return null
  if (_glintCache.tex) return _glintCache.tex
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.3, 'rgba(255,255,255,0.6)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  _glintCache.tex = tex
  return tex
}
