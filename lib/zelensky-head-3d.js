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
    moldColor = '#4b5a3a',
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

  // Skull behind the relief — an ellipsoid in the outfit colour, so the head
  // has a back/side silhouette instead of a hollow shell.
  const skullGeo = new THREE.SphereGeometry(1, lowDetail ? 12 : 24, lowDetail ? 10 : 18)
  const skullMat = lowDetail
    ? new THREE.MeshLambertMaterial({ color: moldColor })
    : new THREE.MeshStandardMaterial({ color: moldColor, roughness: 0.55, metalness: 0.12 })
  const skull = new THREE.Mesh(skullGeo, skullMat)
  skull.scale.set(MODEL_W * 0.46, MODEL_H * 0.44, MODEL_W * 0.42)
  skull.position.z = -0.24
  skull.renderOrder = renderOrder - 1
  skull.frustumCulled = false
  rig.add(skull)

  const finish = async () => {
    if (!geometryPromise) geometryPromise = loadReliefGeometry(THREE)
    const geo = await geometryPromise
    const material = lowDetail
      ? new THREE.MeshLambertMaterial({
          emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.5, alphaTest: 0.5,
        })
      : new THREE.MeshStandardMaterial({
          // Lower emissive than the mask heads: the whole point of the relief
          // is letting scene light sculpt the features.
          emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.28,
          roughness: 0.62, metalness: 0, alphaTest: 0.5,
        })
    const face = new THREE.Mesh(geo, material)
    face.renderOrder = renderOrder
    face.frustumCulled = false
    rig.add(face)
    new THREE.TextureLoader().load(ZELENSKY_FACE_TEXTURE_URL, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = lowDetail ? 1 : 4
      material.map = tex
      material.emissiveMap = tex
      material.needsUpdate = true
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
    sprite.position.set(
      (point.u - 0.5) * MODEL_W,
      (0.5 - point.v) * MODEL_H,
      MODEL_DEPTH + 0.03,
    )
    sprite.renderOrder = renderOrder + 1
    sprite.frustumCulled = false
    sprite.userData.bossEyeGlow = true
    sprite.userData.bossEyeBaseColor = eyeColor
    rig.add(sprite)
  }

  return mount
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
