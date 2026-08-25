#!/usr/bin/env node
/**
 * Extract the beige pedestal baked into milei.glb (vertex-coloured, y ≤ cutoff)
 * as a reusable statue base for Macron, Zelensky, etc.
 *
 * Usage:
 *   node scripts/bake-milei-plinth-glb.mjs public/models/milei.glb public/models/statue-plinth.glb
 */
import {
  readGlb,
  writeGlb,
  accessorArray,
  creditExtras,
  buildVertexColorMeshGlb,
} from './lib/glb-io.mjs'

/** Just below shoeTopY (0.105) on the Milei sculpt — plinth only, no boots. */
const PLINTH_TOP_Y = 0.108

function extractPlinth(json, bin, cutoffY) {
  const prim = json.meshes[0].primitives[0]
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
    if (pos[vi * 3 + 1] > cutoffY) return -1
    if (remap.has(vi)) return remap.get(vi)
    const ni = outPos.length / 3
    remap.set(vi, ni)
    const o = vi * 3
    outPos.push(pos[o], pos[o + 1], pos[o + 2])
    outNorm.push(norm[o], norm[o + 1], norm[o + 2])
    outCol.push(col[o], col[o + 1], col[o + 2])
    return ni
  }
  for (let i = 0; i < triCount; i += 3) {
    const a = keepVertex(idx ? idx[i] : i)
    const b = keepVertex(idx ? idx[i + 1] : i + 1)
    const c = keepVertex(idx ? idx[i + 2] : i + 2)
    if (a < 0 || b < 0 || c < 0) continue
    outIdx.push(a, b, c)
  }
  return {
    positions: new Float32Array(outPos),
    normals: new Float32Array(outNorm),
    colors: new Float32Array(outCol),
    indices: new Uint32Array(outIdx),
  }
}

const src = process.argv[2] || 'public/models/milei.glb'
const out = process.argv[3] || 'public/models/statue-plinth.glb'
const { json, bin } = readGlb(src)
const plinth = extractPlinth(json, bin, PLINTH_TOP_Y)
if (!plinth.indices.length) throw new Error('No plinth geometry extracted — check PLINTH_TOP_Y')
const { json: outJson, bin: outBin } = buildVertexColorMeshGlb(plinth, {
  name: 'statuePlinth',
  generator: 'MathsMine3 bake-milei-plinth-glb',
  extras: creditExtras(json),
})
writeGlb(out, outJson, outBin)
console.log(`Wrote ${out} (${plinth.indices.length / 3} tris, y ≤ ${PLINTH_TOP_Y})`)
