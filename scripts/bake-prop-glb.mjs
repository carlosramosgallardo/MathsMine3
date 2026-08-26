#!/usr/bin/env node
/**
 * Shrink a downloaded prop GLB (the Fennec battle car, statues, scenery) to
 * something a browser game can stream.
 *
 * Sketchfab exports carry 2K PNG textures, tangents, spare UV sets and one copy
 * of every repeated part. This welds vertices, reuses identical meshes (the car
 * ships the same wheel four times), drops attributes nothing samples and
 * re-encodes the textures as JPEG. The node hierarchy, materials and transforms
 * are preserved, so the runtime keeps loading it with a plain GLTFLoader.
 *
 * Usage:
 *   node scripts/bake-prop-glb.mjs .private/models-src/rl-car-src.glb public/models/rl-car.glb
 *   ... [--max-texture 1024] [--quality 82] [--keep-normal-maps] [--keep-skin] [--decimate-grid n]
 */
import { statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import {
  readGlb,
  writeGlb,
  accessorArray,
  bufferViewBytes,
  creditExtras,
  GlbBuilder,
  IDENTITY,
  multiply,
  nodeMatrix,
  transformPoint,
  transformDirection,
} from './lib/glb-io.mjs'

const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963
const VEC_OF = { POSITION: 3, NORMAL: 3, TEXCOORD_0: 2, TEXCOORD_1: 2, COLOR_0: 4 }

/**
 * Ready Player Me / Sketchfab avatars ship bind-pose meshes + a rest skeleton.
 * Stripping `skin` without applying the rest pose leaves a white T-pose. Bake
 * the current joint pose into POSITION/NORMAL, then drop skinning entirely.
 */
function bakeRestPoseSkins(json, bin) {
  if (!json.skins?.length) return bin
  const world = new Array(json.nodes.length)
  const walk = (i, parent) => {
    world[i] = multiply(parent, nodeMatrix(json.nodes[i]))
    for (const c of json.nodes[i].children || []) walk(c, world[i])
  }
  for (const root of json.scenes[json.scene || 0].nodes) walk(root, IDENTITY)

  const skinPalettes = json.skins.map((skin) => {
    const ibm = accessorArray(json, bin, skin.inverseBindMatrices)
    return skin.joints.map((jointIndex, j) => {
      const inv = ibm.slice(j * 16, j * 16 + 16)
      return multiply(world[jointIndex], inv)
    })
  })

  // Rewrite POSITION/NORMAL into appended buffer views.
  const chunks = [Buffer.from(bin)]
  let length = bin.length
  const addView = (data) => {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    const pad = (4 - (length % 4)) % 4
    if (pad) {
      chunks.push(Buffer.alloc(pad))
      length += pad
    }
    const viewIndex = json.bufferViews.length
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, target: ARRAY_BUFFER })
    chunks.push(bytes)
    length += bytes.length
    return viewIndex
  }

  for (const node of json.nodes) {
    if (!Number.isInteger(node.mesh) || !Number.isInteger(node.skin)) continue
    const palette = skinPalettes[node.skin]
    if (!palette?.length) continue
    const mesh = json.meshes[node.mesh]
    for (const prim of mesh.primitives || []) {
      const jointsAcc = prim.attributes.JOINTS_0
      const weightsAcc = prim.attributes.WEIGHTS_0
      const posAcc = prim.attributes.POSITION
      if (!Number.isInteger(jointsAcc) || !Number.isInteger(weightsAcc) || !Number.isInteger(posAcc)) continue
      const pos = Float32Array.from(accessorArray(json, bin, posAcc))
      const joints = accessorArray(json, bin, jointsAcc)
      const weights = accessorArray(json, bin, weightsAcc)
      const jointComps = joints.length / (pos.length / 3)
      const weightComps = weights.length / (pos.length / 3)
      const outPos = new Float32Array(pos.length)
      for (let v = 0; v < pos.length / 3; v += 1) {
        let x = 0
        let y = 0
        let z = 0
        for (let k = 0; k < Math.min(4, jointComps, weightComps); k += 1) {
          const w = weights[v * weightComps + k]
          if (!(w > 0)) continue
          const joint = joints[v * jointComps + k]
          const m = palette[joint]
          if (!m) continue
          const p = transformPoint(m, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
          x += p[0] * w
          y += p[1] * w
          z += p[2] * w
        }
        outPos[v * 3] = x
        outPos[v * 3 + 1] = y
        outPos[v * 3 + 2] = z
      }
      // Skinned positions are in model/world space after palette multiply.
      // Convert back into mesh-local so the existing node matrix stays valid.
      const nodeIndex = json.nodes.indexOf(node)
      const mw = world[nodeIndex]
      const inv = invertMat4(mw)
      for (let v = 0; v < outPos.length; v += 3) {
        const p = transformPoint(inv, outPos[v], outPos[v + 1], outPos[v + 2])
        outPos[v] = p[0]
        outPos[v + 1] = p[1]
        outPos[v + 2] = p[2]
      }
      const posView = addView(outPos)
      const posAccessor = {
        bufferView: posView,
        componentType: 5126,
        count: outPos.length / 3,
        type: 'VEC3',
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      }
      for (let i = 0; i < outPos.length; i += 3) {
        for (let k = 0; k < 3; k += 1) {
          if (outPos[i + k] < posAccessor.min[k]) posAccessor.min[k] = outPos[i + k]
          if (outPos[i + k] > posAccessor.max[k]) posAccessor.max[k] = outPos[i + k]
        }
      }
      prim.attributes.POSITION = json.accessors.length
      json.accessors.push(posAccessor)

      if (Number.isInteger(prim.attributes.NORMAL)) {
        const nor = Float32Array.from(accessorArray(json, bin, prim.attributes.NORMAL))
        const outNor = new Float32Array(nor.length)
        for (let v = 0; v < nor.length / 3; v += 1) {
          let x = 0
          let y = 0
          let z = 0
          for (let k = 0; k < Math.min(4, jointComps, weightComps); k += 1) {
            const w = weights[v * weightComps + k]
            if (!(w > 0)) continue
            const joint = joints[v * jointComps + k]
            const m = palette[joint]
            if (!m) continue
            const d = transformDirection(m, nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2])
            x += d[0] * w
            y += d[1] * w
            z += d[2] * w
          }
          const len = Math.hypot(x, y, z) || 1
          const d = transformDirection(inv, x / len, y / len, z / len)
          outNor[v * 3] = d[0]
          outNor[v * 3 + 1] = d[1]
          outNor[v * 3 + 2] = d[2]
        }
        const norView = addView(outNor)
        prim.attributes.NORMAL = json.accessors.length
        json.accessors.push({
          bufferView: norView,
          componentType: 5126,
          count: outNor.length / 3,
          type: 'VEC3',
        })
      }
      delete prim.attributes.JOINTS_0
      delete prim.attributes.WEIGHTS_0
      delete prim.attributes.JOINTS_1
      delete prim.attributes.WEIGHTS_1
    }
    delete node.skin
    delete node.skeleton
  }
  delete json.skins
  for (const node of json.nodes) {
    delete node.skin
    delete node.skeleton
  }
  json.buffers = [{ byteLength: length }]
  return Buffer.concat(chunks)
}

function invertMat4(m) {
  // Affine inverse for node matrices (rotation/scale + translation).
  const r00 = m[0]; const r01 = m[1]; const r02 = m[2]
  const r10 = m[4]; const r11 = m[5]; const r12 = m[6]
  const r20 = m[8]; const r21 = m[9]; const r22 = m[10]
  const det = r00 * (r11 * r22 - r12 * r21) - r01 * (r10 * r22 - r12 * r20) + r02 * (r10 * r21 - r11 * r20)
  const invDet = 1 / (det || 1)
  const i00 = (r11 * r22 - r12 * r21) * invDet
  const i01 = (r02 * r21 - r01 * r22) * invDet
  const i02 = (r01 * r12 - r02 * r11) * invDet
  const i10 = (r12 * r20 - r10 * r22) * invDet
  const i11 = (r00 * r22 - r02 * r20) * invDet
  const i12 = (r02 * r10 - r00 * r12) * invDet
  const i20 = (r10 * r21 - r11 * r20) * invDet
  const i21 = (r01 * r20 - r00 * r21) * invDet
  const i22 = (r00 * r11 - r01 * r10) * invDet
  const tx = m[12]; const ty = m[13]; const tz = m[14]
  return [
    i00, i01, i02, 0,
    i10, i11, i12, 0,
    i20, i21, i22, 0,
    -(i00 * tx + i10 * ty + i20 * tz),
    -(i01 * tx + i11 * ty + i21 * tz),
    -(i02 * tx + i12 * ty + i22 * tz),
    1,
  ]
}

function parseArgs(argv) {
  const [src, out] = argv
  const options = {
    src, out, maxTexture: 1024, quality: 82, keepNormalMaps: false, keepSkin: false, decimateGrid: 0,
  }
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--max-texture') options.maxTexture = Number(argv[i + 1])
    else if (argv[i] === '--quality') options.quality = Number(argv[i + 1])
    else if (argv[i] === '--keep-normal-maps') options.keepNormalMaps = true
    else if (argv[i] === '--keep-skin') options.keepSkin = true
    else if (argv[i] === '--decimate-grid') options.decimateGrid = Number(argv[i + 1])
  }
  return options
}

/** Uniform-grid decimation that keeps UVs — same idea as bake-humanoid-glb. */
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

function decimateWelded(welded, gridCells) {
  const pos = welded.attributes.find(({ name }) => name === 'POSITION')
  const nor = welded.attributes.find(({ name }) => name === 'NORMAL')
  const uv = welded.attributes.find(({ name }) => name === 'TEXCOORD_0')
  const indices = welded.indices instanceof Uint16Array
    ? Uint32Array.from(welded.indices)
    : welded.indices
  const decimated = clusterDecimate({
    positions: pos.data,
    normals: nor?.data || new Float32Array(pos.data.length),
    uvs: uv?.data || null,
    indices,
  }, gridCells)
  const attributes = [{ name: 'POSITION', comps: 3, data: decimated.positions }]
  if (nor) attributes.push({ name: 'NORMAL', comps: 3, data: decimated.normals })
  if (uv && decimated.uvs) attributes.push({ name: 'TEXCOORD_0', comps: 2, data: decimated.uvs })
  const vertexCount = decimated.positions.length / 3
  return {
    attributes,
    indices: vertexCount < 65536 ? Uint16Array.from(decimated.indices) : decimated.indices,
    vertexCount,
    sourceCount: welded.sourceCount,
  }
}

/** Texture slots each material keeps, in the order they are re-indexed. */
function materialTextures(material, keepNormalMaps) {
  const slots = []
  const pbr = material.pbrMetallicRoughness || {}
  if (pbr.baseColorTexture) slots.push(pbr.baseColorTexture)
  if (pbr.metallicRoughnessTexture) slots.push(pbr.metallicRoughnessTexture)
  if (material.emissiveTexture) slots.push(material.emissiveTexture)
  if (keepNormalMaps && material.normalTexture) slots.push(material.normalTexture)
  return slots
}

function stripMaterial(material, keepNormalMaps) {
  const out = structuredClone(material)
  if (!keepNormalMaps) delete out.normalTexture
  delete out.occlusionTexture
  const pbr = out.pbrMetallicRoughness || (out.pbrMetallicRoughness = {})
  // Sketchfab often packs a metal-rough map that washes albedo to chrome/white
  // under ACES Filmic — drop it and force a matte painted look.
  delete pbr.metallicRoughnessTexture
  pbr.metallicFactor = 0
  pbr.roughnessFactor = Math.max(Number(pbr.roughnessFactor) || 0, 0.82)
  return out
}

/** UV sets each material still samples — a primitive drops all the others. */
function usedTexCoords(json, keepNormalMaps) {
  return (json.materials || []).map((material) => new Set(
    materialTextures(material, keepNormalMaps).map((slot) => `TEXCOORD_${slot.texCoord || 0}`),
  ))
}

function weldPrimitive(json, bin, prim, attributeNames) {
  const sources = attributeNames.map((name) => ({
    name,
    comps: VEC_OF[name],
    data: accessorArray(json, bin, prim.attributes[name]),
  }))
  const indices = Number.isInteger(prim.indices)
    ? accessorArray(json, bin, prim.indices)
    : Uint32Array.from({ length: sources[0].data.length / sources[0].comps }, (_, i) => i)

  const map = new Map()
  const out = sources.map(() => [])
  const outIndices = new Uint32Array(indices.length)
  for (let i = 0; i < indices.length; i += 1) {
    const v = indices[i]
    const key = sources
      .map(({ data, comps }) => {
        let part = ''
        for (let k = 0; k < comps; k += 1) part += `${Math.round(data[v * comps + k] * 1e4)},`
        return part
      })
      .join('|')
    let target = map.get(key)
    if (target === undefined) {
      target = out[0].length / sources[0].comps
      map.set(key, target)
      sources.forEach(({ data, comps }, s) => {
        for (let k = 0; k < comps; k += 1) out[s].push(data[v * comps + k])
      })
    }
    outIndices[i] = target
  }
  const vertexCount = out[0].length / sources[0].comps
  return {
    attributes: sources.map(({ name, comps }, s) => ({
      name,
      comps,
      data: Float32Array.from(out[s]),
    })),
    indices: vertexCount < 65536 ? Uint16Array.from(outIndices) : outIndices,
    vertexCount,
    sourceCount: sources[0].data.length / sources[0].comps,
  }
}

async function encodeImage(bytes, { maxTexture, quality }) {
  const image = sharp(bytes)
  const meta = await image.metadata()
  const size = Math.min(maxTexture, Math.max(meta.width, meta.height))
  return {
    data: await image
      .resize(size, size, { fit: 'fill' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer(),
    from: `${meta.width}x${meta.height}`,
    to: `${size}x${size}`,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options.src || !options.out) {
    console.error('usage: node scripts/bake-prop-glb.mjs <src.glb> <out.glb> [--max-texture n] [--quality n] [--keep-normal-maps] [--keep-skin] [--decimate-grid n]')
    process.exit(1)
  }
  let { json, bin } = readGlb(options.src)
  if (json.skins?.length && !options.keepSkin) {
    bin = bakeRestPoseSkins(json, bin)
    console.log(`  baked rest-pose skinning (${json.nodes.filter((n) => n.mesh != null).length} mesh nodes)`)
  } else if (json.skins?.length && options.keepSkin) {
    console.log(`  keeping skeleton + skin (${json.skins.length} skin(s))`)
  }
  const keepUv = usedTexCoords(json, options.keepNormalMaps)

  const outJson = {
    asset: { version: '2.0', generator: 'MathsMine3 bake-prop-glb', extras: creditExtras(json) },
    scene: json.scene || 0,
    scenes: structuredClone(json.scenes),
    nodes: structuredClone(json.nodes),
    // Drop material extensions: remapped texture indices leave specular/clearcoat
    // pointing at holes, and Three's GLTFLoader then aborts the whole load.
    materials: (json.materials || []).map((material) => {
      const stripped = stripMaterial(material, options.keepNormalMaps)
      delete stripped.extensions
      delete stripped.extras
      return stripped
    }),
    samplers: structuredClone(json.samplers) || [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    meshes: [],
    textures: [],
    images: [],
  }
  // Do not copy extensionsUsed — we stripped material extensions above.

  // Re-index the textures each surviving material still points at.
  const textureRemap = new Map()
  const keptImages = []
  for (const material of outJson.materials) {
    for (const slot of materialTextures(material, options.keepNormalMaps)) {
      if (!textureRemap.has(slot.index)) {
        const source = json.textures[slot.index].source
        textureRemap.set(slot.index, outJson.textures.length)
        outJson.textures.push({ sampler: 0, source: keptImages.length })
        keptImages.push(source)
      }
      slot.index = textureRemap.get(slot.index)
    }
  }

  const builder = new GlbBuilder(outJson)
  const meshRemap = new Map()
  let sourceVerts = 0
  let bakedVerts = 0
  for (let i = 0; i < json.meshes.length; i += 1) {
    const mesh = json.meshes[i]
    const primitives = []
    const signature = []
    let meshVerts = 0
    for (const prim of mesh.primitives) {
      const materialUv = keepUv[prim.material] || new Set()
      const attributeNames = Object.keys(prim.attributes)
        .filter((name) => VEC_OF[name] && (!name.startsWith('TEXCOORD') || materialUv.has(name)))
        .sort((a, b) => a.localeCompare(b))
      const welded = weldPrimitive(json, bin, prim, attributeNames)
      const baked = options.decimateGrid > 0 && welded.vertexCount > 40000
        ? decimateWelded(welded, options.decimateGrid)
        : welded
      sourceVerts += baked.sourceCount
      meshVerts += baked.vertexCount
      const attributes = {}
      for (const attribute of baked.attributes) {
        attributes[attribute.name] = builder.addAccessor(
          attribute.data,
          attribute.comps === 2 ? 'VEC2' : attribute.comps === 4 ? 'VEC4' : 'VEC3',
          { target: ARRAY_BUFFER, minMax: attribute.name === 'POSITION' },
        )
      }
      primitives.push({
        attributes,
        indices: builder.addAccessor(baked.indices, 'SCALAR', { target: ELEMENT_ARRAY_BUFFER }),
        material: prim.material,
      })
      // Content hash for deduping identical parts — not a security boundary,
      // but sha256 keeps the scanners quiet.
      signature.push(createHash('sha256')
        .update(Buffer.from(welded.attributes[0].data.buffer))
        .update(String(prim.material))
        .digest('hex'))
    }
    // Repeated parts (four identical wheels) collapse to one mesh with four nodes.
    const key = signature.join('|')
    if (meshRemap.has(key)) {
      meshRemap.set(i, meshRemap.get(key))
      continue
    }
    outJson.meshes.push({ name: mesh.name, primitives })
    bakedVerts += meshVerts
    meshRemap.set(key, outJson.meshes.length - 1)
    meshRemap.set(i, outJson.meshes.length - 1)
  }
  for (const node of outJson.nodes) {
    if (Number.isInteger(node.mesh)) node.mesh = meshRemap.get(node.mesh)
    if (options.keepSkin && json.skins?.length) continue
    // Ready-Player / Sketchfab props often tag static meshes with `skin: 0`
    // without shipping a skins array — Three's loader then crashes on load.
    delete node.skin
    delete node.skeleton
  }

  if (options.keepSkin && json.skins?.length) {
    outJson.skins = structuredClone(json.skins)
  }

  const report = []
  for (const source of keptImages) {
    const encoded = await encodeImage(bufferViewBytes(json, bin, json.images[source].bufferView), options)
    outJson.images.push({ mimeType: 'image/jpeg', bufferView: builder.addBufferView(encoded.data) })
    report.push(`${encoded.from}→${encoded.to} ${(encoded.data.length / 1024).toFixed(0)} KB`)
  }

  writeGlb(options.out, outJson, builder.finish())
  console.log(`${options.src} → ${options.out}`)
  console.log(`  meshes ${json.meshes.length} → ${outJson.meshes.length}, verts ${sourceVerts} → ${bakedVerts}`)
  console.log(`  textures ${(json.images || []).length} → ${outJson.images.length}: ${report.join(', ') || 'none'}`)
  console.log(`  size ${(statSync(options.src).size / 1024 / 1024).toFixed(1)} MB → ${(statSync(options.out).size / 1024).toFixed(0)} KB`)
}

main()
