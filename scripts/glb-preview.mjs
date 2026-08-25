#!/usr/bin/env node
/**
 * Orthographic point-cloud previews of a GLB, written as PNGs.
 *
 * Lets the model bake be eyeballed (pose, facing, proportions, which half of a
 * scan is which) without opening a 3D app or a browser: every vertex is put in
 * world space and splatted on the front (x/y) and side (z/y) planes, shaded by
 * depth.
 *
 * Usage: node scripts/glb-preview.mjs public/models/man.glb .private/preview/man
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { readGlb, worldPositions, boundsOf } from './lib/glb-io.mjs'

const SIZE = 640
const BACKGROUND = 12

let crcTable = null
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c
    }
  }
  let c = -1
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return c ^ -1
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([len, body, crc])
}

function writePng(file, pixels, size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  let p = 0
  for (let y = 0; y < size; y += 1) {
    raw[p] = 0
    p += 1
    pixels.copy(raw, p, y * size * 3, (y + 1) * size * 3)
    p += size * 3
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]))
}

const VIEWS = [
  { name: 'front', across: 0, depth: 2 },
  { name: 'side', across: 2, depth: 0 },
]

/**
 * Splat `packed` xyz points into `<outBase>-front.png` / `-side.png`.
 * Red ticks on the left edge mark tenths of the height for reading off cuts.
 */
export function previewPoints(packed, outBase, { tint = [0, 0, 25] } = {}) {
  mkdirSync(path.dirname(outBase), { recursive: true })
  const { min, max } = boundsOf(packed)
  const span = (Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1) * 1.04
  const midY = (min[1] + max[1]) / 2
  for (const view of VIEWS) {
    const depth = new Float32Array(SIZE * SIZE).fill(-Infinity)
    const pixels = Buffer.alloc(SIZE * SIZE * 3, BACKGROUND)
    const across = view.across
    const mid = (min[across] + max[across]) / 2
    for (let i = 0; i < packed.length; i += 3) {
      const hx = (packed[i + across] - mid) / span + 0.5
      const hy = 0.5 - (packed[i + 1] - midY) / span
      const px = Math.round(hx * (SIZE - 1))
      const py = Math.round(hy * (SIZE - 1))
      if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue
      const idx = py * SIZE + px
      const d = packed[i + view.depth]
      if (d <= depth[idx]) continue
      depth[idx] = d
      const shade = 60 + Math.round(195 * (d - min[view.depth]) / ((max[view.depth] - min[view.depth]) || 1))
      pixels[idx * 3] = Math.min(255, shade + tint[0])
      pixels[idx * 3 + 1] = Math.min(255, shade + tint[1])
      pixels[idx * 3 + 2] = Math.min(255, shade + tint[2])
    }
    for (let tick = 1; tick < 10; tick += 1) {
      const y = Math.round((0.5 - (min[1] + (max[1] - min[1]) * (tick / 10) - midY) / span) * (SIZE - 1))
      if (y < 0 || y >= SIZE) continue
      for (let x = 0; x < 14; x += 1) {
        const i = (y * SIZE + x) * 3
        pixels[i] = 255; pixels[i + 1] = 90; pixels[i + 2] = 90
      }
    }
    writePng(`${outBase}-${view.name}.png`, pixels, SIZE)
  }
  return { min, max }
}

function main() {
  const [file, outBase] = process.argv.slice(2)
  if (!file || !outBase) {
    console.error('usage: node scripts/glb-preview.mjs <file.glb> <out-prefix>')
    process.exit(1)
  }
  const { json, bin } = readGlb(file)
  const packed = worldPositions(json, bin)
  const { min, max } = previewPoints(packed, outBase)
  console.log(`${file}: ${packed.length / 3} verts`)
  console.log(`  min ${min.map((v) => v.toFixed(3)).join(', ')}`)
  console.log(`  max ${max.map((v) => v.toFixed(3)).join(', ')}`)
  console.log(`  wrote ${outBase}-front.png / ${outBase}-side.png`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
