import { humanoidGlbHeadBounds } from './humanoid-glb.js'

/** Torso box top (center 0.50 + half height 0.22) — shared by all voxel bosses/statues. */
export const BOSS_TORSO_TOP_Y = 0.72

/** SphereGeometry puts uv.y = 1 at the north pole; CanvasTexture flipY maps canvas row 0 there. */
export const BOSS_HEAD_MAP_TEXTURE_FLIP_Y = true

/** Equirectangular head bake: portrait front sits at u ≈ 0.75 (−Z on the skull). */
export const BOSS_HEAD_MAP_FRONT_U = 0.75
export const BOSS_HEAD_MAP_FACE_V0 = 0.14
export const BOSS_HEAD_MAP_FACE_V_SPAN = 0.66
export const BOSS_HEAD_MAP_LON_SPAN = 0.28

/** Map baked head texture UV to normalized portrait coords (null outside the face band). */
export function headMapUvToPortraitNormalized(u, v) {
  const lon = (u - BOSS_HEAD_MAP_FRONT_U) / BOSS_HEAD_MAP_LON_SPAN
  const py = (v - BOSS_HEAD_MAP_FACE_V0) / BOSS_HEAD_MAP_FACE_V_SPAN
  if (Math.abs(lon) > 1 || py < 0 || py > 1) return null
  return { px: (lon + 1) / 2, py }
}

/** Head mount Y so the portrait cube bottom sits flush on the torso (no neck gap). */
export function bossHeadFlushMountY(planeHeight, torsoTopY = BOSS_TORSO_TOP_Y) {
  return torsoTopY + planeHeight / 2
}

function makeSolidHeadMaterial(THREE, color, lowDetail) {
  const tint = new THREE.Color(color)
  if (lowDetail) {
    return new THREE.MeshLambertMaterial({ color: tint })
  }
  return new THREE.MeshStandardMaterial({ color: tint, roughness: 0.62, metalness: 0.06 })
}

// Lit material for the portrait so the face reacts to scene lighting like the rest
// of the body instead of reading as a flat, fullbright sticker. A modest emissive
// (the photo itself at low intensity) keeps it readable even in shade.
function makeFaceMaterial(THREE, map, { lowDetail = false, alphaMap = null, alphaTest = 0 } = {}) {
  const common = {
    emissive: new THREE.Color(0xffffff),
    // Kept moderate so the eye glows read clearly above the face brightness.
    emissiveIntensity: lowDetail ? 0.6 : 0.45,
    transparent: !!alphaMap,
    depthWrite: true,
    side: THREE.FrontSide,
  }
  // Only set when present: passing `undefined` values makes THREE warn.
  if (map) {
    common.map = map
    common.emissiveMap = map
  }
  if (alphaTest) common.alphaTest = alphaTest
  if (alphaMap) common.alphaMap = alphaMap
  return lowDetail
    ? new THREE.MeshLambertMaterial(common)
    : new THREE.MeshStandardMaterial({ ...common, roughness: 0.82, metalness: 0 })
}

// Soft elliptical alpha mask — feathers the flat portrait plane into a rounded
// face shape so its edges blend into the head instead of a hard rectangle.
function makeOvalAlphaTexture(THREE) {
  if (typeof document === 'undefined') return null
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)
  // Slightly taller-than-wide feather, biased up toward the forehead.
  const grad = ctx.createRadialGradient(size / 2, size * 0.44, size * 0.10, size / 2, size * 0.48, size * 0.54)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.68, 'rgba(255,255,255,1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

// Restyle the portrait photo as a hologram projection so it blends with the
// voxel body instead of reading as a pasted photograph: the photo is reduced to
// luminance and remapped onto a deep-blue → cyan → white ramp (the site's #22d3ee
// accent), with horizontal scanlines baked in. Combined with the strong emissive
// in makeFaceMaterial the face reads as a glowing holo-projection.
function holoPortraitTexture(THREE, texture, options = {}) {
  const {
    tint = '#22d3ee',
    size = 220,
    contrast = 1.3,
    lift = 0.06,
    scanlineEvery = 4,
    scanlineDark = 0.62,
    // Global dim so the face never outshines the eye glows.
    brightness = 0.84,
  } = options
  if (typeof document === 'undefined') return texture
  const image = texture.image
  if (!image || !image.width || !image.height) return texture

  const w = size
  const h = Math.max(1, Math.round(size * (image.height / image.width)))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return texture
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(image, 0, 0, w, h)

  const tintColor = new THREE.Color(tint)
  const darkColor = new THREE.Color(tint).multiplyScalar(0.08)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  for (let y = 0; y < h; y += 1) {
    const scan = y % scanlineEvery === 0 ? scanlineDark : 1
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      let g = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255
      g = Math.min(1, Math.max(0, (g - 0.5) * contrast + 0.5 + lift))
      // dark → tint over the low/mid range, tint → white on highlights
      let r
      let gr
      let b
      if (g < 0.72) {
        const t = g / 0.72
        r = darkColor.r + (tintColor.r - darkColor.r) * t
        gr = darkColor.g + (tintColor.g - darkColor.g) * t
        b = darkColor.b + (tintColor.b - darkColor.b) * t
      } else {
        const t = (g - 0.72) / 0.28
        r = tintColor.r + (1 - tintColor.r) * t
        gr = tintColor.g + (1 - tintColor.g) * t
        b = tintColor.b + (1 - tintColor.b) * t
      }
      px[i] = Math.round(r * 255 * scan * brightness)
      px[i + 1] = Math.round(gr * 255 * scan * brightness)
      px[i + 2] = Math.round(b * 255 * scan * brightness)
    }
  }
  ctx.putImageData(data, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = texture.anisotropy
  tex.wrapS = texture.wrapS
  tex.wrapT = texture.wrapT
  tex.needsUpdate = true
  return tex
}

function cloneTextureRegion(texture, repeatX, repeatY, offsetX, offsetY) {
  const tex = texture.clone()
  tex.colorSpace = texture.colorSpace
  tex.anisotropy = texture.anisotropy
  tex.wrapS = texture.wrapS
  tex.wrapT = texture.wrapT
  tex.repeat.set(repeatX, repeatY)
  tex.offset.set(offsetX, offsetY)
  tex.needsUpdate = true
  return tex
}

function makePhotoMaterial(THREE, texture, repeatX, repeatY, offsetX, offsetY, textureInset = 0, lowDetail = false) {
  const inset = Math.min(0.2, textureInset)
  const tex = cloneTextureRegion(
    texture,
    repeatX * (1 - inset),
    repeatY * (1 - inset),
    offsetX + inset * 0.5,
    offsetY + inset * 0.5,
  )
  return makeFaceMaterial(THREE, tex, { lowDetail })
}

/** UV regions with shared edges so cube seams sample the same portrait pixels. */
function buildCubeHeadUvLayout(overrides = {}) {
  const sideU = overrides.sideU ?? 0.15
  const frontU0 = overrides.frontU0 ?? sideU
  const frontU = overrides.frontU ?? 0.62
  const frontU1 = frontU0 + frontU
  const frontV0 = overrides.frontV0 ?? 0.13
  const frontV = overrides.frontV ?? 0.75
  const frontTopV = frontV0 + frontV
  const fringeV = overrides.fringeV ?? 0.11

  return {
    // +x = boss left cheek — right side of the portrait (person's left ear)
    left: { repeatX: sideU, repeatY: frontV, offsetX: frontU1, offsetY: frontV0 },
    // -x = boss right cheek — left side of the portrait (person's right ear)
    right: { repeatX: sideU, repeatY: frontV, offsetX: 0, offsetY: frontV0 },
    front: { repeatX: frontU, repeatY: frontV, offsetX: frontU0, offsetY: frontV0 },
    // +y — stretch the bangs row at the top edge of the front crop
    top: {
      repeatX: frontU,
      repeatY: fringeV,
      offsetX: frontU0,
      offsetY: Math.max(0, frontTopV - fringeV),
    },
  }
}

/** Portrait mapped onto a shallow cube — front face + ear strips on lateral sides + hair on top. */
function addBossHeadCube(THREE, mount, planeWidth, planeHeight, cubeDepth, texture, options) {
  const {
    name = 'bossHeadPhoto',
    renderOrder = 8,
    textureInset = 0,
    sideColor = '#dcb896',
    topColor = '#374151',
    bottomColor: bottomColorOpt = null,
    backColor: backColorOpt = null,
    lowDetail = false,
    sideFaces = 'photo',
    uvLayout = null,
  } = options

  const backColor = backColorOpt
    ? new THREE.Color(backColorOpt)
    : new THREE.Color(sideColor).multiplyScalar(0.78)
  const bottomColor = bottomColorOpt
    ? new THREE.Color(bottomColorOpt)
    : new THREE.Color(sideColor).multiplyScalar(0.9)
  const uv = buildCubeHeadUvLayout(uvLayout || {})
  const solidSides = sideFaces === 'solid'

  const face = (region) => makePhotoMaterial(
    THREE,
    texture,
    region.repeatX,
    region.repeatY,
    region.offsetX,
    region.offsetY,
    textureInset,
    lowDetail,
  )

  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  // In 'solid' mode only the front (+z) keeps the photo; the lateral and top
  // faces become flat colour so a narrow portrait strip is not smeared across
  // the full cube depth.
  const materials = [
    solidSides ? makeSolidHeadMaterial(THREE, sideColor, lowDetail) : face(uv.left),
    solidSides ? makeSolidHeadMaterial(THREE, sideColor, lowDetail) : face(uv.right),
    solidSides ? makeSolidHeadMaterial(THREE, topColor || backColor, lowDetail) : face(uv.top),
    makeSolidHeadMaterial(THREE, bottomColor, lowDetail),
    face(uv.front),
    makeSolidHeadMaterial(THREE, backColor, lowDetail),
  ]

  const headCube = new THREE.Mesh(
    new THREE.BoxGeometry(planeWidth, planeHeight, cubeDepth),
    materials,
  )
  headCube.name = `${name}Cube`
  headCube.rotation.y = Math.PI
  headCube.position.z = cubeDepth / 2 - 0.008
  headCube.renderOrder = renderOrder
  headCube.frustumCulled = false
  mount.add(headCube)
  return headCube
}

/** Eye colour while a boss is fighting / a statue is being interacted with. */
export const BOSS_EYE_FIGHT_COLOR = '#ff2020'

/**
 * Switch every mask-head eye glow under `root` between its base holo tint and
 * the red fight colour. Cheap to call per frame: no-ops until the flag flips.
 */
export function setBossMaskEyesRed(root, red) {
  if (!root?.traverse || root.userData.bossEyesRed === !!red) return
  root.userData.bossEyesRed = !!red
  root.traverse((obj) => {
    if (!obj.userData?.bossEyeGlow) return
    obj.material?.color?.set(red ? BOSS_EYE_FIGHT_COLOR : obj.userData.bossEyeBaseColor)
    if (obj.material) obj.material.opacity = red ? 0.72 : (obj.userData.bossEyeIdleOpacity ?? 0)
    obj.visible = !!red || (obj.userData.bossEyeIdleOpacity ?? 0) > 0.05
  })
}

// Soft radial glow used by the mask-head eye halos. Cached per colour.
const _eyeGlowTexCache = new Map()
function makeEyeGlowTexture(THREE, color) {
  if (typeof document === 'undefined') return null
  if (_eyeGlowTexCache.has(color)) return _eyeGlowTexCache.get(color)
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.75)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.22)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  _eyeGlowTexCache.set(color, tex)
  return tex
}

/**
 * The bosses'/statue's glowing eyes for the round bot heads: the same additive
 * halo sprites `attachBossMaskHead` floats over the mask, tagged with
 * `bossEyeGlow`/`bossEyeBaseColor` so `setBossMaskEyesRed` flips them between
 * the holo tint and the red fight colour exactly like the boss eyes.
 */
export function attachBotEyeGlows(THREE, parent, {
  color = '#22d3ee',
  y = 0.845,
  z = -0.16,
  spacing = 0.062,
  size = 0.105,
  renderOrder = 2,
  idleOpacity = 0.85,
} = {}) {
  const tex = makeEyeGlowTexture(THREE, color)
  if (!tex) return []
  // Same idle dim as the mask eyes: cyan reads much brighter than the fight
  // red, so the base state is dimmed to match apparent brightness.
  const base = new THREE.Color(color).multiplyScalar(0.45)
  const glows = []
  for (const side of [-1, 1]) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      color: base,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: idleOpacity,
    }))
    halo.name = 'botEyeGlow'
    halo.renderOrder = renderOrder
    halo.scale.setScalar(size)
    halo.position.set(side * spacing, y, z)
    halo.visible = idleOpacity > 0.05
    halo.userData.bossEyeGlow = true
    halo.userData.bossEyeIdleOpacity = idleOpacity
    halo.userData.bossEyeBaseColor = `#${base.getHexString()}`
    parent.add(halo)
    glows.push(halo)
  }
  return glows
}

const PHOTO_MAX_DIM = 768

function downscalePortraitTexture(THREE, texture, maxDim = PHOTO_MAX_DIM) {
  const image = texture.image
  if (typeof document === 'undefined' || !image?.width) return texture
  const longest = Math.max(image.width, image.height)
  if (longest <= maxDim) return texture
  const scale = maxDim / longest
  const w = Math.max(1, Math.round(image.width * scale))
  const h = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return texture
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(image, 0, 0, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = texture.anisotropy
  tex.wrapS = texture.wrapS
  tex.wrapT = texture.wrapT
  tex.needsUpdate = true
  return tex
}

function samplePortraitColor(THREE, image, u, v, fallback) {
  if (typeof document === 'undefined' || !image?.width) return new THREE.Color(fallback)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Color(fallback)
  const x = Math.min(image.width - 1, Math.max(0, Math.round(u * image.width)))
  const y = Math.min(image.height - 1, Math.max(0, Math.round(v * image.height)))
  ctx.drawImage(image, x, y, 1, 1, 0, 0, 1, 1)
  const px = ctx.getImageData(0, 0, 1, 1).data
  if (px[3] < 80) return new THREE.Color(fallback)
  return new THREE.Color(px[0] / 255, px[1] / 255, px[2] / 255)
}

function samplePortraitHairColor(THREE, image, fallback) {
  const fallbackColor = new THREE.Color(fallback)
  if (typeof document === 'undefined' || !image?.width) return fallbackColor
  const acc = { r: 0, g: 0, b: 0, n: 0 }
  for (const u of [0.32, 0.42, 0.5, 0.58, 0.68]) {
    for (const v of [0.05, 0.10, 0.16]) {
      const c = samplePortraitColor(THREE, image, u, v, fallback)
      const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
      if (lum < 0.08 || lum > 0.88) continue
      acc.r += c.r
      acc.g += c.g
      acc.b += c.b
      acc.n += 1
    }
  }
  if (!acc.n) return fallbackColor
  return new THREE.Color(acc.r / acc.n, acc.g / acc.n, acc.b / acc.n)
}

function makePhotoSkinMaterial(THREE, map, { lowDetail = false } = {}) {
  const common = {
    roughness: 0.58,
    metalness: 0.02,
    // Subtle warmth so portraits stay readable in shade — not a sticker or holo mask.
    emissive: new THREE.Color(0x1a100c),
    emissiveIntensity: 0.04,
    depthWrite: true,
    side: THREE.FrontSide,
  }
  if (map) {
    common.map = map
    common.emissiveMap = map
    common.color = new THREE.Color('#ffffff')
  }
  if (lowDetail) {
    const { roughness, metalness, ...lambert } = common
    return new THREE.MeshLambertMaterial(lambert)
  }
  return new THREE.MeshStandardMaterial(common)
}

function portraitPixelAlpha(r, g, b, a) {
  if (a < 250) return a / 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (lum < 0.035) return 0
  if (lum < 0.11) return (lum - 0.035) / 0.075
  return 1
}

function samplePortraitBilinear(px, fw, fh, fx, fy) {
  const x0 = Math.min(fw - 1, Math.max(0, Math.floor(fx)))
  const y0 = Math.min(fh - 1, Math.max(0, Math.floor(fy)))
  const x1 = Math.min(fw - 1, x0 + 1)
  const y1 = Math.min(fh - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  for (const [x, wx] of [[x0, 1 - tx], [x1, tx]]) {
    for (const [y, wy] of [[y0, 1 - ty], [y1, ty]]) {
      const i = (y * fw + x) * 4
      const w = wx * wy
      r += px[i] * w
      g += px[i + 1] * w
      b += px[i + 2] * w
      a += portraitPixelAlpha(px[i], px[i + 1], px[i + 2], px[i + 3]) * w
    }
  }
  return { r, g, b, a }
}

/**
 * Bake the portrait onto a sphere UV map with soft cheek/chin falloff so the
 * face reads as skin on the skull — not a floating alpha-cutout mask.
 */
function bakePortraitHeadMap(THREE, image, frontUv, skinColor, hairColor) {
  if (typeof document === 'undefined' || !image?.width) return null
  const size = 768
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const skin = [Math.round(skinColor.r * 255), Math.round(skinColor.g * 255), Math.round(skinColor.b * 255)]
  const hair = [Math.round(hairColor.r * 255), Math.round(hairColor.g * 255), Math.round(hairColor.b * 255)]

  const repeatX = frontUv.repeatX ?? 1
  const repeatY = frontUv.repeatY ?? 1
  const offsetX = frontUv.offsetX ?? 0
  const offsetY = frontUv.offsetY ?? 0
  const sx = offsetX * image.width
  const sy = (1 - offsetY - repeatY) * image.height
  const sw = Math.max(1, repeatX * image.width)
  const sh = Math.max(1, repeatY * image.height)
  const fw = 480
  const fh = 576
  const face = document.createElement('canvas')
  face.width = fw
  face.height = fh
  const fctx = face.getContext('2d')
  if (!fctx) return null
  fctx.drawImage(image, sx, sy, sw, sh, 0, 0, fw, fh)
  const facePx = fctx.getImageData(0, 0, fw, fh).data

  const out = ctx.createImageData(size, size)
  const dst = out.data
  const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  for (let y = 0; y < size; y += 1) {
    const v = y / (size - 1)
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1)
      const i = (y * size + x) * 4
      const onTop = v < 0.22
      const onBack = u > 0.06 && u < 0.44
      let r = onTop || onBack ? hair[0] : skin[0]
      let g = onTop || onBack ? hair[1] : skin[1]
      let b = onTop || onBack ? hair[2] : skin[2]
      const lon = (u - BOSS_HEAD_MAP_FRONT_U) / BOSS_HEAD_MAP_LON_SPAN
      const py = (v - BOSS_HEAD_MAP_FACE_V0) / BOSS_HEAD_MAP_FACE_V_SPAN
      if (Math.abs(lon) <= 1.05 && py >= -0.06 && py <= 1.04) {
        const px = (lon + 1) / 2
        const fx = px * (fw - 1)
        const fy = py * (fh - 1)
        const sample = samplePortraitBilinear(facePx, fw, fh, fx, fy)
        const edge = 1 - smoothstep(0.82, 1.05, Math.abs(lon))
        const chin = 1 - smoothstep(0.90, 1.04, py)
        const brow = 1 - smoothstep(0.10, -0.04, py)
        const a = edge * chin * brow * sample.a
        r = Math.round(sample.r * a + r * (1 - a))
        g = Math.round(sample.g * a + g * (1 - a))
        b = Math.round(sample.b * a + b * (1 - a))
      } else if (onTop && v < 0.18) {
        // Crown fringe from the portrait top row so hair matches the photo.
        const crown = samplePortraitBilinear(facePx, fw, fh, (fw - 1) / 2, 0)
        const t = 1 - v / 0.18
        const a = crown.a * t
        r = Math.round(crown.r * a + r * (1 - a))
        g = Math.round(crown.g * a + g * (1 - a))
        b = Math.round(crown.b * a + b * (1 - a))
      }
      dst[i] = r
      dst[i + 1] = g
      dst[i + 2] = b
      dst[i + 3] = 255
    }
  }
  ctx.putImageData(out, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = BOSS_HEAD_MAP_TEXTURE_FLIP_Y
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function makeFleshMaterial(THREE, color, lowDetail) {
  if (lowDetail) return new THREE.MeshLambertMaterial({ color })
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.02,
  })
}

/**
 * Portrait baked onto a skull that matches the scanned man.glb head AABB.
 * Extra jaw/wig meshes stay off — they read as a second, oversized cap.
 */
export function attachBossMaskHead(THREE, bodyPivot, textureUrl, lowDetail, options = {}) {
  const {
    name = 'bossMaskHead',
    bulk = 1,
    renderOrder = 8,
    skinColor = '#e8c4a8',
    hairColor = '#2a1a12',
    uvLayout = null,
    cutout: _cutout = false,
    holo = {},
    eyes = {},
  } = options
  const skull = humanoidGlbHeadBounds(bulk)
  const w = options.planeWidth ?? skull.width
  const h = options.planeHeight ?? skull.height
  const d = options.skullDepth ?? skull.depth
  const x = options.x ?? skull.centerX
  const y = options.y ?? skull.centerY
  const z = options.z ?? skull.centerZ

  const mount = new THREE.Group()
  mount.name = name
  mount.position.set(x, y, z)
  bodyPivot.add(mount)

  const skullSeg = lowDetail ? 14 : 22
  const prep = (mesh, order = renderOrder) => {
    mesh.frustumCulled = false
    mesh.renderOrder = order
    mount.add(mesh)
    return mesh
  }

  const fleshMat = makeFleshMaterial(THREE, skinColor, lowDetail)
  const vaultMat = makePhotoSkinMaterial(THREE, null, { lowDetail })
  vaultMat.color.set(hairColor)

  const vault = prep(new THREE.Mesh(new THREE.SphereGeometry(0.5, skullSeg, skullSeg - 4), vaultMat), renderOrder)
  vault.name = `${name}Skull`
  vault.scale.set(w, h, d)
  for (const side of [-1, 1]) {
    const ear = prep(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), fleshMat), renderOrder - 1)
    ear.scale.set(0.14 * w, 0.22 * h, 0.16 * d)
    ear.position.set(side * 0.48 * w, -0.04 * h, 0.08 * d)
  }

  const uv = buildCubeHeadUvLayout(uvLayout || {})
  new THREE.TextureLoader().load(textureUrl, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace
    const sized = downscalePortraitTexture(THREE, loaded)
    const img = sized.image || loaded.image
    const cheek = samplePortraitColor(THREE, img, 0.28, 0.58, skinColor)
    const crown = samplePortraitHairColor(THREE, img, hairColor)
    fleshMat.color.copy(cheek)
    const baked = bakePortraitHeadMap(THREE, img, uv.front, cheek, crown)
    if (!baked) return
    baked.anisotropy = lowDetail ? 2 : 8
    vaultMat.map = baked
    vaultMat.emissiveMap = baked
    vaultMat.color.set('#ffffff')
    vaultMat.needsUpdate = true
  })

  const {
    color: eyeColor = holo.tint || '#22d3ee',
    spacing: eyeSpacing = 0.115,
    height: eyeHeight = 0.06,
    size: eyeSize = 0.055,
    points: eyePoints = null,
  } = eyes
  const pts = eyePoints || [
    { u: 0.5 - eyeSpacing, v: 0.5 - eyeHeight },
    { u: 0.5 + eyeSpacing, v: 0.5 - eyeHeight },
  ]
  const eyeBaseColor = new THREE.Color(eyeColor).multiplyScalar(0.40)
  const eyeHaloTex = makeEyeGlowTexture(THREE, eyeColor)
  for (const pt of pts) {
    const yaw = (pt.u - 0.5) * 1.05
    const ex = Math.sin(yaw) * 0.46 * w
    const ey = (0.5 - pt.v) * 0.50 * h
    const ez = -Math.cos(yaw) * 0.46 * d
    if (eyeHaloTex) {
      const halo = prep(new THREE.Sprite(new THREE.SpriteMaterial({
        map: eyeHaloTex,
        color: eyeBaseColor,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      })), renderOrder + 2)
      halo.name = `${name}EyeGlow`
      halo.visible = false
      halo.scale.setScalar(Math.max(0.022, 0.50 * eyeSize))
      halo.position.set(ex, ey, ez)
      halo.userData.bossEyeGlow = true
      halo.userData.bossEyeIdleOpacity = 0
      halo.userData.bossEyeBaseColor = `#${eyeBaseColor.getHexString()}`
    }
  }

  return mount
}

/** Fixed photo on voxel boss/statue heads — flat plane or shallow portrait box when headDepth > 0. */
export function attachBossHeadPhoto(THREE, bodyPivot, textureUrl, lowDetail, options = {}) {
  const {
    name = 'bossHeadPhoto',
    planeWidth = 0.56,
    planeHeight = 0.58,
    x = 0,
    y = 1.02,
    z = -0.132,
    renderOrder = 8,
    textureInset = 0,
    headDepth = 0,
    sideColor = '#dcb896',
    topColor = '#374151',
    bottomColor = null,
    backColor = null,
    sideFaces = 'photo',
    uvLayout = null,
    holo = {},
  } = options

  const mount = new THREE.Group()
  mount.name = name
  mount.position.set(x, y, z)
  bodyPivot.add(mount)

  const textureLoader = new THREE.TextureLoader()
  const cubeDepth = Math.max(0.04, headDepth)

  if (headDepth > 0) {
    let headCube = null
    textureLoader.load(textureUrl, (loaded) => {
      // A scanned head model may have replaced the portrait cube while the photo loaded.
      if (mount.userData.suppressPhotoCube) return
      loaded.colorSpace = THREE.SRGBColorSpace
      loaded.anisotropy = lowDetail ? 1 : 4
      const texture = holoPortraitTexture(THREE, loaded, holo)
      if (headCube) {
        mount.remove(headCube)
        headCube.geometry?.dispose()
        headCube.material.forEach((material) => {
          material.map?.dispose()
          material.dispose()
        })
      }
      headCube = addBossHeadCube(THREE, mount, planeWidth, planeHeight, cubeDepth, texture, {
        name,
        renderOrder,
        textureInset,
        sideColor,
        topColor,
        bottomColor,
        backColor,
        lowDetail,
        sideFaces,
        uvLayout,
      })
      mount.userData.headMesh = headCube
    })
    return mount
  }

  const ovalAlpha = makeOvalAlphaTexture(THREE)
  const facePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    makeFaceMaterial(THREE, null, { lowDetail, alphaMap: ovalAlpha }),
  )
  facePlane.name = `${name}Plane`
  facePlane.rotation.y = Math.PI
  facePlane.renderOrder = renderOrder
  facePlane.frustumCulled = false
  mount.add(facePlane)

  textureLoader.load(textureUrl, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace
    loaded.anisotropy = lowDetail ? 1 : 4
    const texture = holoPortraitTexture(THREE, loaded, holo)
    if (textureInset > 0) {
      const inset = Math.min(0.2, textureInset)
      texture.repeat.set(1 - inset, 1 - inset)
      texture.offset.set(inset / 2, inset / 2)
    }
    facePlane.material.map = texture
    facePlane.material.emissiveMap = texture
    facePlane.material.needsUpdate = true
  })

  return facePlane
}
