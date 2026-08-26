#!/usr/bin/env node
/**
 * Strip the baked pedestal from milei.glb and write a feet-on-y=0 figure for
 * patrol (shared statue-plinth.glb stays at the plaza).
 *
 * Usage:
 *   node scripts/bake-milei-figure-glb.mjs public/models/milei.glb public/models/milei-figure.glb
 */
import {
  readGlb,
  writeGlb,
  accessorArray,
  accessorColorRgb,
  creditExtras,
  buildVertexColorMeshGlb,
} from './lib/glb-io.mjs'

/** Same cutoff as bake-milei-plinth-glb — figure is everything above. */
const PLINTH_TOP_Y = 0.108

function extractFigure(json, bin, cutoffY) {
  const prim = json.meshes[0].primitives[0]
  const pos = accessorArray(json, bin, prim.attributes.POSITION)
  const norm = accessorArray(json, bin, prim.attributes.NORMAL)
  const col = accessorColorRgb(json, bin, prim.attributes.COLOR_0)
  const idx = prim.indices != null ? accessorArray(json, bin, prim.indices) : null
  const triCount = idx ? idx.length : pos.length / 3
  const outPos = []
  const outNorm = []
  const outCol = []
  const outIdx = []
  const remap = new Map()
  const keepVertex = (vi) => {
    // Keep if this vertex is above the plinth (boots sit on the deck).
    if (pos[vi * 3 + 1] <= cutoffY) return -1
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
    // Keep tris that touch the figure (at least one kept vert) by dropping
    // plinth-only faces; require all three so the cut is clean.
    if (a < 0 || b < 0 || c < 0) continue
    outIdx.push(a, b, c)
  }
  // Drop feet onto y=0 for the shared plinth deck.
  let minY = Infinity
  for (let i = 1; i < outPos.length; i += 3) minY = Math.min(minY, outPos[i])
  if (Number.isFinite(minY)) {
    for (let i = 1; i < outPos.length; i += 3) outPos[i] -= minY
  }
  return {
    positions: new Float32Array(outPos),
    normals: new Float32Array(outNorm),
    colors: new Float32Array(outCol),
    indices: new Uint32Array(outIdx),
  }
}

/** Warm skin on face + neck; keep hair dark; leave suit/saw alone. */
function paintHeadAndNeck(mesh) {
  const { positions, colors } = mesh
  let maxY = 0
  for (let i = 1; i < positions.length; i += 3) maxY = Math.max(maxY, positions[i])
  if (maxY < 0.2) return
  const skin = [0.90, 0.72, 0.55]
  const neck = [0.86, 0.66, 0.50]
  const hair = [0.14, 0.09, 0.06]
  for (let v = 0; v < positions.length / 3; v += 1) {
    const x = positions[v * 3]
    const y = positions[v * 3 + 1]
    const z = positions[v * 3 + 2]
    const yn = y / maxY
    const r = Math.hypot(x, z)
    const o = v * 3
    // Crown / hair volume
    if (yn > 0.86 && r < 0.36) {
      const t = 0.55
      colors[o] = colors[o] * (1 - t) + hair[0] * t
      colors[o + 1] = colors[o + 1] * (1 - t) + hair[1] * t
      colors[o + 2] = colors[o + 2] * (1 - t) + hair[2] * t
      continue
    }
    // Face (front of head)
    if (yn > 0.70 && yn < 0.90 && Math.abs(x) < 0.22 && z > -0.32 && z < 0.22 && r < 0.34) {
      const t = 0.78
      colors[o] = Math.min(1, colors[o] * (1 - t) + skin[0] * t)
      colors[o + 1] = Math.min(1, colors[o + 1] * (1 - t) + skin[1] * t)
      colors[o + 2] = Math.min(1, colors[o + 2] * (1 - t) + skin[2] * t)
      continue
    }
    // Neck / collar band
    if (yn > 0.58 && yn < 0.72 && r < 0.24 && z > -0.22 && z < 0.18) {
      const t = 0.70
      colors[o] = Math.min(1, colors[o] * (1 - t) + neck[0] * t)
      colors[o + 1] = Math.min(1, colors[o + 1] * (1 - t) + neck[1] * t)
      colors[o + 2] = Math.min(1, colors[o + 2] * (1 - t) + neck[2] * t)
    }
  }
}

const src = process.argv[2] || 'public/models/milei.glb'
const out = process.argv[3] || 'public/models/milei-figure.glb'
const { json, bin } = readGlb(src)
const figure = extractFigure(json, bin, PLINTH_TOP_Y)
if (!figure.indices.length) throw new Error('No figure geometry extracted — check PLINTH_TOP_Y')
paintHeadAndNeck(figure)
const { json: outJson, bin: outBin } = buildVertexColorMeshGlb(figure, {
  name: 'mileiFigure',
  generator: 'MathsMine3 bake-milei-figure-glb',
  extras: creditExtras(json),
})
writeGlb(out, outJson, outBin)
console.log(`Wrote ${out} (${figure.indices.length / 3} tris, y > ${PLINTH_TOP_Y})`)
