/**
 * Shared Y-band mesh extract for Milei plinth / figure bakes.
 * Colors must already be 0–1 floats (see accessorColorRgb).
 */
import { accessorArray, accessorColorRgb } from './glb-io.mjs'

/** Just above the cream deck (y≈0.14); shoes/legs start dark at y≥0.16. */
export const MILEI_PLINTH_TOP_Y = 0.155

function readMeshBuffers(json, bin) {
  const prim = json.meshes[0].primitives[0]
  return {
    pos: accessorArray(json, bin, prim.attributes.POSITION),
    norm: accessorArray(json, bin, prim.attributes.NORMAL),
    col: accessorColorRgb(json, bin, prim.attributes.COLOR_0),
    idx: prim.indices != null ? accessorArray(json, bin, prim.indices) : null,
  }
}

function pushVertex(out, src, vi) {
  const o = vi * 3
  out.pos.push(src.pos[o], src.pos[o + 1], src.pos[o + 2])
  out.norm.push(src.norm[o], src.norm[o + 1], src.norm[o + 2])
  out.col.push(src.col[o], src.col[o + 1], src.col[o + 2])
}

function floorMeshFeet(outPos) {
  let minY = Infinity
  for (let i = 1; i < outPos.length; i += 3) minY = Math.min(minY, outPos[i])
  if (!Number.isFinite(minY)) return
  for (let i = 1; i < outPos.length; i += 3) outPos[i] -= minY
}

/**
 * @param {'below'|'above'} mode  below = plinth (y ≤ cut); above = figure (y > cut)
 * @param {{ floorFeet?: boolean }} [opts]  shift so min Y = 0 (figure)
 */
export function extractMileiByY(json, bin, cutoffY, mode, { floorFeet = false } = {}) {
  const src = readMeshBuffers(json, bin)
  const triCount = src.idx ? src.idx.length : src.pos.length / 3
  const out = { pos: [], norm: [], col: [], idx: [] }
  const remap = new Map()
  const keep = (vi) => {
    const y = src.pos[vi * 3 + 1]
    if (mode === 'below' ? y > cutoffY : y <= cutoffY) return -1
    if (remap.has(vi)) return remap.get(vi)
    const ni = out.pos.length / 3
    remap.set(vi, ni)
    pushVertex(out, src, vi)
    return ni
  }
  for (let i = 0; i < triCount; i += 3) {
    const a = keep(src.idx ? src.idx[i] : i)
    const b = keep(src.idx ? src.idx[i + 1] : i + 1)
    const c = keep(src.idx ? src.idx[i + 2] : i + 2)
    if (a < 0 || b < 0 || c < 0) continue
    out.idx.push(a, b, c)
  }
  if (floorFeet) floorMeshFeet(out.pos)
  return {
    positions: new Float32Array(out.pos),
    normals: new Float32Array(out.norm),
    colors: new Float32Array(out.col),
    indices: new Uint32Array(out.idx),
  }
}
