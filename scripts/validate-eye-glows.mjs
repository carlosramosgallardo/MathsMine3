#!/usr/bin/env node
/**
 * Offline eye-glow placement check — no Three GLTFLoader (Node has no DOM).
 * Samples each GLB with glb-io, applies the same yaw/crown plant as the game,
 * runs the face-band math from prop-eye-glows, and asserts eyes sit on the
 * face half of the skull (not the occiput).
 *
 * Usage: node scripts/validate-eye-glows.mjs
 */
import { readGlb, accessorArray, collectPrimitives } from './lib/glb-io.mjs'

const CROWN_Y = 1.075
const SRC_YMIN = 0
const SRC_YMAX = 1.895

function humanoidScale() {
  return CROWN_Y / (SRC_YMAX - SRC_YMIN)
}

/** Sample mesh verts into parent-local space after Ry(yaw) + optional crown plant. */
function samplePlanted(file, { yaw = Math.PI, mode = 'statue' } = {}) {
  const { json, bin } = readGlb(file)
  const raw = []
  for (const { prim } of collectPrimitives(json)) {
    const pos = accessorArray(json, bin, prim.attributes.POSITION)
    const step = Math.max(1, Math.floor(pos.length / 3 / 2500))
    for (let i = 0; i < pos.length; i += 3 * step) {
      raw.push({ x: pos[i], y: pos[i + 1], z: pos[i + 2] })
    }
  }
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  let pts = raw.map((p) => ({ x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }))

  if (mode === 'statue') {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
    }
    const scale = CROWN_Y / (maxY - minY)
    const ox = -(minX + maxX) * 0.5 * scale
    const oy = -minY * scale
    const oz = -(minZ + maxZ) * 0.5 * scale
    pts = pts.map((p) => ({ x: p.x * scale + ox, y: p.y * scale + oy, z: p.z * scale + oz }))
  } else {
    const scale = humanoidScale()
    pts = pts.map((p) => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale }))
  }
  return pts
}

/** Robust AABB: drop `trim` fraction of extremes per axis (not a copy of lib helper). */
function trimmedExtent(pts, trim = 0.05) {
  const axes = ['x', 'y', 'z']
  const out = { min: {}, max: {} }
  for (const axis of axes) {
    const sorted = pts.map((p) => p[axis]).sort((a, b) => a - b)
    const i0 = Math.floor(sorted.length * trim)
    const i1 = Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - trim)))
    out.min[axis] = sorted[i0]
    out.max[axis] = sorted[i1]
  }
  return out
}

function skullBand(pts, skullFrac = 0.18) {
  let minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const cut = maxY - (maxY - minY) * skullFrac
  return pts.filter((p) => p.y >= cut)
}

/** Expected eye centres for one skull band (faceSign −1 = −Z face). */
function expectedEyes(box, cfg) {
  const w = box.max.x - box.min.x
  const h = box.max.y - box.min.y
  const d = box.max.z - box.min.z
  const inset = Math.min(0.35, Math.max(0, cfg.forwardFrac))
  const faceZ = (cfg.faceSign ?? -1) < 0
    ? box.min.z + d * inset
    : box.max.z - d * inset
  const cx = (box.min.x + box.max.x) * 0.5
  const half = Math.max(0.014, w * (cfg.spacingFrac ?? 0.11))
  const ey = box.min.y + h * cfg.eyeLine
  const ez = faceZ + (cfg.zBias || 0)
  return [{ x: cx - half, y: ey, z: ez }, { x: cx + half, y: ey, z: ez }]
}

function assertOnFace(label, eyes, box, faceSign) {
  const depth = box.max.z - box.min.z
  const mid = (box.min.z + box.max.z) * 0.5
  const errors = []
  for (const e of eyes) {
    const onFace = faceSign < 0 ? e.z <= mid : e.z >= mid
    const near = faceSign < 0
      ? e.z <= box.min.z + depth * 0.30
      : e.z >= box.max.z - depth * 0.30
    if (!onFace || !near) {
      errors.push(
        `${label} z=${e.z.toFixed(3)} not on face (sign ${faceSign}, skull ${box.min.z.toFixed(3)}..${box.max.z.toFixed(3)})`,
      )
    }
  }
  return errors
}

const cases = [
  {
    name: 'putin',
    file: 'public/models/putin.glb',
    mode: 'statue',
    yaw: Math.PI,
    opts: { eyeLine: 0.52, faceSign: -1, forwardFrac: 0.04, skullFrac: 0.16 },
  },
  {
    name: 'kim',
    file: 'public/models/kim.glb',
    mode: 'statue',
    yaw: Math.PI / 2,
    opts: { eyeLine: 0.55, faceSign: -1, forwardFrac: 0.035, skullFrac: 0.14, spacingFrac: 0.10 },
  },
  {
    name: 'milei',
    file: 'public/models/milei-figure.glb',
    mode: 'quad',
    yaw: Math.PI,
    opts: { eyeLine: 0.64, faceSign: -1, forwardFrac: 0.04, skullFrac: 0.22, spacingFrac: 0.10 },
  },
  {
    name: 'man',
    file: 'public/models/man.glb',
    mode: 'humanoid',
    yaw: Math.PI,
    opts: { eyeLine: 0.52, faceSign: -1, forwardFrac: 0.04, skullFrac: 0.16, spacingFrac: 0.12 },
  },
  {
    name: 'zelenski',
    file: 'public/models/zelenski.glb',
    mode: 'statue',
    yaw: Math.PI,
    opts: { eyeLine: 0.48, faceSign: -1, forwardFrac: 0.045, skullFrac: 0.18 },
  },
  {
    name: 'macron',
    file: 'public/models/macron.glb',
    mode: 'statue',
    yaw: Math.PI,
    opts: { eyeLine: 0.48, faceSign: -1, forwardFrac: 0.045, skullFrac: 0.18 },
  },
  {
    name: 'trump+bibi',
    file: 'public/models/trump.glb',
    mode: 'quad',
    yaw: Math.PI,
    dual: true,
    bibi: { eyeLine: 0.58, faceSign: -1, forwardFrac: 0.05, spacingFrac: 0.06, skullFrac: 0.30, padPct: 0.08 },
    trump: { eyeLine: 0.34, faceSign: 1, forwardFrac: 0.05, spacingFrac: 0.07, skullFrac: 0.30, padPct: 0.08, zBias: 0.01 },
  },
]

let failed = 0
for (const c of cases) {
  const pts = samplePlanted(c.file, { yaw: c.yaw, mode: c.mode })
  const errors = []
  if (c.dual) {
    const skull = skullBand(pts, c.bibi.skullFrac)
    const box = trimmedExtent(skull, c.bibi.padPct || 0.05)
    const bibiEyes = expectedEyes(box, c.bibi)
    const trumpEyes = expectedEyes(box, c.trump)
    errors.push(...assertOnFace(`${c.name}/bibi`, bibiEyes, box, -1), ...assertOnFace(`${c.name}/trump`, trumpEyes, box, 1))
    if (!errors.length) {
      console.log(
        `OK   ${c.name}`,
        `bibi z=${bibiEyes[0].z.toFixed(3)}`,
        `trump z=${trumpEyes[0].z.toFixed(3)}`,
      )
    }
  } else {
    const skull = skullBand(pts, c.opts.skullFrac || 0.18)
    const box = trimmedExtent(skull, 0.05)
    const eyes = expectedEyes(box, c.opts)
    errors.push(...assertOnFace(c.name, eyes, box, c.opts.faceSign))
    if (!errors.length) {
      console.log(`OK   ${c.name}`, `z=${eyes[0].z.toFixed(3)} y=${eyes[0].y.toFixed(3)}`)
    }
  }
  if (errors.length) {
    failed += 1
    console.error(`FAIL ${c.name}`)
    for (const e of errors) console.error(' ', e)
  }
}

if (failed) {
  console.error(`\n${failed} case(s) failed`)
  process.exit(1)
}
console.log('\nAll eye placements on the face half of the skull.')
