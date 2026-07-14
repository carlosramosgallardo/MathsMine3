import { M1_MILEI_STATUE_ID, M1_MILEI_STATUE_POSITION } from './m1-milei-statue'
import { M1_ZELENSKY_STATUE_ID, M1_ZELENSKY_STATUE_POSITION } from './m1-zelensky-statue'
import { M2_MACRON_STATUE_ID, M2_MACRON_STATUE_POSITION } from './m2-macron-statue'

export const MINING_BOSS_STATUES = Object.freeze({
  [M1_MILEI_STATUE_ID]: Object.freeze({
    id: M1_MILEI_STATUE_ID,
    mapId: '1',
    row: M1_MILEI_STATUE_POSITION.row,
    col: M1_MILEI_STATUE_POSITION.col,
    gx: M1_MILEI_STATUE_POSITION.gx,
    gy: M1_MILEI_STATUE_POSITION.gy,
    interactRadius: 2.25,
    color: '#eab308',
    titleEn: "Milei's Tip",
    titleEs: 'Tip de Milei',
    tipEn: 'Take refuge from the disaster caused by the Dice Node! Get into the life recovery pool here in M1. Well... and if you want to invest in my crypto... call me, damn it!',
    tipEs: '¡Refugiate del desastre que provoca el Nodo del Dado! Metete en la piscina de recuperación de vida que tenés acá, en M1. Bueno... y si querés invertir en mi crypto... ¡llamame, carajo!',
    voiceUrl: '/voices/milei.mp3',
  }),
  [M1_ZELENSKY_STATUE_ID]: Object.freeze({
    id: M1_ZELENSKY_STATUE_ID,
    mapId: '1',
    row: M1_ZELENSKY_STATUE_POSITION.row,
    col: M1_ZELENSKY_STATUE_POSITION.col,
    gx: M1_ZELENSKY_STATUE_POSITION.gx,
    gy: M1_ZELENSKY_STATUE_POSITION.gy,
    interactRadius: 2.25,
    color: '#3b82f6',
    titleEn: "Zelensky's Tip",
    titleEs: 'Tip de Zelenski',
    tipEn: 'Find yourself good allies and form a pool. Between pool mates there is no friendly fire — it will help you progress... and protect you.',
    tipEs: 'Búscate buenos aliados y forma un pool. Entre compañeros de pool no existe el fuego amigo: te ayudará a progresar... y a protegerte.',
    voiceUrl: '/voices/zelenski.mp3',
  }),
  [M2_MACRON_STATUE_ID]: Object.freeze({
    id: M2_MACRON_STATUE_ID,
    mapId: '2',
    row: M2_MACRON_STATUE_POSITION.row,
    col: M2_MACRON_STATUE_POSITION.col,
    gx: M2_MACRON_STATUE_POSITION.gx,
    gy: M2_MACRON_STATUE_POSITION.gy,
    interactRadius: 2.25,
    color: '#2563eb',
    titleEn: "Macron's Tip",
    titleEs: 'Tip de Macron',
    tipEn: 'Still on foot, mon ami? Buy yourself a car at the RL Node in the coliseum, here in M2 — you will move twice as fast and jump twice as high. Voilà!',
    tipEs: '¿Todavía a pie, mon ami? Cómprate un coche en el Nodo RL del coliseo, aquí en M2: te moverás el doble de rápido y saltarás el doble de alto. Voilà!',
    voiceUrl: '/voices/macron.mp3',
  }),
})

export function getBossStatuesForMap(mapId) {
  return Object.values(MINING_BOSS_STATUES).filter((statue) => String(statue.mapId) === String(mapId))
}

export function getBossStatueById(id) {
  return MINING_BOSS_STATUES[id] || null
}

export function buildBossStatueFacingCell(statue) {
  if (!statue) return null
  return {
    isBossStatue: true,
    bossStatueId: statue.id,
    titleEn: statue.titleEn,
    titleEs: statue.titleEs,
    color: statue.color,
  }
}

/** Proximity + aim cone — same feel as portal nodes. */
export function resolveBossStatueFacing(mapId, gx, gy, angle) {
  const aimDx = Math.cos(angle)
  const aimDy = Math.sin(angle)
  let best = null
  for (const statue of getBossStatuesForMap(mapId)) {
    const radius = statue.interactRadius ?? 2.25
    const dist = Math.hypot(gx - statue.gx, gy - statue.gy)
    if (dist > radius) continue
    const toX = statue.gx - gx
    const toY = statue.gy - gy
    const facingDot = toX * aimDx + toY * aimDy
    if (dist > 0.55 && facingDot < 0.08) continue
    if (!best || dist < best.dist) {
      best = {
        statue,
        dist,
        mx: statue.col,
        my: statue.row,
        cell: buildBossStatueFacingCell(statue),
      }
    }
  }
  return best
}
