#!/usr/bin/env node
/**
 * Bake a downloaded A-pose body scan into the game's character GLB.
 *
 * Input is any static humanoid GLB (Sketchfab CC-BY downloads are stored in
 * .private/models-src/, outside git — see the credits in README.md). Output is
 * public/models/<name>.glb: welded, normalised to the game rig space (Y-up,
 * feet on y=0, crown at HUMANOID_GLB_SRC_YMAX, facing +Z) and auto-rigged with
 * the bone names lib/humanoid-glb.js drives from the capsule pose.
 *
 * Usage:
 *   node scripts/bake-humanoid-glb.mjs .private/models-src/man-src.glb public/models/man.glb
 *   node scripts/bake-humanoid-glb.mjs <src> <out> --preview .private/preview/man
 */
import { statSync } from 'node:fs'
import sharp from 'sharp'
import {
  readGlb,
  writeGlb,
  accessorArray,
  bufferViewBytes,
  collectPrimitives,
  transformPoint,
  transformDirection,
  creditExtras,
  GlbBuilder,
} from './lib/glb-io.mjs'
import { BONE_CHAIN, measureHumanoid, buildSkeleton, computeSkinWeights, skinPoint } from './lib/humanoid-rig.mjs'
import { previewPoints } from './glb-preview.mjs'

/** Must match HUMANOID_GLB_SRC_YMAX in lib/humanoid-glb.js. */
const TARGET_HEIGHT = 1.895
const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963

function gatherMesh(json, bin, { keepUv = false } = {}) {
  const prims = collectPrimitives(json)
  const positions = []
  const normals = []
  const uvs = keepUv ? [] : null
  const indices = []
  for (const { prim, world } of prims) {
    if (prim.mode !== undefined && prim.mode !== 4) continue
    const pos = accessorArray(json, bin, prim.attributes.POSITION)
    const nor = Number.isInteger(prim.attributes.NORMAL) ? accessorArray(json, bin, prim.attributes.NORMAL) : null
    const uv = keepUv && Number.isInteger(prim.attributes.TEXCOORD_0)
      ? accessorArray(json, bin, prim.attributes.TEXCOORD_0)
      : null
    const base = positions.length / 3
    for (let i = 0; i < pos.length; i += 3) {
      const p = transformPoint(world, pos[i], pos[i + 1], pos[i + 2])
      positions.push(p[0], p[1], p[2])
      const n = nor
        ? transformDirection(world, nor[i], nor[i + 1], nor[i + 2])
        : [0, 1, 0]
      normals.push(n[0], n[1], n[2])
      if (uvs) {
        const u = uv ? uv[(i / 3) * 2] : 0
        const v = uv ? uv[(i / 3) * 2 + 1] : 0
        uvs.push(u, v)
      }
    }
    const idx = Number.isInteger(prim.indices) ? accessorArray(json, bin, prim.indices) : null
    if (idx) for (const value of idx) indices.push(base + value)
    else for (let i = 0; i < pos.length / 3; i += 1) indices.push(base + i)
  }
  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    uvs: uvs ? Float32Array.from(uvs) : null,
    indices: Uint32Array.from(indices),
  }
}

/** Scale/translate so the body stands on y=0 at TARGET_HEIGHT, hips on the axis. */
function normalize(positions) {
  let minY = Infinity; let maxY = -Infinity
  let minX = Infinity; let maxX = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    if (positions[i + 1] < minY) minY = positions[i + 1]
    if (positions[i + 1] > maxY) maxY = positions[i + 1]
    if (positions[i] < minX) minX = positions[i]
    if (positions[i] > maxX) maxX = positions[i]
  }
  const scale = TARGET_HEIGHT / (maxY - minY)
  const centerX = (minX + maxX) / 2
  // Depth is centred on the pelvis slab, not on the bounding box: toes and nose
  // would otherwise push the whole body backwards off the capsule rig. Arms are
  // excluded so a hand in front of the hip cannot drag the body either.
  const height = maxY - minY
  const pelvisLo = minY + height * 0.45
  const pelvisHi = minY + height * 0.55
  let pelvisMinZ = Infinity; let pelvisMaxZ = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    if (positions[i + 1] < pelvisLo || positions[i + 1] > pelvisHi) continue
    if (Math.abs(positions[i] - centerX) > height * 0.12) continue
    if (positions[i + 2] < pelvisMinZ) pelvisMinZ = positions[i + 2]
    if (positions[i + 2] > pelvisMaxZ) pelvisMaxZ = positions[i + 2]
  }
  const centerZ = Number.isFinite(pelvisMinZ) ? (pelvisMinZ + pelvisMaxZ) / 2 : 0
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - centerX) * scale
    positions[i + 1] = (positions[i + 1] - minY) * scale
    positions[i + 2] = (positions[i + 2] - centerZ) * scale
  }
  return { scale, centerX, centerZ }
}

const positionKey = (p, i) => `${Math.round(p[i] * 1e5)},${Math.round(p[i + 1] * 1e5)},${Math.round(p[i + 2] * 1e5)}`

/**
 * Uniform-grid cluster decimation that keeps UVs (averaged per cell). Used when
 * a textured download is still hundreds of thousands of triangles after welding.
 */
function clusterDecimate({ positions, normals, uvs, indices }, gridCells) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      if (positions[i + k] < min[k]) min[k] = positions[i + k]
      if (positions[i + k] > max[k]) max[k] = positions[i + k]
    }
  }
  const cell = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / gridCells
  const dims = min.map((lo, k) => Math.max(1, Math.ceil((max[k] - lo) / cell) + 1))
  const cellOf = new Float64Array(positions.length / 3)
  const sums = new Map()
  for (let v = 0; v < cellOf.length; v += 1) {
    const key = (
      (Math.floor((positions[v * 3 + 2] - min[2]) / cell) * dims[1]
        + Math.floor((positions[v * 3 + 1] - min[1]) / cell)) * dims[0]
      + Math.floor((positions[v * 3] - min[0]) / cell)
    )
    cellOf[v] = key
    let acc = sums.get(key)
    if (!acc) {
      acc = { n: 0, p: [0, 0, 0], nor: [0, 0, 0], uv: [0, 0], index: sums.size }
      sums.set(key, acc)
    }
    acc.n += 1
    for (let k = 0; k < 3; k += 1) {
      acc.p[k] += positions[v * 3 + k]
      acc.nor[k] += normals[v * 3 + k]
    }
    if (uvs) {
      acc.uv[0] += uvs[v * 2]
      acc.uv[1] += uvs[v * 2 + 1]
    }
  }
  const count = sums.size
  const outPos = new Float32Array(count * 3)
  const outNor = new Float32Array(count * 3)
  const outUv = uvs ? new Float32Array(count * 2) : null
  for (const acc of sums.values()) {
    const at = acc.index * 3
    const len = Math.hypot(acc.nor[0], acc.nor[1], acc.nor[2]) || 1
    for (let k = 0; k < 3; k += 1) {
      outPos[at + k] = acc.p[k] / acc.n
      outNor[at + k] = acc.nor[k] / len
    }
    if (outUv) {
      outUv[acc.index * 2] = acc.uv[0] / acc.n
      outUv[acc.index * 2 + 1] = acc.uv[1] / acc.n
    }
  }
  const outIdx = []
  for (let t = 0; t < indices.length; t += 3) {
    const a = sums.get(cellOf[indices[t]]).index
    const b = sums.get(cellOf[indices[t + 1]]).index
    const c = sums.get(cellOf[indices[t + 2]]).index
    if (a === b || b === c || a === c) continue
    outIdx.push(a, b, c)
  }
  return {
    positions: outPos,
    normals: outNor,
    uvs: outUv,
    indices: Uint32Array.from(outIdx),
  }
}

/**
 * Merge co-located corners and drop unreferenced vertices. Scans ship as soup
 * with one vertex per corner; an organic body is smooth-shaded, so normals of
 * merged corners are averaged rather than kept as hard edges. When UVs are
 * present, vertices that share a position but sit on different charts stay
 * split so the texture does not bleed across seams.
 */
function weld({ positions, normals, uvs, indices }) {
  const map = new Map()
  const outPos = []
  const outNor = []
  const outUv = uvs ? [] : null
  const outIdx = new Uint32Array(indices.length)
  for (let i = 0; i < indices.length; i += 1) {
    const v = indices[i]
    const key = uvs
      ? `${positionKey(positions, v * 3)}|${Math.round(uvs[v * 2] * 1e4)},${Math.round(uvs[v * 2 + 1] * 1e4)}`
      : positionKey(positions, v * 3)
    let target = map.get(key)
    if (target === undefined) {
      target = outPos.length / 3
      map.set(key, target)
      outPos.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2])
      outNor.push(0, 0, 0)
      if (outUv) outUv.push(uvs[v * 2], uvs[v * 2 + 1])
    }
    outNor[target * 3] += normals[v * 3]
    outNor[target * 3 + 1] += normals[v * 3 + 1]
    outNor[target * 3 + 2] += normals[v * 3 + 2]
    outIdx[i] = target
  }
  for (let v = 0; v < outNor.length; v += 3) {
    const len = Math.hypot(outNor[v], outNor[v + 1], outNor[v + 2]) || 1
    outNor[v] /= len; outNor[v + 1] /= len; outNor[v + 2] /= len
  }
  const vertexCount = outPos.length / 3
  return {
    positions: Float32Array.from(outPos),
    normals: Float32Array.from(outNor),
    uvs: outUv ? Float32Array.from(outUv) : null,
    indices: vertexCount < 65536 ? Uint16Array.from(outIdx) : outIdx,
  }
}

/** Position-only groups + their neighbours, so weights can be relaxed across UV seams. */
function weldTopology(positions, indices) {
  const map = new Map()
  const groupOf = new Uint32Array(positions.length / 3)
  let groupCount = 0
  for (let v = 0; v < positions.length / 3; v += 1) {
    const key = `${Math.round(positions[v * 3] * 1e5)},${Math.round(positions[v * 3 + 1] * 1e5)},${Math.round(positions[v * 3 + 2] * 1e5)}`
    let group = map.get(key)
    if (group === undefined) {
      group = groupCount
      groupCount += 1
      map.set(key, group)
    }
    groupOf[v] = group
  }
  const pairs = new Set()
  const add = (a, b) => {
    if (a !== b) pairs.add(a < b ? `${a}:${b}` : `${b}:${a}`)
  }
  for (let t = 0; t < indices.length; t += 3) {
    const a = groupOf[indices[t]]
    const b = groupOf[indices[t + 1]]
    const c = groupOf[indices[t + 2]]
    add(a, b); add(b, c); add(c, a)
  }
  const counts = new Uint32Array(groupCount + 1)
  const edges = []
  for (const pair of pairs) {
    const [a, b] = pair.split(':').map(Number)
    edges.push([a, b])
    counts[a + 1] += 1
    counts[b + 1] += 1
  }
  for (let g = 0; g < groupCount; g += 1) counts[g + 1] += counts[g]
  const offsets = counts
  const cursor = Uint32Array.from(offsets)
  const neighbors = new Uint32Array(edges.length * 2)
  for (const [a, b] of edges) {
    neighbors[cursor[a]] = b; cursor[a] += 1
    neighbors[cursor[b]] = a; cursor[b] += 1
  }
  return { groupOf, groupCount, offsets, neighbors }
}

function quantizeWeights(weights) {
  const out = new Uint8Array(weights.length)
  for (let v = 0; v < weights.length; v += 4) {
    let rest = 255
    let biggest = 0
    for (let k = 1; k < 4; k += 1) if (weights[v + k] > weights[v + biggest]) biggest = k
    for (let k = 0; k < 4; k += 1) {
      if (k === biggest) continue
      const q = Math.round(weights[v + k] * 255)
      out[v + k] = q
      rest -= q
    }
    out[v + biggest] = Math.max(0, rest)
  }
  return out
}

function buildGlb({ positions, normals, uvs, indices, joints, weights, skeleton, boneNames, extras, textureJpeg = null }) {
  const json = {
    asset: { version: '2.0', generator: 'MathsMine3 bake-humanoid-glb', extras },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [],
    materials: [{
      name: 'body',
      doubleSided: false,
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0.04,
        roughnessFactor: 0.68,
        ...(textureJpeg ? { baseColorTexture: { index: 0 } } : {}),
      },
    }],
  }
  if (textureJpeg) {
    json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }]
    json.images = [{ mimeType: 'image/jpeg', bufferView: null }]
    json.textures = [{ sampler: 0, source: 0 }]
  }
  const builder = new GlbBuilder(json)
  if (textureJpeg) {
    json.images[0].bufferView = builder.addBufferView(textureJpeg)
  }
  const attributes = {
    POSITION: builder.addAccessor(positions, 'VEC3', { target: ARRAY_BUFFER, minMax: true }),
    NORMAL: builder.addAccessor(normals, 'VEC3', { target: ARRAY_BUFFER }),
    JOINTS_0: builder.addAccessor(joints, 'VEC4', { target: ARRAY_BUFFER }),
    WEIGHTS_0: builder.addAccessor(weights, 'VEC4', { target: ARRAY_BUFFER, normalized: true }),
  }
  if (uvs) {
    attributes.TEXCOORD_0 = builder.addAccessor(uvs, 'VEC2', { target: ARRAY_BUFFER })
  }
  const indexAccessor = builder.addAccessor(indices, 'SCALAR', { target: ELEMENT_ARRAY_BUFFER })

  json.meshes = [{
    name: 'body',
    primitives: [{
      attributes,
      indices: indexAccessor,
      material: 0,
    }],
  }]

  const boneNodeIndex = new Map()
  json.nodes.push({ name: 'body', mesh: 0, skin: 0 })
  boneNames.forEach((name, i) => boneNodeIndex.set(name, i + 1))
  for (const name of boneNames) {
    const parent = BONE_CHAIN.find(([bone]) => bone === name)[1]
    const here = skeleton.joints[name]
    const origin = parent ? skeleton.joints[parent] : [0, 0, 0]
    json.nodes.push({
      name,
      translation: [here[0] - origin[0], here[1] - origin[1], here[2] - origin[2]],
    })
  }
  for (const name of boneNames) {
    const children = BONE_CHAIN.filter(([, parent]) => parent === name).map(([child]) => boneNodeIndex.get(child))
    if (children.length) json.nodes[boneNodeIndex.get(name)].children = children
  }

  const inverseBind = new Float32Array(boneNames.length * 16)
  boneNames.forEach((name, i) => {
    const [x, y, z] = skeleton.joints[name]
    inverseBind.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1], i * 16)
  })
  json.skins = [{
    joints: boneNames.map((name) => boneNodeIndex.get(name)),
    skeleton: boneNodeIndex.get('Hips'),
    inverseBindMatrices: builder.addAccessor(inverseBind, 'MAT4'),
  }]

  return { json, bin: builder.finish() }
}

/** Rotate a bone about X/Z the way the runtime maps the capsule pose. */
function posedMatrices(skeleton, boneNames, pose) {
  const matrices = new Array(boneNames.length)
  const world = new Map()
  const compute = (name) => {
    if (world.has(name)) return world.get(name)
    const parent = BONE_CHAIN.find(([bone]) => bone === name)[1]
    const parentMatrix = parent ? compute(parent) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    const here = skeleton.joints[name]
    const origin = parent ? skeleton.joints[parent] : [0, 0, 0]
    const t = [here[0] - origin[0], here[1] - origin[1], here[2] - origin[2]]
    const { x = 0, z = 0 } = pose[name] || {}
    const cx = Math.cos(x); const sx = Math.sin(x)
    const cz = Math.cos(z); const sz = Math.sin(z)
    const local = [
      cz, sz, 0, 0,
      -sz * cx, cz * cx, sx, 0,
      sz * sx, -cz * sx, cx, 0,
      t[0], t[1], t[2], 1,
    ]
    const out = new Array(16).fill(0)
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) {
        let sum = 0
        for (let k = 0; k < 4; k += 1) sum += parentMatrix[k * 4 + r] * local[c * 4 + k]
        out[c * 4 + r] = sum
      }
    }
    world.set(name, out)
    return out
  }
  boneNames.forEach((name, i) => {
    const w = compute(name)
    const [bx, by, bz] = skeleton.joints[name]
    matrices[i] = [
      w[0], w[1], w[2], 0,
      w[4], w[5], w[6], 0,
      w[8], w[9], w[10], 0,
      w[12] - (w[0] * bx + w[4] * by + w[8] * bz),
      w[13] - (w[1] * bx + w[5] * by + w[9] * bz),
      w[14] - (w[2] * bx + w[6] * by + w[10] * bz),
      1,
    ]
  })
  return matrices
}

function previewPose(mesh, skeleton, boneNames, outBase) {
  const pose = {
    LeftUpperLeg: { x: 0.55 },
    RightUpperLeg: { x: -0.55 },
    LeftUpperArm: { x: -0.7, z: -0.5 },
    RightUpperArm: { x: 1.9, z: 0.4 },
    Spine: { x: -0.08 },
  }
  const matrices = posedMatrices(skeleton, boneNames, pose)
  const out = new Float32Array(mesh.positions.length)
  const tmp = [0, 0, 0]
  const jointIndices = [0, 0, 0, 0]
  const jointWeights = [0, 0, 0, 0]
  for (let v = 0; v < mesh.positions.length / 3; v += 1) {
    for (let k = 0; k < 4; k += 1) {
      jointIndices[k] = mesh.joints[v * 4 + k]
      jointWeights[k] = mesh.weights[v * 4 + k]
    }
    skinPoint(tmp, mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2], jointIndices, jointWeights, matrices)
    out.set(tmp, v * 3)
  }
  previewPoints(out, `${outBase}-posed`)
}

async function extractTextureJpeg(json, bin, { maxTexture = 1024, quality = 82 } = {}) {
  const image = json.images?.[0]
  if (!image || !Number.isInteger(image.bufferView)) return null
  const bytes = bufferViewBytes(json, bin, image.bufferView)
  const meta = await sharp(bytes).metadata()
  const size = Math.min(maxTexture, Math.max(meta.width || maxTexture, meta.height || maxTexture))
  const data = await sharp(bytes)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()
  return { data: new Uint8Array(data), from: `${meta.width}x${meta.height}`, to: `${size}` }
}

async function main() {
  const [src, out, ...rest] = process.argv.slice(2)
  if (!src || !out) {
    console.error('usage: node scripts/bake-humanoid-glb.mjs <src.glb> <out.glb> [--preview <prefix>] [--keep-texture] [--max-texture n]')
    process.exit(1)
  }
  const previewFlag = rest.indexOf('--preview')
  const previewBase = previewFlag >= 0 ? rest[previewFlag + 1] : null
  const keepTexture = rest.includes('--keep-texture')
  const maxTexFlag = rest.indexOf('--max-texture')
  const maxTexture = maxTexFlag >= 0 ? Number(rest[maxTexFlag + 1]) : 1024
  const gridFlag = rest.indexOf('--grid')
  const grid = gridFlag >= 0 ? Number(rest[gridFlag + 1]) : (keepTexture ? 160 : 0)

  const { json, bin } = readGlb(src)
  const raw = gatherMesh(json, bin, { keepUv: keepTexture })
  let mesh = weld(raw)
  if (grid > 0 && mesh.positions.length / 3 > 40000) {
    mesh = clusterDecimate(mesh, grid)
  }
  const fit = normalize(mesh.positions)
  const measurements = measureHumanoid(mesh.positions, TARGET_HEIGHT)
  const skeleton = buildSkeleton(measurements)
  const topology = weldTopology(mesh.positions, mesh.indices)
  const { joints, weights, boneNames } = computeSkinWeights(mesh.positions, skeleton, {
    height: TARGET_HEIGHT,
    armMinX: measurements.armMinX,
    welded: topology,
  })

  const texture = keepTexture ? await extractTextureJpeg(json, bin, { maxTexture }) : null
  const { json: outJson, bin: outBin } = buildGlb({
    positions: mesh.positions,
    normals: mesh.normals,
    uvs: mesh.uvs,
    indices: mesh.indices,
    joints,
    weights: quantizeWeights(weights),
    skeleton,
    boneNames,
    extras: creditExtras(json),
    textureJpeg: texture?.data || null,
  })
  writeGlb(out, outJson, outBin)

  const round = (v) => Number(v.toFixed(4))
  console.log(`${src} → ${out}`)
  console.log(`  verts ${raw.positions.length / 3} → ${mesh.positions.length / 3}, tris ${mesh.indices.length / 3}`)
  console.log(`  source fit: scale ${round(fit.scale)}, centre x ${round(fit.centerX)} z ${round(fit.centerZ)}`)
  if (texture) console.log(`  texture ${texture.from} → JPEG ${texture.to}px`)
  console.log('  landmarks:', JSON.stringify({
    neckY: round(measurements.neckY),
    crotchY: round(measurements.crotchY),
    hipsY: round(measurements.hipsY),
    shoulderY: round(measurements.shoulderY),
    wristY: round(measurements.wristY),
    handTipY: round(measurements.handTipY),
    ankleY: round(measurements.ankleY),
    armMinX: round(measurements.armMinX),
  }))
  console.log(`  size ${(statSync(out).size / 1024).toFixed(0)} KB`)

  if (previewBase) {
    previewPoints(mesh.positions, previewBase)
    previewPose({ ...mesh, joints, weights }, skeleton, boneNames, previewBase)
    console.log(`  preview ${previewBase}-front.png / -posed-front.png`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
