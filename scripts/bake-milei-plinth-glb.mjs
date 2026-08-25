#!/usr/bin/env node
/**
 * Extract the beige pedestal baked into milei.glb (vertex-coloured, y ≤ cutoff)
 * as a reusable statue base for Macron, Zelensky, etc.
 *
 * Usage:
 *   node scripts/bake-milei-plinth-glb.mjs public/models/milei.glb public/models/statue-plinth.glb
 */
import { readGlb, writeGlb, accessorArray, creditExtras, GlbBuilder } from './lib/glb-io.mjs'

const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963

/** Just below shoeTopY (0.105) on the Milei sculpt — plinth only, no boots. */
const PLINTH_TOP_Y = 0.108

function parseArgs(argv) {
  return { src: argv[0] || 'public/models/milei.glb', out: argv[1] || 'public/models/statue-plinth.glb' }
}

function extractPlinth(json, bin, cutoffY) {
  const mesh = json.meshes[0]
  const prim = mesh.primitives[0]
  const pos = accessorArray(json, bin, prim.attributes.POSITION)
  const norm = accessorArray(json, bin, prim.attributes.NORMAL)
  const col = accessorArray(json, bin, prim.attributes.COLOR_0)
  const idx = prim.indices != null ? accessorArray(json, bin, prim.indices) : null
  const triCount = idx ? idx.length : pos.length / 3
  const outPos = []
  const outNorm = []
  const outCol = []
  const outIdx = []
  const remap = new Map()
  const keepVertex = (vi) => {
    const y = pos[vi * 3 + 1]
    if (y > cutoffY) return -1
    if (remap.has(vi)) return remap.get(vi)
    const ni = outPos.length / 3
    remap.set(vi, ni)
    outPos.push(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2])
    outNorm.push(norm[vi * 3], norm[vi * 3 + 1], norm[vi * 3 + 2])
    outCol.push(col[vi * 3], col[vi * 3 + 1], col[vi * 3 + 2])
    return ni
  }
  for (let i = 0; i < triCount; i += 3) {
    const a = idx ? idx[i] : i
    const b = idx ? idx[i + 1] : i + 1
    const c = idx ? idx[i + 2] : i + 2
    const ia = keepVertex(a)
    const ib = keepVertex(b)
    const ic = keepVertex(c)
    if (ia < 0 || ib < 0 || ic < 0) continue
    outIdx.push(ia, ib, ic)
  }
  return {
    positions: new Float32Array(outPos),
    normals: new Float32Array(outNorm),
    colors: new Float32Array(outCol),
    indices: new Uint32Array(outIdx),
  }
}

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

function buildGlb(mesh, extras) {
  const json = {
    asset: { version: '2.0', generator: 'MathsMine3 bake-milei-plinth-glb', extras },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'statuePlinth', mesh: 0 }],
    materials: [{
      name: 'plinth',
      doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.72 },
    }],
  }
  const builder = new GlbBuilder(json)
  const vertexCount = mesh.positions.length / 3
  json.meshes = [{
    name: 'statuePlinth',
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

const { src, out } = parseArgs(process.argv.slice(2))
const { json, bin } = readGlb(src)
const plinth = extractPlinth(json, bin, PLINTH_TOP_Y)
if (!plinth.indices.length) throw new Error('No plinth geometry extracted — check PLINTH_TOP_Y')
const { json: outJson, bin: outBin } = buildGlb(plinth, creditExtras(json))
writeGlb(out, outJson, outBin)
console.log(`Wrote ${out} (${plinth.indices.length / 3} tris, y ≤ ${PLINTH_TOP_Y})`)
