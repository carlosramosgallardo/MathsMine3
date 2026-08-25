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
 *   ... [--max-texture 1024] [--quality 82] [--keep-normal-maps]
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
} from './lib/glb-io.mjs'

const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963
const VEC_OF = { POSITION: 3, NORMAL: 3, TEXCOORD_0: 2, TEXCOORD_1: 2, COLOR_0: 4 }

function parseArgs(argv) {
  const [src, out] = argv
  const options = { src, out, maxTexture: 1024, quality: 82, keepNormalMaps: false }
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--max-texture') options.maxTexture = Number(argv[i + 1])
    else if (argv[i] === '--quality') options.quality = Number(argv[i + 1])
    else if (argv[i] === '--keep-normal-maps') options.keepNormalMaps = true
  }
  return options
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
    console.error('usage: node scripts/bake-prop-glb.mjs <src.glb> <out.glb> [--max-texture n] [--quality n] [--keep-normal-maps]')
    process.exit(1)
  }
  const { json, bin } = readGlb(options.src)
  const keepUv = usedTexCoords(json, options.keepNormalMaps)

  const outJson = {
    asset: { version: '2.0', generator: 'MathsMine3 bake-prop-glb', extras: creditExtras(json) },
    scene: json.scene || 0,
    scenes: structuredClone(json.scenes),
    nodes: structuredClone(json.nodes),
    materials: (json.materials || []).map((material) => stripMaterial(material, options.keepNormalMaps)),
    samplers: structuredClone(json.samplers) || [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    meshes: [],
    textures: [],
    images: [],
  }
  if (json.extensionsUsed) outJson.extensionsUsed = structuredClone(json.extensionsUsed)

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
      sourceVerts += welded.sourceCount
      meshVerts += welded.vertexCount
      const attributes = {}
      for (const attribute of welded.attributes) {
        attributes[attribute.name] = builder.addAccessor(
          attribute.data,
          attribute.comps === 2 ? 'VEC2' : attribute.comps === 4 ? 'VEC4' : 'VEC3',
          { target: ARRAY_BUFFER, minMax: attribute.name === 'POSITION' },
        )
      }
      primitives.push({
        attributes,
        indices: builder.addAccessor(welded.indices, 'SCALAR', { target: ELEMENT_ARRAY_BUFFER }),
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
