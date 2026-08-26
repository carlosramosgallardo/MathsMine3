/**
 * Shared Y-band mesh extract for Milei plinth / figure bakes.
 * Colors must already be 0–1 floats (see accessorColorRgb).
 */
import { accessorArray, accessorColorRgb } from './glb-io.mjs'

/** Just below shoeTopY (0.105) on the Milei sculpt. */
export const MILEI_PLINTH_TOP_Y = 0.108

/**
 * @param {'below'|'above'} mode  below = plinth (y ≤ cut); above = figure (y > cut)
 * @param {{ floorFeet?: boolean }} [opts]  shift so min Y = 0 (figure)
 */
export function extractMileiByY(json, bin, cutoffY, mode, { floorFeet = false } = {}) {
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
    const y = pos[vi * 3 + 1]
    const drop = mode === 'below' ? y > cutoffY : y <= cutoffY
    if (drop) return -1
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
  if (floorFeet) {
    let minY = Infinity
    for (let i = 1; i < outPos.length; i += 3) minY = Math.min(minY, outPos[i])
    if (Number.isFinite(minY)) {
      for (let i = 1; i < outPos.length; i += 3) outPos[i] -= minY
    }
  }
  return {
    positions: new Float32Array(outPos),
    normals: new Float32Array(outNorm),
    colors: new Float32Array(outCol),
    indices: new Uint32Array(outIdx),
  }
}
