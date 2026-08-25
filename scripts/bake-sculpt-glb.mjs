#!/usr/bin/env node
/**
 * Bake a fused photogrammetry/AI sculpt into a game-ready GLB.
 *
 * Sculpt downloads arrive as one vertex-coloured mesh split into 64K chunks,
 * with millions of triangles and no UVs — unusable in a browser as-is. This
 * merges the chunks, decimates them by vertex clustering, recomputes normals
 * and normalises the result to the game's character space (Y-up, feet on y=0,
 * facing +Z, total height HUMANOID_GLB_SRC_YMAX) so a sculpt can stand in for a
 * character without touching the runtime fit.
 *
 * Usage:
 *   node scripts/bake-sculpt-glb.mjs .private/models-src/trump-src.glb public/models/trump.glb \
 *     [--grid 160] [--max-y 0.58] [--preview .private/preview/trump]
 */
import { statSync } from 'node:fs'
import {
  readGlb,
  writeGlb,
  accessorArray,
  collectPrimitives,
  transformPoint,
  transformDirection,
  creditExtras,
  GlbBuilder,
} from './lib/glb-io.mjs'
import { previewPoints } from './glb-preview.mjs'

/** Must match HUMANOID_GLB_SRC_YMAX in lib/humanoid-glb.js. */
const TARGET_HEIGHT = 1.895
const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963

function parseArgs(argv) {
  const options = { src: argv[0], out: argv[1], grid: 160, maxY: null, preview: null, paint: null }
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--grid') options.grid = Number(argv[i + 1])
    else if (argv[i] === '--max-y') options.maxY = Number(argv[i + 1])
    else if (argv[i] === '--preview') options.preview = argv[i + 1]
    else if (argv[i] === '--paint') options.paint = argv[i + 1]
  }
  return options
}

/** Reader that yields RGB in 0..1 for any COLOR_0 encoding, white when absent. */
function colorReader(json, bin, prim) {
  const accessor = prim.attributes.COLOR_0
  if (!Number.isInteger(accessor)) return () => [1, 1, 1]
  const data = accessorArray(json, bin, accessor)
  const stride = json.accessors[accessor].type === 'VEC4' ? 4 : 3
  const scales = { Uint8Array: 1 / 255, Uint16Array: 1 / 65535 }
  const scale = scales[data.constructor.name] ?? 1
  return (vertex) => {
    const at = vertex * stride
    return [data[at] * scale, data[at + 1] * scale, data[at + 2] * scale]
  }
}

function countMerged(json, prims) {
  let vertices = 0
  let indices = 0
  for (const { prim } of prims) {
    const count = json.accessors[prim.attributes.POSITION].count
    vertices += count
    indices += Number.isInteger(prim.indices) ? json.accessors[prim.indices].count : count
  }
  return { vertices, indices }
}

/** Merge every chunk of the sculpt into one indexed, world-space mesh. */
function mergeChunks(json, bin) {
  const prims = collectPrimitives(json)
  const total = countMerged(json, prims)
  const mesh = {
    positions: new Float32Array(total.vertices * 3),
    normals: new Float32Array(total.vertices * 3),
    colors: new Float32Array(total.vertices * 3),
    indices: new Uint32Array(total.indices),
  }
  let vertexAt = 0
  let indexAt = 0
  for (const { prim, world } of prims) {
    const pos = accessorArray(json, bin, prim.attributes.POSITION)
    const nor = Number.isInteger(prim.attributes.NORMAL) ? accessorArray(json, bin, prim.attributes.NORMAL) : null
    const colorAt = colorReader(json, bin, prim)
    const base = vertexAt / 3
    const count = pos.length / 3
    for (let v = 0; v < count; v += 1) {
      const p = transformPoint(world, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
      const n = nor ? transformDirection(world, nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]) : [0, 1, 0]
      const c = colorAt(v)
      for (let k = 0; k < 3; k += 1) {
        mesh.positions[vertexAt + k] = p[k]
        mesh.normals[vertexAt + k] = n[k]
        mesh.colors[vertexAt + k] = c[k]
      }
      vertexAt += 3
    }
    const idx = Number.isInteger(prim.indices) ? accessorArray(json, bin, prim.indices) : null
    const indexCount = idx ? idx.length : count
    for (let i = 0; i < indexCount; i += 1) {
      mesh.indices[indexAt] = base + (idx ? idx[i] : i)
      indexAt += 1
    }
  }
  return mesh
}

/** Drop every triangle whose centre sits above `maxY` (used to lop off a rider). */
function clipAbove(mesh, maxY) {
  const kept = []
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const mid = (mesh.positions[mesh.indices[t] * 3 + 1]
      + mesh.positions[mesh.indices[t + 1] * 3 + 1]
      + mesh.positions[mesh.indices[t + 2] * 3 + 1]) / 3
    if (mid <= maxY) kept.push(mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2])
  }
  return { ...mesh, indices: Uint32Array.from(kept) }
}

function boundsOf(positions) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let v = 0; v < positions.length; v += 3) {
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], positions[v + k])
      max[k] = Math.max(max[k], positions[v + k])
    }
  }
  return { min, max }
}

/**
 * Vertex-clustering decimation: snap vertices to a uniform grid, average each
 * cell, then rebuild the triangles that still span three distinct cells. Keeps
 * the silhouette of an organic sculpt at a fraction of the triangles, and
 * unlike edge-collapse needs no connectivity pass over a million vertices.
 */
function clusterDecimate(mesh, gridCells) {
  const { min, max } = boundsOf(mesh.positions)
  const cell = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / gridCells
  const dims = min.map((lo, k) => Math.max(1, Math.ceil((max[k] - lo) / cell) + 1))
  const cellOf = new Float64Array(mesh.positions.length / 3)
  const sums = new Map()
  for (let v = 0; v < cellOf.length; v += 1) {
    const cx = Math.floor((mesh.positions[v * 3] - min[0]) / cell)
    const cy = Math.floor((mesh.positions[v * 3 + 1] - min[1]) / cell)
    const cz = Math.floor((mesh.positions[v * 3 + 2] - min[2]) / cell)
    const key = (cz * dims[1] + cy) * dims[0] + cx
    cellOf[v] = key
    let acc = sums.get(key)
    if (!acc) {
      acc = { n: 0, p: [0, 0, 0], nor: [0, 0, 0], col: [0, 0, 0], index: sums.size }
      sums.set(key, acc)
    }
    acc.n += 1
    for (let k = 0; k < 3; k += 1) {
      acc.p[k] += mesh.positions[v * 3 + k]
      acc.nor[k] += mesh.normals[v * 3 + k]
      acc.col[k] += mesh.colors[v * 3 + k]
    }
  }
  const count = sums.size
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  for (const acc of sums.values()) {
    const at = acc.index * 3
    const len = Math.hypot(acc.nor[0], acc.nor[1], acc.nor[2]) || 1
    for (let k = 0; k < 3; k += 1) {
      positions[at + k] = acc.p[k] / acc.n
      normals[at + k] = acc.nor[k] / len
      colors[at + k] = acc.col[k] / acc.n
    }
  }
  const indices = []
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = sums.get(cellOf[mesh.indices[t]]).index
    const b = sums.get(cellOf[mesh.indices[t + 1]]).index
    const c = sums.get(cellOf[mesh.indices[t + 2]]).index
    if (a === b || b === c || a === c) continue
    indices.push(a, b, c)
  }
  return { positions, normals, colors, indices: Uint32Array.from(indices) }
}

/** Drop vertices no triangle references any more. */
function compact(mesh) {
  const remap = new Int32Array(mesh.positions.length / 3).fill(-1)
  const positions = []
  const normals = []
  const colors = []
  const indices = new Uint32Array(mesh.indices.length)
  for (let i = 0; i < mesh.indices.length; i += 1) {
    const v = mesh.indices[i]
    if (remap[v] < 0) {
      remap[v] = positions.length / 3
      for (let k = 0; k < 3; k += 1) {
        positions.push(mesh.positions[v * 3 + k])
        normals.push(mesh.normals[v * 3 + k])
        colors.push(mesh.colors[v * 3 + k])
      }
    }
    indices[i] = remap[v]
  }
  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    colors: Float32Array.from(colors),
    indices,
  }
}

/** Percentile bounds on one axis — ignores thin outliers like a held prop. */
function trimmedCenter(positions, axis, keep = 0.94) {
  const values = new Float64Array(positions.length / 3)
  for (let v = 0; v < values.length; v += 1) values[v] = positions[v * 3 + axis]
  values.sort()
  const cut = Math.floor(values.length * (1 - keep) / 2)
  return (values[cut] + values[values.length - 1 - cut]) / 2
}

function normalize(mesh) {
  const { min, max } = boundsOf(mesh.positions)
  const minY = min[1]
  const scale = TARGET_HEIGHT / (max[1] - minY)
  const centerX = trimmedCenter(mesh.positions, 0)
  const centerZ = trimmedCenter(mesh.positions, 2)
  for (let v = 0; v < mesh.positions.length / 3; v += 1) {
    mesh.positions[v * 3] = (mesh.positions[v * 3] - centerX) * scale
    mesh.positions[v * 3 + 1] = (mesh.positions[v * 3 + 1] - minY) * scale
    mesh.positions[v * 3 + 2] = (mesh.positions[v * 3 + 2] - centerZ) * scale
  }
  return { scale, centerX, centerZ }
}

/**
 * Sketchfab sculpts often ship near-black vertex paint (p50 ≈ 0.12). Stretch
 * luminance into a readable range while keeping each vertex's hue — Trump's
 * suit, skin and Bibi's jacket stay distinct, just no longer crushed.
 */
function boostColors(colors, { loPct = 0.02, hiPct = 0.98, targetLo = 0.22, targetHi = 1.0 } = {}) {
  const count = colors.length / 3
  const lums = new Float64Array(count)
  for (let v = 0; v < count; v += 1) {
    lums[v] = (colors[v * 3] + colors[v * 3 + 1] + colors[v * 3 + 2]) / 3
  }
  const sorted = Float64Array.from(lums).sort()
  const lo = sorted[Math.floor((count - 1) * loPct)]
  const hi = sorted[Math.floor((count - 1) * hiPct)]
  const span = Math.max(1e-6, hi - lo)
  for (let v = 0; v < count; v += 1) {
    const t = Math.min(1, Math.max(0, (lums[v] - lo) / span))
    // Mild gamma so midtones (suits, skin) lift without blowing highlights.
    const target = targetLo + (t ** 0.75) * (targetHi - targetLo)
    const scale = lums[v] > 1e-6 ? target / lums[v] : 1
    for (let k = 0; k < 3; k += 1) {
      colors[v * 3 + k] = Math.min(1, Math.max(0, colors[v * 3 + k] * scale))
    }
  }
}

/**
 * Pick a region colour for the monochrome Milei+chainsaw STL after normalisation.
 * Tuned on the FrancoGUG sculpt bounds (feet y=0, crown y≈1.9, saw +Z at mid).
 */
function mileiRgbAt(x, y, z) {
  const r = Math.hypot(x, z)
  if (y < 0.16) return y < 0.06 ? [0.42, 0.30, 0.14] : [0.62, 0.48, 0.22]
  if (y > 0.55 && y < 1.08 && z > 0.28) return z > 0.72 ? [0.72, 0.76, 0.80] : [0.92, 0.55, 0.08]
  if (y > 1.52) return [0.18, 0.11, 0.07]
  if (y > 1.28 && Math.abs(x) < 0.24 && z > -0.38 && z < 0.22) return [0.86, 0.68, 0.52]
  if (y > 0.55 && y < 1.05 && r > 0.42 && z > 0.05) return [0.82, 0.62, 0.46]
  if (y < 0.38) return [0.12, 0.12, 0.14]
  const sash = y > 0.85 && y < 1.25 && Math.abs(x) < 0.18 && z > -0.05 && z < 0.28
  return sash ? [0.45, 0.62, 0.82] : [0.14, 0.16, 0.22]
}

function paintMileiColors(mesh) {
  const { positions, colors } = mesh
  const count = positions.length / 3
  for (let v = 0; v < count; v += 1) {
    const x = positions[v * 3]
    const y = positions[v * 3 + 1]
    const z = positions[v * 3 + 2]
    const rgb = mileiRgbAt(x, y, z)
    const shade = 0.92 + 0.08 * Math.sin(y * 11 + x * 7)
    colors[v * 3] = Math.min(1, rgb[0] * shade)
    colors[v * 3 + 1] = Math.min(1, rgb[1] * shade)
    colors[v * 3 + 2] = Math.min(1, rgb[2] * shade)
  }
}

/** RGB floats → RGBA bytes: glTF accessors must stay 4-byte aligned. */
function toUint8Colors(colors) {
  const count = colors.length / 3
  const out = new Uint8Array(count * 4)
  for (let v = 0; v < count; v += 1) {
    for (let k = 0; k < 3; k += 1) {
      out[v * 4 + k] = Math.max(0, Math.min(255, Math.round(colors[v * 3 + k] * 255)))
    }
    out[v * 4 + 3] = 255
  }
  return out
}

function buildGlb(mesh, extras, name) {
  const json = {
    asset: { version: '2.0', generator: 'MathsMine3 bake-sculpt-glb', extras },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    materials: [{
      name,
      // Sculpts carry thin, open shells (straps, a rod, a line) that vanish
      // when backfaces are culled.
      doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.72 },
    }],
  }
  const builder = new GlbBuilder(json)
  const vertexCount = mesh.positions.length / 3
  json.meshes = [{
    name,
    primitives: [{
      attributes: {
        POSITION: builder.addAccessor(mesh.positions, 'VEC3', { target: ARRAY_BUFFER, minMax: true }),
        NORMAL: builder.addAccessor(mesh.normals, 'VEC3', { target: ARRAY_BUFFER }),
        COLOR_0: builder.addAccessor(toUint8Colors(mesh.colors), 'VEC4', { target: ARRAY_BUFFER, normalized: true }),
      },
      indices: builder.addAccessor(
        vertexCount < 65536 ? Uint16Array.from(mesh.indices) : mesh.indices,
        'SCALAR',
        { target: ELEMENT_ARRAY_BUFFER },
      ),
      material: 0,
    }],
  }]
  return { json, bin: builder.finish() }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options.src || !options.out) {
    console.error('usage: node scripts/bake-sculpt-glb.mjs <src.glb> <out.glb> [--grid n] [--max-y y] [--paint milei] [--preview prefix]')
    process.exit(1)
  }
  const { json, bin } = readGlb(options.src)
  let mesh = mergeChunks(json, bin)
  const sourceTris = mesh.indices.length / 3
  if (Number.isFinite(options.maxY)) mesh = clipAbove(mesh, options.maxY)
  mesh = compact(clusterDecimate(mesh, options.grid))
  const fit = normalize(mesh)
  if (String(options.paint || '') === 'milei') paintMileiColors(mesh)
  else boostColors(mesh.colors)

  const name = options.out.split('/').pop().replace(/\.glb$/, '')
  const { json: outJson, bin: outBin } = buildGlb(mesh, creditExtras(json), name)
  writeGlb(options.out, outJson, outBin)

  const round = (v) => Number(v.toFixed(4))
  const { min, max } = boundsOf(mesh.positions)
  console.log(`${options.src} → ${options.out}`)
  console.log(`  tris ${sourceTris} → ${mesh.indices.length / 3}, verts ${mesh.positions.length / 3} (grid ${options.grid})`)
  console.log(`  source fit: scale ${round(fit.scale)}, centre x ${round(fit.centerX)} z ${round(fit.centerZ)}`)
  console.log(`  bounds min ${min.map(round).join(', ')} max ${max.map(round).join(', ')}`)
  console.log(`  size ${(statSync(options.src).size / 1024 / 1024).toFixed(1)} MB → ${(statSync(options.out).size / 1024).toFixed(0)} KB`)
  if (options.preview) {
    previewPoints(mesh.positions, options.preview)
    console.log(`  preview ${options.preview}-front.png / -side.png`)
  }
}

main()
