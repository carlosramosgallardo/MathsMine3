/**
 * Amplify Trump/Bibi vertex colours so the crawl sculpt reads as vividly as
 * the textured bosses: warmer skin, brighter Trump blue suit, distinct Bibi
 * navy, punchier reds on the MAGA hat / tie.
 *
 * Mutates geometry colours in place (clone geometry before calling).
 * Always upgrades the colour buffer to Float32 — Uint8 COLOR_0 cannot hold the
 * lifted midtones (writes get truncated back to chalk/grey).
 */
export function vivifyTrumpBibiVertexColors(geometry, THREE = null) {
  const color = geometry?.getAttribute?.('color')
  const pos = geometry?.getAttribute?.('position')
  if (!color || !pos || color.count !== pos.count) return

  const n = color.count
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 1) {
    // COLOR_0 may be VEC3 or VEC4; getX/Y/Z always return 0..1 when normalized.
    out[i * 3] = color.getX(i)
    out[i * 3 + 1] = color.getY(i)
    out[i * 3 + 2] = color.getZ(i)
  }

  // Rider (Bibi) sits above ~0.95 in source units; crawler (Trump) below.
  const riderY = 0.92

  for (let i = 0; i < n; i += 1) {
    const y = pos.getY(i)
    let r = out[i * 3]
    let g = out[i * 3 + 1]
    let b = out[i * 3 + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max - min
    const mid = (r + g + b) / 3
    const warm = r - b

    const isRed = r > 0.28 && r > g * 1.2 && r > b * 1.2
    const isWhiteish = mid > 0.72 && sat < 0.2
    const isHairDark = max < 0.3 && sat < 0.14
    // Warm flesh — require a real warm bias so chalky grey suits stay suits.
    const isSkin = warm > 0.035 && r >= g * 0.9 && g >= b * 0.82
      && mid > 0.2 && mid < 0.95 && sat < 0.55
    // Flat / cool greys and baked blues → suit remap (by height).
    const isSuit = !isSkin && !isRed && !isWhiteish && !isHairDark && (
      sat < 0.16
      || (b >= r * 0.92 && b >= g * 0.88)
      || (sat < 0.25 && mid > 0.15 && mid < 0.8 && warm < 0.05)
    )

    if (isRed) {
      r = Math.min(1, 0.55 + r * 0.55)
      g = Math.min(1, g * 0.25 + 0.02)
      b = Math.min(1, b * 0.12)
    } else if (isWhiteish) {
      r = Math.min(1, 0.95)
      g = Math.min(1, 0.92)
      b = Math.min(1, 0.55 + mid * 0.2)
    } else if (isSkin) {
      if (y >= riderY) {
        // Bibi: cooler pale flesh
        r = Math.min(1, 0.55 + r * 0.55)
        g = Math.min(1, 0.42 + g * 0.45)
        b = Math.min(1, 0.35 + b * 0.35)
      } else {
        // Trump: orange-tan (reads next to Putin/Macron albedo)
        r = Math.min(1, 0.72 + r * 0.4)
        g = Math.min(1, 0.38 + g * 0.35)
        b = Math.min(1, 0.18 + b * 0.2)
      }
    } else if (isHairDark) {
      r = Math.min(1, 0.12 + r * 0.8)
      g = Math.min(1, 0.08 + g * 0.7)
      b = Math.min(1, 0.18 + b * 0.9)
    } else if (isSuit) {
      if (y >= riderY) {
        // Bibi: teal-navy — clearly different from Trump
        r = Math.min(1, 0.08 + mid * 0.12)
        g = Math.min(1, 0.32 + mid * 0.35)
        b = Math.min(1, 0.55 + mid * 0.4)
      } else {
        // Trump: vivid royal blue
        r = Math.min(1, 0.06 + mid * 0.15)
        g = Math.min(1, 0.28 + mid * 0.35)
        b = Math.min(1, 0.72 + mid * 0.35)
      }
    } else {
      r = Math.min(1, mid + (r - mid) * 2.1 + 0.06)
      g = Math.min(1, mid + (g - mid) * 2.1 + 0.03)
      b = Math.min(1, mid + (b - mid) * 2.1)
    }

    out[i * 3] = r
    out[i * 3 + 1] = g
    out[i * 3 + 2] = b
  }

  if (THREE?.Float32BufferAttribute) {
    const attr = new THREE.Float32BufferAttribute(out, 3)
    attr.needsUpdate = true
    geometry.setAttribute('color', attr)
    return
  }
  for (let i = 0; i < n; i += 1) {
    color.setXYZ(i, out[i * 3], out[i * 3 + 1], out[i * 3 + 2])
  }
  color.needsUpdate = true
}
