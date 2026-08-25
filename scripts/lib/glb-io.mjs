/**
 * Minimal glTF-binary reader/writer for the offline model bake scripts.
 *
 * The game only ships baked GLBs, so this stays dependency-free: enough of the
 * spec to read Sketchfab downloads (node matrices, accessors, embedded images)
 * and to emit a single-buffer GLB again.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

export const COMPONENT_TYPES = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
}

export const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

export const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

export function readGlb(file) {
  const buf = readFileSync(file)
  if (buf.readUInt32LE(0) !== MAGIC) throw new Error(`${file}: not a GLB`)
  let offset = 12
  let json = null
  let bin = null
  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset)
    const type = buf.readUInt32LE(offset + 4)
    const body = buf.subarray(offset + 8, offset + 8 + length)
    if (type === JSON_CHUNK) json = JSON.parse(body.toString('utf8'))
    else if (type === BIN_CHUNK) bin = body
    offset += 8 + length + ((4 - (length % 4)) % 4)
  }
  if (!json) throw new Error(`${file}: no JSON chunk`)
  return { json, bin: bin || Buffer.alloc(0) }
}

export function writeGlb(file, json, bin) {
  const jsonBuf = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20)
  const binBuf = pad(Buffer.from(bin), 0)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(MAGIC, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8)
  const chunk = (length, type) => {
    const head = Buffer.alloc(8)
    head.writeUInt32LE(length, 0)
    head.writeUInt32LE(type, 4)
    return head
  }
  writeFileSync(file, Buffer.concat([
    header,
    chunk(jsonBuf.length, JSON_CHUNK), jsonBuf,
    chunk(binBuf.length, BIN_CHUNK), binBuf,
  ]))
  return 12 + 8 + jsonBuf.length + 8 + binBuf.length
}

function pad(buf, fill) {
  const extra = (4 - (buf.length % 4)) % 4
  return extra ? Buffer.concat([buf, Buffer.alloc(extra, fill)]) : buf
}

/** Typed view over an accessor. Sparse and strided accessors are not supported. */
export function accessorArray(json, bin, index) {
  const acc = json.accessors[index]
  const Ctor = COMPONENT_TYPES[acc.componentType]
  const comps = TYPE_COMPONENTS[acc.type]
  if (!Number.isInteger(acc.bufferView)) return new Ctor(acc.count * comps)
  const view = json.bufferViews[acc.bufferView]
  if (view.byteStride && view.byteStride !== comps * Ctor.BYTES_PER_ELEMENT) {
    throw new Error('strided accessors are not supported')
  }
  const start = bin.byteOffset + (view.byteOffset || 0) + (acc.byteOffset || 0)
  return new Ctor(bin.buffer, start, acc.count * comps)
}

export function bufferViewBytes(json, bin, index) {
  const view = json.bufferViews[index]
  const start = (view.byteOffset || 0)
  return bin.subarray(start, start + view.byteLength)
}

export function multiply(a, b) {
  const out = new Array(16).fill(0)
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let sum = 0
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + r] * b[c * 4 + k]
      out[c * 4 + r] = sum
    }
  }
  return out
}

export function nodeMatrix(node) {
  if (node.matrix) return node.matrix.slice()
  const [tx, ty, tz] = node.translation || [0, 0, 0]
  const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale || [1, 1, 1]
  const x2 = qx + qx; const y2 = qy + qy; const z2 = qz + qz
  const xx = qx * x2; const xy = qx * y2; const xz = qx * z2
  const yy = qy * y2; const yz = qy * z2; const zz = qz * z2
  const wx = qw * x2; const wy = qw * y2; const wz = qw * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

export function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ]
}

/** Direction transform: rotation/scale only, renormalised (uniform-scale sources). */
export function transformDirection(m, x, y, z) {
  const out = [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ]
  const len = Math.hypot(out[0], out[1], out[2]) || 1
  return [out[0] / len, out[1] / len, out[2] / len]
}

/** Flat list of `{ prim, world, name }` for the default scene, in draw order. */
export function collectPrimitives(json) {
  const out = []
  const walk = (nodeIndex, parent) => {
    const node = json.nodes[nodeIndex]
    const world = multiply(parent, nodeMatrix(node))
    if (Number.isInteger(node.mesh)) {
      const mesh = json.meshes[node.mesh]
      for (const prim of mesh.primitives || []) {
        out.push({ prim, world, name: mesh.name || node.name || `mesh${node.mesh}` })
      }
    }
    for (const child of node.children || []) walk(child, world)
  }
  for (const root of json.scenes[json.scene || 0].nodes) walk(root, IDENTITY)
  return out
}

/** Every world-space vertex of the default scene, packed xyz. */
export function worldPositions(json, bin) {
  const prims = collectPrimitives(json)
  let total = 0
  for (const { prim } of prims) total += json.accessors[prim.attributes.POSITION].count
  const out = new Float32Array(total * 3)
  let w = 0
  for (const { prim, world } of prims) {
    const pos = accessorArray(json, bin, prim.attributes.POSITION)
    for (let i = 0; i < pos.length; i += 3) {
      const p = transformPoint(world, pos[i], pos[i + 1], pos[i + 2])
      out[w] = p[0]; out[w + 1] = p[1]; out[w + 2] = p[2]
      w += 3
    }
  }
  return out
}

export function boundsOf(packed) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < packed.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      const v = packed[i + k]
      if (v < min[k]) min[k] = v
      if (v > max[k]) max[k] = v
    }
  }
  return { min, max }
}

const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963

/** RGB floats → RGBA bytes for glTF COLOR_0 accessors. */
export function toUint8Colors(colors) {
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

/** Single vertex-coloured mesh GLB (sculpts + Milei plinth extract). */
export function buildVertexColorMeshGlb(mesh, {
  name,
  generator,
  extras,
  doubleSided = true,
} = {}) {
  const json = {
    asset: { version: '2.0', generator, extras },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    materials: [{
      name,
      doubleSided,
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

/** Accumulates typed arrays into one GLB buffer, emitting bufferViews/accessors. */
export class GlbBuilder {
  constructor(json) {
    this.json = json
    this.json.bufferViews = []
    this.json.accessors = []
    this.chunks = []
    this.length = 0
  }

  addBufferView(data, target) {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    const padding = (4 - (this.length % 4)) % 4
    if (padding) {
      this.chunks.push(Buffer.alloc(padding))
      this.length += padding
    }
    const view = { buffer: 0, byteOffset: this.length, byteLength: bytes.length }
    if (target) view.target = target
    this.chunks.push(bytes)
    this.length += bytes.length
    this.json.bufferViews.push(view)
    return this.json.bufferViews.length - 1
  }

  addAccessor(data, type, { target, normalized = false, minMax = false } = {}) {
    const comps = TYPE_COMPONENTS[type]
    const componentType = Object.keys(COMPONENT_TYPES)
      .find((key) => COMPONENT_TYPES[key] === data.constructor)
    const accessor = {
      bufferView: this.addBufferView(data, target),
      componentType: Number(componentType),
      count: data.length / comps,
      type,
    }
    if (normalized) accessor.normalized = true
    if (minMax) {
      const min = new Array(comps).fill(Infinity)
      const max = new Array(comps).fill(-Infinity)
      for (let i = 0; i < data.length; i += comps) {
        for (let k = 0; k < comps; k += 1) {
          if (data[i + k] < min[k]) min[k] = data[i + k]
          if (data[i + k] > max[k]) max[k] = data[i + k]
        }
      }
      accessor.min = min
      accessor.max = max
    }
    this.json.accessors.push(accessor)
    return this.json.accessors.length - 1
  }

  finish() {
    const bin = Buffer.concat(this.chunks)
    this.json.buffers = [{ byteLength: bin.length }]
    return bin
  }
}

/** Sketchfab stamps title/author/license on `asset.extras`; keep it on exports. */
export function creditExtras(json) {
  const extras = json.asset?.extras
  if (!extras) return undefined
  const { title, author, license, source } = extras
  return { title, author, license, source }
}
