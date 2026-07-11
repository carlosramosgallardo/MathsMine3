/** Torso box top (center 0.50 + half height 0.22) — shared by all voxel bosses/statues. */
export const BOSS_TORSO_TOP_Y = 0.72

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
 * "Mask" head — the Milei-statue design generalized: the portrait photo on a
 * gently curved shell (like a mask), a two-ellipsoid skull mold in the boss's
 * outfit colour behind it, and a thin elastic strap that only runs around the
 * back of the skull, holding the mask on. Nothing crosses in front of the face.
 */
export function attachBossMaskHead(THREE, bodyPivot, textureUrl, lowDetail, options = {}) {
  const {
    name = 'bossMaskHead',
    planeWidth = 0.56,
    planeHeight = 0.58,
    x = 0,
    y = 1.02,
    z = -0.132,
    renderOrder = 8,
    moldColor = '#1a1f2b',
    moldRoughness = 0.5,
    moldMetalness = 0.3,
    strapColor = null,
    uvLayout = null,
    cutout = false,
    holo = {},
    eyes = {},
  } = options
  // Strap defaults to the hologram tint so the whole head-rig reads as one projection.
  const strapTint = strapColor || holo.tint || '#22d3ee'

  const mount = new THREE.Group()
  mount.name = name
  mount.position.set(x, y, z)
  bodyPivot.add(mount)

  const w = planeWidth
  const h = planeHeight
  // Every part is positioned relative to the skull-vault centre, so the mount
  // origin IS the head's visual centre: callers place it over the torso centre
  // and rotating the mount yaws/nods the head in place instead of orbiting it.
  const zHeadCenter = 0.40 * w
  const prep = (mesh, order = renderOrder) => {
    mesh.frustumCulled = false
    mesh.renderOrder = order
    mount.add(mesh)
    return mesh
  }

  // Curved mask shell: an open cylinder segment centered on mount-local -z
  // (the viewer-facing side), chord width = planeWidth. Arc deep enough that
  // the face reads clearly convex instead of a flat billboard.
  const maskArc = 1.95
  const maskRadius = w / (2 * Math.sin(maskArc / 2))
  // Double curvature: on top of the cylinder's horizontal arc, forehead and
  // chin recede toward the skull (z) and pinch inward (x), so the shell reads
  // as a moulded face mask instead of a bent sheet. Quadratic in the vertical
  // coordinate: zero at eye level, max at the top/bottom edges.
  const maskBend = 0.22 * h
  const maskTaper = 0.14
  const maskWarp = (xv, yv) => {
    const s = (yv / (h / 2)) ** 2
    return { x: xv * (1 - maskTaper * s), dz: maskBend * s }
  }
  const maskGeo = new THREE.CylinderGeometry(
    maskRadius, maskRadius, h,
    lowDetail ? 12 : 24, lowDetail ? 4 : 8,
    true, Math.PI - maskArc / 2, maskArc,
  )
  const maskPos = maskGeo.attributes.position
  for (let i = 0; i < maskPos.count; i += 1) {
    const warped = maskWarp(maskPos.getX(i), maskPos.getY(i))
    maskPos.setX(i, warped.x)
    maskPos.setZ(i, maskPos.getZ(i) + warped.dz)
  }
  maskGeo.computeVertexNormals()
  // cutout: the photo brings its own alpha silhouette (hair/jaw outline) —
  // alphaTest trims the shell to the face shape without transparency sorting.
  const mask = prep(new THREE.Mesh(
    maskGeo,
    makeFaceMaterial(THREE, null, { lowDetail, alphaTest: cutout ? 0.5 : 0 }),
  ), renderOrder)
  mask.name = `${name}Shell`
  mask.position.z = maskRadius - 0.03 - zHeadCenter

  const uv = buildCubeHeadUvLayout(uvLayout || {})
  new THREE.TextureLoader().load(textureUrl, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace
    loaded.anisotropy = lowDetail ? 1 : 4
    const styled = holoPortraitTexture(THREE, loaded, holo)
    const tex = cloneTextureRegion(styled, uv.front.repeatX, uv.front.repeatY, uv.front.offsetX, uv.front.offsetY)
    mask.material.map = tex
    mask.material.emissiveMap = tex
    mask.material.needsUpdate = true
  })

  // Bot eyes shining through the mask: a bright core dot plus an additive halo
  // sprite per eye, floating just in front of the shell surface — reads as the
  // robot's glowing eyes bleeding through the hologram — a soft additive glow
  // in the holo tint only, no solid core, so it brightens the mask rather than
  // reading as a second layer on top of it.
  // `points` pins each eye to exact portrait-image coordinates: u = fraction
  // from the image's left edge, v = fraction from its top edge. The positions
  // are projected onto the curved shell so they hug the mask surface.
  const {
    color: eyeColor = holo.tint || '#22d3ee',
    spacing: eyeSpacing = 0.115,
    height: eyeHeight = 0.06,
    // Small inset: the closer the glow hugs the shell, the less it drifts off
    // the portrait's pupils with camera parallax.
    inset: eyeInset = 0.018,
    size: eyeSize = 0.12,
    points: eyePoints = null,
  } = eyes
  const pts = eyePoints || [
    { u: 0.5 - eyeSpacing, v: 0.5 - eyeHeight },
    { u: 0.5 + eyeSpacing, v: 0.5 - eyeHeight },
  ]
  // Cyan has a much higher perceived luminance than the fight red, so the idle
  // glow is dimmed to match: same apparent brightness (and thus apparent size,
  // since brighter additive blobs read bigger) in both states.
  const eyeBaseColor = new THREE.Color(eyeColor).multiplyScalar(0.45)
  const eyeHaloTex = makeEyeGlowTexture(THREE, eyeColor)
  for (const pt of pts) {
    // Shell surface point for texture coords (u,v): image left (u=0) maps to
    // local +x; flipY texture puts v=0 at the top of the shell. Same warp as
    // the shell vertices so the glows keep hugging the curved surface.
    const phi = (pt.u - 0.5) * maskArc
    const ey = (0.5 - pt.v) * h
    const warped = maskWarp(-maskRadius * Math.sin(phi), ey)
    const ex = warped.x
    const ez = (maskRadius - 0.03 - zHeadCenter) - maskRadius * Math.cos(phi) + warped.dz - eyeInset
    if (eyeHaloTex) {
      const halo = prep(new THREE.Sprite(new THREE.SpriteMaterial({
        map: eyeHaloTex,
        color: eyeBaseColor,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.85,
      })), renderOrder + 2)
      halo.name = `${name}EyeGlow`
      halo.scale.setScalar(eyeSize * w * 2.6)
      halo.position.set(ex, ey, ez - 0.005)
      halo.userData.bossEyeGlow = true
      halo.userData.bossEyeBaseColor = `#${eyeBaseColor.getHexString()}`
    }
  }

  // Skull mold: cranial vault + occiput ellipsoids, outfit-coloured, fully
  // behind the mask (positive local z). Near-spherical and pulled back to
  // clear the double-curved shell: ≥0.018 analytic gap to the mask surface
  // everywhere, crown kept below the mask top so the mold forehead never
  // peeks past the shell.
  const moldMat = new THREE.MeshStandardMaterial({ color: moldColor, roughness: moldRoughness, metalness: moldMetalness })
  const vault = prep(new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), moldMat), renderOrder - 1)
  vault.scale.set(0.82 * w, 0.94 * h, 0.84 * w)
  vault.position.set(0, 0, 0)
  const occiput = prep(new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), moldMat), renderOrder - 1)
  occiput.scale.set(0.72 * w, 0.72 * h, 0.66 * w)
  occiput.position.set(0, -0.10 * h, 0)

  // Elastic strap: back arc only, ends meeting the mask's side edges.
  const strapMat = new THREE.MeshStandardMaterial({
    color: strapTint,
    emissive: strapTint,
    emissiveIntensity: 0.45,
    roughness: 0.5,
    metalness: 0.05,
  })
  // Arc trimmed so both ends die ~1cm behind the mask's side edges (never in
  // front of the shell), stretched in z to wrap the deeper rounded skull.
  const strapArc = Math.PI * 0.98
  const strap = prep(new THREE.Mesh(
    new THREE.TorusGeometry(0.50 * w, 0.012, 8, 40, strapArc),
    strapMat,
  ), renderOrder - 1)
  strap.position.set(0, 0.09 * h, -0.20 * w)
  strap.rotation.set(Math.PI / 2 - 0.12, 0, Math.PI / 2 - strapArc / 2)
  strap.scale.set(0.97, 1.285, 1)

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
