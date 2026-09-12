import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Render-only world renderer. Nothing in this module writes cells or collision data.
export function miningRetroPixelRatio(width, height) {
  return Math.min(1, 768 / Math.max(1, width), 480 / Math.max(1, height))
}

const PROTECTED = ['interactive', 'blockGlow', 'biomeSurface', 'm1MileiStatue', 'm1ZelenskyStatue', 'nukeCube', 'minableBlockChunk', 'm2MacronStatue', 'm2PitchDome', 'm3PutinBoss', 'm4KimBoss', 'm5TrumpBoss']
function protectedBranch(object, root, animated) {
  for (let node = object; node && node !== root; node = node.parent) {
    if (animated.has(node) || PROTECTED.some(key => node.userData[key])) return true
  }
  return false
}

/** Cheap diffuse lighting keeps volume readable without physical reflections.
 * Animated/interactive materials retain their identity for gameplay effects.
 */
export function simplifyMiningMaterials(world, animated = new Set()) {
  const replacements = new Map()
  world.traverse(object => {
    if (!object.isMesh || protectedBranch(object, world, animated)) return
    const convert = source => {
      if (!source?.isMeshStandardMaterial || source.transparent || source.userData.skipDispose) return source
      if (replacements.has(source)) return replacements.get(source)
      const material = new THREE.MeshLambertMaterial({
        color: source.color, map: source.map,
        emissive: source.emissive, emissiveMap: source.emissiveMap,
        emissiveIntensity: Math.min(source.emissiveIntensity, 0.35),
        vertexColors: source.vertexColors, side: source.side,
        alphaTest: source.alphaTest, opacity: source.opacity,
        depthWrite: source.depthWrite, depthTest: source.depthTest,
        polygonOffset: source.polygonOffset,
        polygonOffsetFactor: source.polygonOffsetFactor,
        polygonOffsetUnits: source.polygonOffsetUnits,
        flatShading: true, fog: source.fog,
      })
      material.userData = { ...source.userData }
      replacements.set(source, material)
      return material
    }
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material)
  })
  // A material may also belong to a protected mesh. Keep it alive in that case.
  const retained = new Set()
  world.traverse(o => (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => retained.add(m)))
  for (const source of replacements.keys()) if (!retained.has(source)) source.dispose()
}

/** Batch static surfaces while retaining exact camera collision proxies.
 * Spatial buckets retain culling; transforms include all parent transforms.
 */
export function batchMiningStaticDecor(world, animated = new Set()) {
  world.updateMatrixWorld(true)
  const buckets = new Map()
  world.traverse(object => {
    const material = object.material
    if (!canBatchStaticMesh(object, world, animated)) return
    const pos = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld)
    const key = JSON.stringify([Math.floor(pos.x / 12), Math.floor(pos.z / 12),
      material.type, material.wireframe, material.toneMapped, object.renderOrder, material.transparent, material.opacity, material.blending,
      material.map?.uuid, material.color.getHex(), material.emissive?.getHex(),
      material.emissiveMap?.uuid, material.emissiveIntensity, material.side,
      material.depthWrite, material.depthTest, material.fog, material.alphaTest,
      material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits,
      Object.keys(object.geometry.attributes).sort((a, b) => a.localeCompare(b))])
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(object)
  })
  let removedDraws = 0
  const retiredGeometries = new Set(), retiredMaterials = new Set()
  const inverse = world.matrixWorld.clone().invert(), matrix = new THREE.Matrix4()
  for (const objects of buckets.values()) {
    if (objects.length < 3) continue
    const first = objects[0]
    const pieces = objects.map(object => {
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
      return geometry.applyMatrix4(matrix.multiplyMatrices(inverse, object.matrixWorld))
    })
    const geometry = mergeGeometries(pieces)
    pieces.forEach(piece => piece.dispose())
    if (!geometry) continue
    const mesh = new THREE.Mesh(geometry, first.material)
    mesh.name = 'Mining retro static batch'
    mesh.renderOrder = first.renderOrder
    for (const object of objects) {
      if (object.userData.collidable) {
        // Three raycasting still visits invisible meshes. Keep exact collision
        // geometry and references, but draw its surface through the batch only.
        object.visible = false
        object.userData.retroCollisionProxy = true
      } else {
        object.removeFromParent()
        retiredGeometries.add(object.geometry); retiredMaterials.add(object.material)
      }
    }
    geometry.computeBoundingSphere()
    world.add(mesh)
    removedDraws += objects.length - 1
  }
  world.traverse(o => {
    retiredGeometries.delete(o.geometry)
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) retiredMaterials.delete(m)
  })
  for (const g of retiredGeometries) if (!g.userData.skipDispose) g.dispose()
  for (const m of retiredMaterials) if (!m.userData.skipDispose) m.dispose()
  world.userData.retroSavedDraws = removedDraws
  return removedDraws
}

/** Whole-island art pass: distant skyline + small accents on solid obstacle tops.
 * One shared cube and one shared four-sided cone, instanced by spatial sector.
 */
export function addM1RetroDecor(world, obstacles, cells = new Map()) {
  const groups = new Map()
  const add = (shape, ...dimensions) => {
    const [x, y, z, sx, sy, sz, color] = dimensions
    const key = `${shape}:${Math.floor(x / 14)}:${Math.floor(z / 14)}`
    if (!groups.has(key)) groups.set(key, { shape, entries: [] })
    groups.get(key).entries.push({ x, y, z, sx, sy, sz, color })
  }
  const box = (...args) => add('box', ...args)
  const cone = (...args) => add('cone', ...args)
  addRetroSkyline(box, cone)
  const count = addRetroObstacleAccents(box, cone, obstacles)
  addRetroFloorMosaics(box, obstacles, cells)
  return buildRetroDecorInstances(world, groups, count)
}

function addRetroSkyline(box, cone) {
  // Distant fir groves and layered mountain silhouettes. Cardinal gateways stay open.
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 20; i++) {
      const along = -8 + i * 3.8
      if (along > 19 && along < 37) continue
      addRetroSkylineTree(box, cone, side, i, along)
    }
  }
}

function addRetroObstacleAccents(box, cone, obstacles) {
  // Accents are contained inside existing non-interactive solid cell footprints.
  // House/arena, ramps, patrol decks and mineable cells never receive new props.
  let count = 0
  for (const [key, obstacle] of obstacles) {
    const [row, col] = key.split(',').map(Number)
    const top = Number(obstacle.visualHeight ?? obstacle.height)
    if (!canDecorateObstacle(row, col, obstacle, top)) continue
    const x = col + .5, z = row + .5, kind = (row + col) % 4
    // All accents are shallow enough to keep the original walkable tops readable.
    box(x, top + .012, z, .88, .02, .88, '#5b8e72')
    addRetroAccentPattern(box, cone, x, z, top, kind)
    count++
  }
  return count
}

function addRetroFloorMosaics(box, obstacles, cells) {
  // Floor mosaics, tiny grasses and flowers fill the outer districts without
  // adding collision volumes or concealing usable cells, entrances or gateways.
  for (let row = 3; row < 54; row += 3) {
    for (let col = 3; col < 54; col += 3) {
      if (!canDecorateFloor(row, col, obstacles, cells)) continue
      addRetroFloorMosaic(box, row, col)
    }
  }
}

function buildRetroDecorInstances(world, groups, count) {
  const geometries = { box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 4) }
  const material = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true })
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion()
  const color = new THREE.Color()
  const decor = new THREE.Group()
  decor.name = 'M1 retro landscape'
  decor.userData.skipOcclusion = true
  for (const { shape, entries } of groups.values()) {
    const mesh = new THREE.InstancedMesh(geometries[shape], material, entries.length)
    entries.forEach((entry, index) => {
      position.set(entry.x, entry.y, entry.z); scale.set(entry.sx, entry.sy, entry.sz)
      matrix.compose(position, rotation, scale); mesh.setMatrixAt(index, matrix)
      mesh.setColorAt(index, color.set(entry.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    decor.add(mesh)
  }
  decor.userData.accentCells = count
  world.add(decor)
  return decor
}

export function createMiningRetroTexture(kind) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')
  const palettes = {
    mountain: ['#adb9b2', '#9caea5', '#c3cec2'],
    coast: ['#dbc99c', '#cbbb8c', '#ead8aa'],
    ice: ['#bedde0', '#a9cdd5', '#d5eeee'],
    inferno: ['#bf9078', '#aa7a68', '#d9a381'],
    crypto: ['#879aa6', '#758a98', '#a0b5bd'],
    ground: ['#8da28d', '#829882', '#99ad94'],
    'ground-2': ['#b7d7e2', '#a6c5d8', '#d8e9ed'],
    'ground-3': ['#a8b58b', '#96a77c', '#c1c69b'],
    'ground-4': ['#d6b786', '#c8a877', '#e8cca0'],
    'ground-5': ['#a79bb8', '#938cad', '#beb3ce'],
  }
  const [base, dark, light] = palettes[kind] || palettes.mountain
  ctx.fillStyle = base; ctx.fillRect(0, 0, 32, 32)
  ctx.fillStyle = dark
  if (kind.startsWith('ground')) {
    for (let i = 0; i < 12; i++) ctx.fillRect((i * 13) % 31, (i * 7) % 31, 2, 1)
  } else {
    for (let y = 0; y < 32; y += 8) {
      ctx.fillRect(0, y, 32, 1)
      for (let x = (y % 16 ? 8 : 0); x < 32; x += 16) ctx.fillRect(x, y, 1, 8)
    }
  }
  ctx.fillStyle = light
  for (let i = 0; i < 5; i++) ctx.fillRect(2 + (i * 7) % 28, 2 + (i * 13) % 28, 3, 1)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapNearestFilter
  texture.generateMipmaps = true
  if (kind.startsWith('ground')) texture.repeat.set(28, 28)
  return texture
}

/** The shoreline cutouts share one plane and material; no transparency sorting
 * is lost by drawing their non-overlapping triangles together. */
export function batchMiningShoreline(world) {
  const edges = world.children.filter(o => o.isMesh && o.renderOrder === 2 && o.userData.biomeSurface === 'water')
  if (edges.length < 2) return
  const pieces = edges.map(edge => {
    edge.updateMatrix()
    return (edge.geometry.index ? edge.geometry.toNonIndexed() : edge.geometry.clone()).applyMatrix4(edge.matrix)
  })
  const geometry = mergeGeometries(pieces)
  pieces.forEach(g=>g.dispose())
  if (!geometry) return
  const mesh = new THREE.Mesh(geometry, edges[0].material)
  mesh.name = 'M1 shoreline'
  mesh.renderOrder = 2
  mesh.userData.biomeSurface = 'water'
  mesh.userData.skipOcclusion = true
  for (const edge of edges) { edge.removeFromParent(); edge.geometry.dispose() }
  world.add(mesh)
  world.userData.retroSavedDraws = (world.userData.retroSavedDraws || 0) + edges.length - 1
}

function canBatchStaticMesh(object, world, animated) {
  const material = object.material
  if (!object.isMesh || object.isSkinnedMesh || Object.keys(object.geometry?.morphAttributes || {}).length || object.isInstancedMesh || object.children.length || !object.visible
    || !(material?.isMeshLambertMaterial || material?.isMeshBasicMaterial) || material.vertexColors || material.transparent
    || protectedBranch(object, world, animated)) return false
  for (let p = object.parent; p && p !== world; p = p.parent) if (!p.visible) return false
  return true
}

function canDecorateObstacle(row, col, obstacle, top) {
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 2 || row > 53 || col < 2 || col > 53) return false
  if ((row < 17 && col < 17) || (row >= 17 && row <= 37 && col >= 17 && col <= 37)) return false
  if (obstacle.isHouse || obstacle.shape || obstacle.bottom || obstacle.isStatue || obstacle.isNukeCube) return false
  // Only ordinary generated obstacles: special platform data must remain untouched.
  if (Object.keys(obstacle).some(k => /statue|plinth|deck|nuke|gateway/i.test(k))) return false
  if (!Number.isFinite(top) || top < .4 || top > 4.5 || (row * 17 + col * 11) % 3 !== 0) return false
  return true
}

function addRetroAccentPattern(box, cone, x, z, top, kind) {
  if (kind === 0) {
    for (const dx of [-.23, .05, .26]) box(x + dx, top + .065, z + dx / 2, .09, .11, .09, '#ebce78')
  } else if (kind === 1) {
    cone(x, top + .08, z, .19, .16, .19, '#73d8db')
    cone(x + .25, top + .045, z + .18, .10, .09, .1, '#c0eff0')
  } else if (kind === 2) {
    box(x, top + .04, z, .52, .06, .16, '#c1bda4')
    box(x + .2, top + .04, z + .22, .17, .06, .24, '#d9cba6')
  } else {
    for (const dx of [-.22, .22]) box(x + dx, top + .055, z, .17, .09, .32, '#599d84')
  }
}

function canDecorateFloor(row, col, obstacles, cells) {
  if ((row < 18 && col < 18) || (row > 15 && row < 40 && col > 15 && col < 40)) return false
  if ((row > 23 && row < 33) || (col > 23 && col < 33)) return false
  return !hasOccupiedNeighbour(row, col, obstacles, cells)
}

function hasOccupiedNeighbour(row, col, obstacles, cells) {
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (obstacles.has(`${row + dr},${col + dc}`) || cells.has(`${row + dr},${col + dc}`)) return true
  }
  return false
}

function addRetroFloorMosaic(box, row, col) {
  const x = col + .5, z = row + .5
  const warm = col > 28
  box(x, .012, z, 1.7, .018, 1.7, warm ? '#b5ac88' : '#719489')
  box(x, .024, z, 1.4, .016, 1.4, warm ? '#cbc49c' : '#8dae98')
  for (let i = 0; i < 4; i++) {
    const dx = (i % 2 ? .44 : -.44), dz = i < 2 ? -.44 : .44
    box(x + dx, .055, z + dz, .09, .09, .09, '#45786a')
    box(x + dx, .11, z + dz, .16, .035, .16, warm ? '#f4cc7c' : '#b9d9e4')
  }
}

function addRetroSkylineTree(box, cone, side, i, along) {
  const outward = -5 - (i % 3) * 1.8
  const [x, z] = [[along, outward], [56 - outward, along], [along, 56 - outward], [outward, along]][side]
  const h = 2.8 + (i % 4) * 0.65
  box(x, h * 0.3, z, .28, h * .6, .28, '#795340')
  cone(x, h * .7, z, 1.25, h, 1.25, side === 2 ? '#327886' : '#34776c')
  cone(x, h * 1.02, z, .85, h * .65, .85, '#74b49a')
  if (i % 4 === 0) {
    const height = 7 + i % 5
    cone(x, height / 2 - .5, z + (side === 0 ? -6 : 6), 4, height, 4, '#57758c')
    cone(x, height * .83, z + (side === 0 ? -6 : 6), 1.45, height * .3, 1.45, '#c0ded9')
  }
}
