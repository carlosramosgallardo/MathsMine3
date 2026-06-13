'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { colorFromAddress } from '@/lib/wallet-colors'
import { MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS, gridToBlockHex } from '@/lib/mm3-block-chain'
import { groupPresenceEntries } from '@/lib/presence-display'

const ROWS = 56   // FPV world size — double the inner mining grid for free walking space
const COLS = 56
const C    = '#22d3ee'

const CELL_SIZE     = 40     // world units per grid cell — large for future in-cell building
const WORLD_W       = COLS * CELL_SIZE
const WORLD_H       = ROWS * CELL_SIZE
const STRIP_W       = 3
const FOV           = Math.PI * 0.43
const PROJ_DIST     = 0.72
const CAMERA_EYE_Z  = 0.68   // eye height above the surface the player stands on
const MAX_PITCH     = 1.08    // ~62deg: avoids projection collapse at extreme look angles
const MOVE_SPD      = 43     // world units / second (~1.1 cells/sec)
const SPRINT_SPD    = 67
const MOVE_ACCEL    = 11
const TURN_SPD      = 1.35   // radians / second
const DOOR_FRAC     = 0.45
const HORIZON_RATIO = 0.50
const PLAYER_R      = 0.20   // collision radius in grid units (1 unit = 1 cell)
const AVATAR_R      = 0.30
const DOOR_LO       = (1 - DOOR_FRAC) / 2   // 0.275
const DOOR_HI       = (1 + DOOR_FRAC) / 2   // 0.725
const FOOTSTEP_DIST = CELL_SIZE * 0.42       // footstep cadence
const SWING_DUR     = 340    // ms per pickaxe swing
const HITS_NEEDED   = 5      // swings to complete mining action
const INTERACT_DIST = 2.0    // grid cells — max distance for block interaction
const VISUAL_RANGE  = 18     // far plane in cells; physics still uses the full map
const TOP_RANGE     = 14     // elevated surfaces need a tighter LOD to avoid horizon noise
const RADAR_RANGE   = 18     // square local map using the same camera frustum
const CHAIN_NODE_ROW = 4     // fallback; runtime position comes from cellMap
const CHAIN_NODE_COL = 4
// Jump: a player can mount mining blocks, but structural walls stay impassable.
const JUMP_VZ   = 5.7        // jump impulse (grid units / second)
const GRAVITY_A = 13.5       // gravity (grid units / second²)
const BLOCK_TOP = 1.0        // interactive/mining block height in grid units
const OBSTACLE_TOP = 2.35    // above the maximum single-jump apex
const MAX_JUMPS = 1

// ── Decorative obstacles: solid walls, no doorways, not mineable ──────────────
// Five visual types: monolith (violet), pylon (teal), ruin (rust), steel wall, bunker
// Pure neutral grays — clearly "wall", nothing like the amber market blocks
const W_STONE = [122, 120, 118]   // neutral mid-gray
const W_SLATE = [85,  92, 105]    // blue-gray (cool)
const W_SAND  = [108, 106, 102]   // warm gray
const W_DARK  = [58,  62,  70]    // dark gray
const CHAIN_MATERIALS = [
  { kind:'hash',      base:[42,82,104],  glow:[34,211,238], label:'HASH WALL' },
  { kind:'ledger',    base:[96,78,48],   glow:[250,204,21], label:'LEDGER' },
  { kind:'consensus', base:[82,45,96],   glow:[217,70,239], label:'CONSENSUS' },
  { kind:'data',      base:[38,88,76],   glow:[45,212,191], label:'DATA NODE' },
]

function chainObstacle(key,data) {
  const [row,col]=key.split(',').map(Number)
  const material=CHAIN_MATERIALS[Math.abs((row*17+col*31+row*col*3)%CHAIN_MATERIALS.length)]
  return { ...data, ...material }
}

const OBSTACLE_MAP = new Map([
  // Outer wall segments — cool slate, form loose frame with gaps
  ['2,7',   { base:W_SLATE, label:'WALL' }],
  ['2,8',   { base:W_SLATE, label:'WALL' }],
  ['2,9',   { base:W_SLATE, label:'WALL' }],
  ['2,16',  { base:W_SLATE, label:'WALL' }],
  ['2,17',  { base:W_SLATE, label:'WALL' }],
  ['2,19',  { base:W_SLATE, label:'WALL' }],
  ['25,7',  { base:W_SLATE, label:'WALL' }],
  ['25,8',  { base:W_SLATE, label:'WALL' }],
  ['25,9',  { base:W_SLATE, label:'WALL' }],
  ['25,17', { base:W_SLATE, label:'WALL' }],
  ['25,18', { base:W_SLATE, label:'WALL' }],
  ['25,19', { base:W_SLATE, label:'WALL' }],
  ['7,2',   { base:W_SLATE, label:'WALL' }],
  ['8,2',   { base:W_SLATE, label:'WALL' }],
  ['9,2',   { base:W_SLATE, label:'WALL' }],
  ['17,2',  { base:W_SLATE, label:'WALL' }],
  ['18,2',  { base:W_SLATE, label:'WALL' }],
  ['19,2',  { base:W_SLATE, label:'WALL' }],
  ['7,25',  { base:W_SLATE, label:'WALL' }],
  ['8,25',  { base:W_SLATE, label:'WALL' }],
  ['9,25',  { base:W_SLATE, label:'WALL' }],
  ['17,25', { base:W_SLATE, label:'WALL' }],
  ['18,25', { base:W_SLATE, label:'WALL' }],
  ['19,25', { base:W_SLATE, label:'WALL' }],

  // Inner maze corridors — dark concrete
  ['8,10',  { base:W_DARK, label:'WALL' }],
  ['8,11',  { base:W_DARK, label:'WALL' }],
  ['8,16',  { base:W_DARK, label:'WALL' }],
  ['8,17',  { base:W_DARK, label:'WALL' }],
  ['19,10', { base:W_DARK, label:'WALL' }],
  ['19,11', { base:W_DARK, label:'WALL' }],
  ['19,16', { base:W_DARK, label:'WALL' }],
  ['19,17', { base:W_DARK, label:'WALL' }],
  ['10,8',  { base:W_DARK, label:'WALL' }],
  ['11,8',  { base:W_DARK, label:'WALL' }],
  ['16,8',  { base:W_DARK, label:'WALL' }],
  ['17,8',  { base:W_DARK, label:'WALL' }],
  ['10,19', { base:W_DARK, label:'WALL' }],
  ['11,19', { base:W_DARK, label:'WALL' }],
  ['16,19', { base:W_DARK, label:'WALL' }],
  ['17,19', { base:W_DARK, label:'WALL' }],

  // Mid-zone pocket walls — warm stone
  ['5,4',   { base:W_STONE, label:'WALL' }],
  ['5,22',  { base:W_STONE, label:'WALL' }],
  ['22,4',  { base:W_STONE, label:'WALL' }],
  ['22,22', { base:W_STONE, label:'WALL' }],
  ['11,11', { base:W_STONE, label:'WALL' }],
  ['11,16', { base:W_STONE, label:'WALL' }],
  ['16,11', { base:W_STONE, label:'WALL' }],
  ['16,16', { base:W_STONE, label:'WALL' }],

  // Sandstone singles — axial choke points
  ['4,13',  { base:W_SAND, label:'WALL' }],
  ['4,14',  { base:W_SAND, label:'WALL' }],
  ['23,13', { base:W_SAND, label:'WALL' }],
  ['23,14', { base:W_SAND, label:'WALL' }],
  ['13,4',  { base:W_SAND, label:'WALL' }],
  ['14,4',  { base:W_SAND, label:'WALL' }],
  ['13,23', { base:W_SAND, label:'WALL' }],
  ['14,23', { base:W_SAND, label:'WALL' }],
  ['10,14', { base:W_SAND, label:'WALL' }],
  ['14,9',  { base:W_SAND, label:'WALL' }],
  ['17,14', { base:W_SAND, label:'WALL' }],
  ['14,19', { base:W_SAND, label:'WALL' }],
  ['8,18',  { base:W_SAND, label:'WALL' }],
  ['19,9',  { base:W_SAND, label:'WALL' }],
  ['9,8',   { base:W_SAND, label:'WALL' }],
  ['20,21', { base:W_SAND, label:'WALL' }],

  // ─── Outer world labyrinth (rows 28-55, cols 28-55) ──────────────────────────
  // Entry gateway pillars (rows 29-30) — funnel from inner world into outer zone
  ['29,33',  { base:W_SLATE, label:'WALL' }],
  ['29,34',  { base:W_SLATE, label:'WALL' }],
  ['29,37',  { base:W_SLATE, label:'WALL' }],
  ['29,41',  { base:W_SLATE, label:'WALL' }],
  ['29,44',  { base:W_SLATE, label:'WALL' }],
  ['29,45',  { base:W_SLATE, label:'WALL' }],
  ['29,49',  { base:W_SLATE, label:'WALL' }],
  ['29,52',  { base:W_SLATE, label:'WALL' }],
  ['30,29',  { base:W_SLATE, label:'WALL' }],
  ['30,30',  { base:W_SLATE, label:'WALL' }],
  ['30,53',  { base:W_SLATE, label:'WALL' }],
  ['30,54',  { base:W_SLATE, label:'WALL' }],

  // West boundary spine — gaps at portal approach rows 38-40, 46-48, 52-54
  ['33,29',  { base:W_SLATE, label:'WALL' }],
  ['33,30',  { base:W_SLATE, label:'WALL' }],
  ['36,29',  { base:W_SLATE, label:'WALL' }],
  ['36,30',  { base:W_SLATE, label:'WALL' }],
  ['41,29',  { base:W_SLATE, label:'WALL' }],
  ['41,30',  { base:W_SLATE, label:'WALL' }],
  ['44,29',  { base:W_SLATE, label:'WALL' }],
  ['44,30',  { base:W_SLATE, label:'WALL' }],
  ['49,29',  { base:W_SLATE, label:'WALL' }],
  ['49,30',  { base:W_SLATE, label:'WALL' }],
  ['54,29',  { base:W_SLATE, label:'WALL' }],

  // East boundary spine — same gaps
  ['33,53',  { base:W_SLATE, label:'WALL' }],
  ['33,54',  { base:W_SLATE, label:'WALL' }],
  ['36,53',  { base:W_SLATE, label:'WALL' }],
  ['36,54',  { base:W_SLATE, label:'WALL' }],
  ['41,53',  { base:W_SLATE, label:'WALL' }],
  ['41,54',  { base:W_SLATE, label:'WALL' }],
  ['44,53',  { base:W_SLATE, label:'WALL' }],
  ['44,54',  { base:W_SLATE, label:'WALL' }],
  ['49,53',  { base:W_SLATE, label:'WALL' }],
  ['49,54',  { base:W_SLATE, label:'WALL' }],
  ['54,53',  { base:W_SLATE, label:'WALL' }],
  ['54,54',  { base:W_SLATE, label:'WALL' }],

  // South boundary pockets
  ['54,33',  { base:W_SLATE, label:'WALL' }],
  ['54,34',  { base:W_SLATE, label:'WALL' }],
  ['54,43',  { base:W_SLATE, label:'WALL' }],
  ['54,44',  { base:W_SLATE, label:'WALL' }],
  ['54,50',  { base:W_SLATE, label:'WALL' }],
  ['54,51',  { base:W_SLATE, label:'WALL' }],

  // Separator walls just below first portal row — create approach corridors
  ['32,34',  { base:W_DARK, label:'WALL' }],
  ['32,35',  { base:W_DARK, label:'WALL' }],
  ['32,36',  { base:W_DARK, label:'WALL' }],
  ['32,37',  { base:W_DARK, label:'WALL' }],
  ['32,41',  { base:W_DARK, label:'WALL' }],
  ['32,42',  { base:W_DARK, label:'WALL' }],
  ['32,43',  { base:W_DARK, label:'WALL' }],
  ['32,44',  { base:W_DARK, label:'WALL' }],
  ['32,49',  { base:W_DARK, label:'WALL' }],
  ['32,50',  { base:W_DARK, label:'WALL' }],
  ['32,51',  { base:W_DARK, label:'WALL' }],

  // Labyrinth — rows 34-37 (between first portal row and mid-zone)
  ['34,33',  { base:W_DARK, label:'WALL' }],
  ['34,34',  { base:W_DARK, label:'WALL' }],
  ['34,36',  { base:W_DARK, label:'WALL' }],
  ['34,37',  { base:W_DARK, label:'WALL' }],
  ['34,41',  { base:W_DARK, label:'WALL' }],
  ['34,42',  { base:W_DARK, label:'WALL' }],
  ['34,45',  { base:W_DARK, label:'WALL' }],
  ['34,46',  { base:W_DARK, label:'WALL' }],
  ['34,50',  { base:W_DARK, label:'WALL' }],
  ['34,51',  { base:W_DARK, label:'WALL' }],
  ['35,34',  { base:W_DARK, label:'WALL' }],
  ['35,35',  { base:W_DARK, label:'WALL' }],
  ['35,43',  { base:W_DARK, label:'WALL' }],
  ['35,44',  { base:W_DARK, label:'WALL' }],
  ['36,33',  { base:W_DARK, label:'WALL' }],
  ['36,34',  { base:W_DARK, label:'WALL' }],
  ['36,35',  { base:W_DARK, label:'WALL' }],
  ['36,37',  { base:W_DARK, label:'WALL' }],
  ['36,38',  { base:W_DARK, label:'WALL' }],
  ['36,43',  { base:W_DARK, label:'WALL' }],
  ['36,44',  { base:W_DARK, label:'WALL' }],
  ['36,45',  { base:W_DARK, label:'WALL' }],
  ['36,50',  { base:W_DARK, label:'WALL' }],
  ['36,51',  { base:W_DARK, label:'WALL' }],
  ['37,35',  { base:W_DARK, label:'WALL' }],
  ['37,36',  { base:W_DARK, label:'WALL' }],
  ['37,43',  { base:W_DARK, label:'WALL' }],
  ['37,44',  { base:W_DARK, label:'WALL' }],

  // Labyrinth — rows 40-44 (between second and third portal rows)
  // Row 40 skips cols 30-32 (portal 39,31), 38-40 (portal 39,39), 46-48 (portal 39,47)
  ['40,33',  { base:W_DARK, label:'WALL' }],
  ['40,34',  { base:W_DARK, label:'WALL' }],
  ['40,35',  { base:W_DARK, label:'WALL' }],
  ['40,37',  { base:W_DARK, label:'WALL' }],
  ['40,41',  { base:W_DARK, label:'WALL' }],
  ['40,42',  { base:W_DARK, label:'WALL' }],
  ['40,43',  { base:W_DARK, label:'WALL' }],
  ['40,45',  { base:W_DARK, label:'WALL' }],
  ['40,49',  { base:W_DARK, label:'WALL' }],
  ['40,50',  { base:W_DARK, label:'WALL' }],
  ['41,34',  { base:W_DARK, label:'WALL' }],
  ['41,35',  { base:W_DARK, label:'WALL' }],
  ['41,43',  { base:W_DARK, label:'WALL' }],
  ['41,44',  { base:W_DARK, label:'WALL' }],
  ['41,50',  { base:W_DARK, label:'WALL' }],
  ['41,51',  { base:W_DARK, label:'WALL' }],
  ['42,34',  { base:W_DARK, label:'WALL' }],
  ['42,35',  { base:W_DARK, label:'WALL' }],
  ['42,36',  { base:W_DARK, label:'WALL' }],
  ['42,43',  { base:W_DARK, label:'WALL' }],
  ['42,44',  { base:W_DARK, label:'WALL' }],
  ['42,50',  { base:W_DARK, label:'WALL' }],
  ['43,35',  { base:W_DARK, label:'WALL' }],
  ['43,36',  { base:W_DARK, label:'WALL' }],
  ['43,37',  { base:W_DARK, label:'WALL' }],
  ['43,43',  { base:W_DARK, label:'WALL' }],
  ['43,44',  { base:W_DARK, label:'WALL' }],
  ['43,45',  { base:W_DARK, label:'WALL' }],
  ['43,51',  { base:W_DARK, label:'WALL' }],
  ['43,52',  { base:W_DARK, label:'WALL' }],
  ['44,34',  { base:W_DARK, label:'WALL' }],
  ['44,35',  { base:W_DARK, label:'WALL' }],
  ['44,43',  { base:W_DARK, label:'WALL' }],
  ['44,44',  { base:W_DARK, label:'WALL' }],
  ['44,50',  { base:W_DARK, label:'WALL' }],
  ['44,51',  { base:W_DARK, label:'WALL' }],

  // Approach corridors toward third portal row and south zone
  // Row 46-48 skips cols 30-32 (47,31), 38-40 (47,39), 46-48 (47,47)
  ['45,34',  { base:W_STONE, label:'WALL' }],
  ['45,35',  { base:W_STONE, label:'WALL' }],
  ['45,43',  { base:W_STONE, label:'WALL' }],
  ['45,44',  { base:W_STONE, label:'WALL' }],
  ['45,50',  { base:W_STONE, label:'WALL' }],
  ['45,51',  { base:W_STONE, label:'WALL' }],
  ['48,33',  { base:W_STONE, label:'WALL' }],
  ['48,34',  { base:W_STONE, label:'WALL' }],
  ['48,43',  { base:W_STONE, label:'WALL' }],
  ['48,44',  { base:W_STONE, label:'WALL' }],
  ['48,49',  { base:W_STONE, label:'WALL' }],
  ['48,50',  { base:W_STONE, label:'WALL' }],
  ['49,33',  { base:W_STONE, label:'WALL' }],
  ['49,34',  { base:W_STONE, label:'WALL' }],
  ['49,41',  { base:W_STONE, label:'WALL' }],
  ['49,42',  { base:W_STONE, label:'WALL' }],
  ['49,43',  { base:W_STONE, label:'WALL' }],
  ['49,50',  { base:W_STONE, label:'WALL' }],
  ['49,51',  { base:W_STONE, label:'WALL' }],

  // South mystery zone (rows 51-54)
  // Row 52-54 skips cols 30-32 (portal 53,31) and cols 38-40 (portal 53,39)
  ['51,33',  { base:W_STONE, label:'WALL' }],
  ['51,34',  { base:W_STONE, label:'WALL' }],
  ['51,36',  { base:W_STONE, label:'WALL' }],
  ['51,37',  { base:W_STONE, label:'WALL' }],
  ['51,41',  { base:W_STONE, label:'WALL' }],
  ['51,42',  { base:W_STONE, label:'WALL' }],
  ['51,44',  { base:W_STONE, label:'WALL' }],
  ['51,45',  { base:W_STONE, label:'WALL' }],
  ['51,50',  { base:W_STONE, label:'WALL' }],
  ['51,51',  { base:W_STONE, label:'WALL' }],

  // Scenic pillars — visual landmarks at each portal-row level
  ['31,34',  { base:W_SAND, label:'WALL' }],
  ['31,36',  { base:W_SAND, label:'WALL' }],
  ['31,44',  { base:W_SAND, label:'WALL' }],
  ['31,52',  { base:W_SAND, label:'WALL' }],
  ['39,34',  { base:W_SAND, label:'WALL' }],
  ['39,36',  { base:W_SAND, label:'WALL' }],
  ['39,44',  { base:W_SAND, label:'WALL' }],
  ['39,52',  { base:W_SAND, label:'WALL' }],
  ['47,34',  { base:W_SAND, label:'WALL' }],
  ['47,36',  { base:W_SAND, label:'WALL' }],
  ['47,44',  { base:W_SAND, label:'WALL' }],
  ['47,52',  { base:W_SAND, label:'WALL' }],
  ['53,33',  { base:W_SAND, label:'WALL' }],
  ['53,36',  { base:W_SAND, label:'WALL' }],
  ['53,42',  { base:W_SAND, label:'WALL' }],
  ['53,45',  { base:W_SAND, label:'WALL' }],
  ['53,50',  { base:W_SAND, label:'WALL' }],
  ['53,52',  { base:W_SAND, label:'WALL' }],

  // ─── Top-right sector (rows 0-27, cols 28-55) — Eastern Ruins ────────────────
  // Band 1 (rows 1-4)
  ['1,31',   { base:W_SLATE, label:'WALL' }],
  ['1,32',   { base:W_SLATE, label:'WALL' }],
  ['1,37',   { base:W_SLATE, label:'WALL' }],
  ['1,38',   { base:W_SLATE, label:'WALL' }],
  ['1,44',   { base:W_SLATE, label:'WALL' }],
  ['1,45',   { base:W_SLATE, label:'WALL' }],
  ['1,50',   { base:W_SLATE, label:'WALL' }],
  ['1,51',   { base:W_SLATE, label:'WALL' }],
  ['3,29',   { base:W_DARK, label:'WALL' }],
  ['3,30',   { base:W_DARK, label:'WALL' }],
  ['3,34',   { base:W_DARK, label:'WALL' }],
  ['3,35',   { base:W_DARK, label:'WALL' }],
  ['3,40',   { base:W_DARK, label:'WALL' }],
  ['3,41',   { base:W_DARK, label:'WALL' }],
  ['3,47',   { base:W_DARK, label:'WALL' }],
  ['3,48',   { base:W_DARK, label:'WALL' }],
  ['3,53',   { base:W_DARK, label:'WALL' }],
  ['3,54',   { base:W_DARK, label:'WALL' }],
  // Band 2 (rows 5-9)
  ['5,31',   { base:W_STONE, label:'WALL' }],
  ['5,32',   { base:W_STONE, label:'WALL' }],
  ['5,33',   { base:W_STONE, label:'WALL' }],
  ['5,38',   { base:W_STONE, label:'WALL' }],
  ['5,39',   { base:W_STONE, label:'WALL' }],
  ['5,44',   { base:W_STONE, label:'WALL' }],
  ['5,45',   { base:W_STONE, label:'WALL' }],
  ['5,46',   { base:W_STONE, label:'WALL' }],
  ['5,51',   { base:W_STONE, label:'WALL' }],
  ['5,52',   { base:W_STONE, label:'WALL' }],
  ['7,29',   { base:W_DARK, label:'WALL' }],
  ['7,30',   { base:W_DARK, label:'WALL' }],
  ['7,35',   { base:W_DARK, label:'WALL' }],
  ['7,36',   { base:W_DARK, label:'WALL' }],
  ['7,37',   { base:W_DARK, label:'WALL' }],
  ['7,42',   { base:W_DARK, label:'WALL' }],
  ['7,43',   { base:W_DARK, label:'WALL' }],
  ['7,49',   { base:W_DARK, label:'WALL' }],
  ['7,50',   { base:W_DARK, label:'WALL' }],
  ['7,54',   { base:W_DARK, label:'WALL' }],
  ['9,31',   { base:W_STONE, label:'WALL' }],
  ['9,32',   { base:W_STONE, label:'WALL' }],
  ['9,36',   { base:W_STONE, label:'WALL' }],
  ['9,37',   { base:W_STONE, label:'WALL' }],
  ['9,43',   { base:W_STONE, label:'WALL' }],
  ['9,44',   { base:W_STONE, label:'WALL' }],
  ['9,45',   { base:W_STONE, label:'WALL' }],
  ['9,50',   { base:W_STONE, label:'WALL' }],
  ['9,51',   { base:W_STONE, label:'WALL' }],
  // Band 3 (rows 10-14)
  ['10,29',  { base:W_DARK, label:'WALL' }],
  ['10,30',  { base:W_DARK, label:'WALL' }],
  ['10,34',  { base:W_DARK, label:'WALL' }],
  ['10,35',  { base:W_DARK, label:'WALL' }],
  ['10,40',  { base:W_DARK, label:'WALL' }],
  ['10,41',  { base:W_DARK, label:'WALL' }],
  ['10,47',  { base:W_DARK, label:'WALL' }],
  ['10,48',  { base:W_DARK, label:'WALL' }],
  ['10,53',  { base:W_DARK, label:'WALL' }],
  ['10,54',  { base:W_DARK, label:'WALL' }],
  ['12,31',  { base:W_STONE, label:'WALL' }],
  ['12,32',  { base:W_STONE, label:'WALL' }],
  ['12,33',  { base:W_STONE, label:'WALL' }],
  ['12,38',  { base:W_STONE, label:'WALL' }],
  ['12,39',  { base:W_STONE, label:'WALL' }],
  ['12,44',  { base:W_STONE, label:'WALL' }],
  ['12,45',  { base:W_STONE, label:'WALL' }],
  ['12,51',  { base:W_STONE, label:'WALL' }],
  ['12,52',  { base:W_STONE, label:'WALL' }],
  ['12,53',  { base:W_STONE, label:'WALL' }],
  ['14,30',  { base:W_DARK, label:'WALL' }],
  ['14,31',  { base:W_DARK, label:'WALL' }],
  ['14,36',  { base:W_DARK, label:'WALL' }],
  ['14,37',  { base:W_DARK, label:'WALL' }],
  ['14,42',  { base:W_DARK, label:'WALL' }],
  ['14,43',  { base:W_DARK, label:'WALL' }],
  ['14,44',  { base:W_DARK, label:'WALL' }],
  ['14,49',  { base:W_DARK, label:'WALL' }],
  ['14,50',  { base:W_DARK, label:'WALL' }],
  // Band 4 (rows 15-19)
  ['15,33',  { base:W_SLATE, label:'WALL' }],
  ['15,34',  { base:W_SLATE, label:'WALL' }],
  ['15,40',  { base:W_SLATE, label:'WALL' }],
  ['15,41',  { base:W_SLATE, label:'WALL' }],
  ['15,46',  { base:W_SLATE, label:'WALL' }],
  ['15,47',  { base:W_SLATE, label:'WALL' }],
  ['15,52',  { base:W_SLATE, label:'WALL' }],
  ['15,53',  { base:W_SLATE, label:'WALL' }],
  ['17,29',  { base:W_DARK, label:'WALL' }],
  ['17,30',  { base:W_DARK, label:'WALL' }],
  ['17,35',  { base:W_DARK, label:'WALL' }],
  ['17,36',  { base:W_DARK, label:'WALL' }],
  ['17,37',  { base:W_DARK, label:'WALL' }],
  ['17,43',  { base:W_DARK, label:'WALL' }],
  ['17,44',  { base:W_DARK, label:'WALL' }],
  ['17,50',  { base:W_DARK, label:'WALL' }],
  ['17,51',  { base:W_DARK, label:'WALL' }],
  ['19,32',  { base:W_STONE, label:'WALL' }],
  ['19,33',  { base:W_STONE, label:'WALL' }],
  ['19,38',  { base:W_STONE, label:'WALL' }],
  ['19,39',  { base:W_STONE, label:'WALL' }],
  ['19,40',  { base:W_STONE, label:'WALL' }],
  ['19,45',  { base:W_STONE, label:'WALL' }],
  ['19,46',  { base:W_STONE, label:'WALL' }],
  ['19,52',  { base:W_STONE, label:'WALL' }],
  ['19,53',  { base:W_STONE, label:'WALL' }],
  // Band 5 (rows 20-24)
  ['20,29',  { base:W_DARK, label:'WALL' }],
  ['20,30',  { base:W_DARK, label:'WALL' }],
  ['20,35',  { base:W_DARK, label:'WALL' }],
  ['20,36',  { base:W_DARK, label:'WALL' }],
  ['20,41',  { base:W_DARK, label:'WALL' }],
  ['20,42',  { base:W_DARK, label:'WALL' }],
  ['20,43',  { base:W_DARK, label:'WALL' }],
  ['20,48',  { base:W_DARK, label:'WALL' }],
  ['20,49',  { base:W_DARK, label:'WALL' }],
  ['20,53',  { base:W_DARK, label:'WALL' }],
  ['20,54',  { base:W_DARK, label:'WALL' }],
  ['22,31',  { base:W_STONE, label:'WALL' }],
  ['22,32',  { base:W_STONE, label:'WALL' }],
  ['22,37',  { base:W_STONE, label:'WALL' }],
  ['22,38',  { base:W_STONE, label:'WALL' }],
  ['22,44',  { base:W_STONE, label:'WALL' }],
  ['22,45',  { base:W_STONE, label:'WALL' }],
  ['22,50',  { base:W_STONE, label:'WALL' }],
  ['22,51',  { base:W_STONE, label:'WALL' }],
  ['22,52',  { base:W_STONE, label:'WALL' }],
  ['24,30',  { base:W_DARK, label:'WALL' }],
  ['24,31',  { base:W_DARK, label:'WALL' }],
  ['24,36',  { base:W_DARK, label:'WALL' }],
  ['24,37',  { base:W_DARK, label:'WALL' }],
  ['24,38',  { base:W_DARK, label:'WALL' }],
  ['24,43',  { base:W_DARK, label:'WALL' }],
  ['24,44',  { base:W_DARK, label:'WALL' }],
  ['24,50',  { base:W_DARK, label:'WALL' }],
  ['24,51',  { base:W_DARK, label:'WALL' }],
  // Band 6 (rows 25-27)
  ['25,32',  { base:W_SLATE, label:'WALL' }],
  ['25,33',  { base:W_SLATE, label:'WALL' }],
  ['25,39',  { base:W_SLATE, label:'WALL' }],
  ['25,40',  { base:W_SLATE, label:'WALL' }],
  ['25,46',  { base:W_SLATE, label:'WALL' }],
  ['25,47',  { base:W_SLATE, label:'WALL' }],
  ['25,53',  { base:W_SLATE, label:'WALL' }],
  ['25,54',  { base:W_SLATE, label:'WALL' }],
  ['26,29',  { base:W_STONE, label:'WALL' }],
  ['26,30',  { base:W_STONE, label:'WALL' }],
  ['26,35',  { base:W_STONE, label:'WALL' }],
  ['26,36',  { base:W_STONE, label:'WALL' }],
  ['26,42',  { base:W_STONE, label:'WALL' }],
  ['26,43',  { base:W_STONE, label:'WALL' }],
  ['26,49',  { base:W_STONE, label:'WALL' }],
  ['26,50',  { base:W_STONE, label:'WALL' }],

  // ─── Bottom-left sector (rows 28-55, cols 0-27) — Southern Passage ───────────
  // Band 1 (rows 29-33)
  ['29,2',   { base:W_SLATE, label:'WALL' }],
  ['29,3',   { base:W_SLATE, label:'WALL' }],
  ['29,7',   { base:W_SLATE, label:'WALL' }],
  ['29,8',   { base:W_SLATE, label:'WALL' }],
  ['29,13',  { base:W_SLATE, label:'WALL' }],
  ['29,14',  { base:W_SLATE, label:'WALL' }],
  ['29,19',  { base:W_SLATE, label:'WALL' }],
  ['29,20',  { base:W_SLATE, label:'WALL' }],
  ['29,24',  { base:W_SLATE, label:'WALL' }],
  ['29,25',  { base:W_SLATE, label:'WALL' }],
  ['31,4',   { base:W_DARK, label:'WALL' }],
  ['31,5',   { base:W_DARK, label:'WALL' }],
  ['31,10',  { base:W_DARK, label:'WALL' }],
  ['31,11',  { base:W_DARK, label:'WALL' }],
  ['31,16',  { base:W_DARK, label:'WALL' }],
  ['31,17',  { base:W_DARK, label:'WALL' }],
  ['31,22',  { base:W_DARK, label:'WALL' }],
  ['31,23',  { base:W_DARK, label:'WALL' }],
  ['33,2',   { base:W_STONE, label:'WALL' }],
  ['33,3',   { base:W_STONE, label:'WALL' }],
  ['33,7',   { base:W_STONE, label:'WALL' }],
  ['33,8',   { base:W_STONE, label:'WALL' }],
  ['33,9',   { base:W_STONE, label:'WALL' }],
  ['33,14',  { base:W_STONE, label:'WALL' }],
  ['33,15',  { base:W_STONE, label:'WALL' }],
  ['33,20',  { base:W_STONE, label:'WALL' }],
  ['33,21',  { base:W_STONE, label:'WALL' }],
  ['33,25',  { base:W_STONE, label:'WALL' }],
  ['33,26',  { base:W_STONE, label:'WALL' }],
  // Band 2 (rows 34-38)
  ['34,3',   { base:W_DARK, label:'WALL' }],
  ['34,4',   { base:W_DARK, label:'WALL' }],
  ['34,9',   { base:W_DARK, label:'WALL' }],
  ['34,10',  { base:W_DARK, label:'WALL' }],
  ['34,15',  { base:W_DARK, label:'WALL' }],
  ['34,16',  { base:W_DARK, label:'WALL' }],
  ['34,17',  { base:W_DARK, label:'WALL' }],
  ['34,22',  { base:W_DARK, label:'WALL' }],
  ['34,23',  { base:W_DARK, label:'WALL' }],
  ['36,2',   { base:W_STONE, label:'WALL' }],
  ['36,3',   { base:W_STONE, label:'WALL' }],
  ['36,4',   { base:W_STONE, label:'WALL' }],
  ['36,8',   { base:W_STONE, label:'WALL' }],
  ['36,9',   { base:W_STONE, label:'WALL' }],
  ['36,13',  { base:W_STONE, label:'WALL' }],
  ['36,14',  { base:W_STONE, label:'WALL' }],
  ['36,19',  { base:W_STONE, label:'WALL' }],
  ['36,20',  { base:W_STONE, label:'WALL' }],
  ['36,21',  { base:W_STONE, label:'WALL' }],
  ['36,25',  { base:W_STONE, label:'WALL' }],
  ['36,26',  { base:W_STONE, label:'WALL' }],
  ['38,3',   { base:W_DARK, label:'WALL' }],
  ['38,4',   { base:W_DARK, label:'WALL' }],
  ['38,9',   { base:W_DARK, label:'WALL' }],
  ['38,10',  { base:W_DARK, label:'WALL' }],
  ['38,11',  { base:W_DARK, label:'WALL' }],
  ['38,16',  { base:W_DARK, label:'WALL' }],
  ['38,17',  { base:W_DARK, label:'WALL' }],
  ['38,22',  { base:W_DARK, label:'WALL' }],
  ['38,23',  { base:W_DARK, label:'WALL' }],
  // Band 3 (rows 39-44)
  ['39,2',   { base:W_SLATE, label:'WALL' }],
  ['39,3',   { base:W_SLATE, label:'WALL' }],
  ['39,7',   { base:W_SLATE, label:'WALL' }],
  ['39,8',   { base:W_SLATE, label:'WALL' }],
  ['39,12',  { base:W_SLATE, label:'WALL' }],
  ['39,13',  { base:W_SLATE, label:'WALL' }],
  ['39,14',  { base:W_SLATE, label:'WALL' }],
  ['39,19',  { base:W_SLATE, label:'WALL' }],
  ['39,20',  { base:W_SLATE, label:'WALL' }],
  ['39,24',  { base:W_SLATE, label:'WALL' }],
  ['39,25',  { base:W_SLATE, label:'WALL' }],
  ['41,3',   { base:W_DARK, label:'WALL' }],
  ['41,4',   { base:W_DARK, label:'WALL' }],
  ['41,5',   { base:W_DARK, label:'WALL' }],
  ['41,10',  { base:W_DARK, label:'WALL' }],
  ['41,11',  { base:W_DARK, label:'WALL' }],
  ['41,15',  { base:W_DARK, label:'WALL' }],
  ['41,16',  { base:W_DARK, label:'WALL' }],
  ['41,21',  { base:W_DARK, label:'WALL' }],
  ['41,22',  { base:W_DARK, label:'WALL' }],
  ['41,23',  { base:W_DARK, label:'WALL' }],
  ['43,2',   { base:W_STONE, label:'WALL' }],
  ['43,3',   { base:W_STONE, label:'WALL' }],
  ['43,8',   { base:W_STONE, label:'WALL' }],
  ['43,9',   { base:W_STONE, label:'WALL' }],
  ['43,13',  { base:W_STONE, label:'WALL' }],
  ['43,14',  { base:W_STONE, label:'WALL' }],
  ['43,15',  { base:W_STONE, label:'WALL' }],
  ['43,20',  { base:W_STONE, label:'WALL' }],
  ['43,21',  { base:W_STONE, label:'WALL' }],
  ['43,25',  { base:W_STONE, label:'WALL' }],
  ['43,26',  { base:W_STONE, label:'WALL' }],
  // Band 4 (rows 45-50)
  ['45,3',   { base:W_DARK, label:'WALL' }],
  ['45,4',   { base:W_DARK, label:'WALL' }],
  ['45,9',   { base:W_DARK, label:'WALL' }],
  ['45,10',  { base:W_DARK, label:'WALL' }],
  ['45,11',  { base:W_DARK, label:'WALL' }],
  ['45,16',  { base:W_DARK, label:'WALL' }],
  ['45,17',  { base:W_DARK, label:'WALL' }],
  ['45,22',  { base:W_DARK, label:'WALL' }],
  ['45,23',  { base:W_DARK, label:'WALL' }],
  ['47,2',   { base:W_SLATE, label:'WALL' }],
  ['47,3',   { base:W_SLATE, label:'WALL' }],
  ['47,7',   { base:W_SLATE, label:'WALL' }],
  ['47,8',   { base:W_SLATE, label:'WALL' }],
  ['47,13',  { base:W_SLATE, label:'WALL' }],
  ['47,14',  { base:W_SLATE, label:'WALL' }],
  ['47,19',  { base:W_SLATE, label:'WALL' }],
  ['47,20',  { base:W_SLATE, label:'WALL' }],
  ['47,21',  { base:W_SLATE, label:'WALL' }],
  ['47,25',  { base:W_SLATE, label:'WALL' }],
  ['47,26',  { base:W_SLATE, label:'WALL' }],
  ['49,3',   { base:W_DARK, label:'WALL' }],
  ['49,4',   { base:W_DARK, label:'WALL' }],
  ['49,5',   { base:W_DARK, label:'WALL' }],
  ['49,10',  { base:W_DARK, label:'WALL' }],
  ['49,11',  { base:W_DARK, label:'WALL' }],
  ['49,16',  { base:W_DARK, label:'WALL' }],
  ['49,17',  { base:W_DARK, label:'WALL' }],
  ['49,18',  { base:W_DARK, label:'WALL' }],
  ['49,23',  { base:W_DARK, label:'WALL' }],
  ['49,24',  { base:W_DARK, label:'WALL' }],
  // Band 5 (rows 51-54)
  ['51,2',   { base:W_STONE, label:'WALL' }],
  ['51,3',   { base:W_STONE, label:'WALL' }],
  ['51,8',   { base:W_STONE, label:'WALL' }],
  ['51,9',   { base:W_STONE, label:'WALL' }],
  ['51,14',  { base:W_STONE, label:'WALL' }],
  ['51,15',  { base:W_STONE, label:'WALL' }],
  ['51,16',  { base:W_STONE, label:'WALL' }],
  ['51,21',  { base:W_STONE, label:'WALL' }],
  ['51,22',  { base:W_STONE, label:'WALL' }],
  ['51,26',  { base:W_STONE, label:'WALL' }],
  ['51,27',  { base:W_STONE, label:'WALL' }],
  ['53,2',   { base:W_DARK, label:'WALL' }],
  ['53,3',   { base:W_DARK, label:'WALL' }],
  ['53,4',   { base:W_DARK, label:'WALL' }],
  ['53,9',   { base:W_DARK, label:'WALL' }],
  ['53,10',  { base:W_DARK, label:'WALL' }],
  ['53,15',  { base:W_DARK, label:'WALL' }],
  ['53,16',  { base:W_DARK, label:'WALL' }],
  ['53,21',  { base:W_DARK, label:'WALL' }],
  ['53,22',  { base:W_DARK, label:'WALL' }],
  ['53,23',  { base:W_DARK, label:'WALL' }],
  ['54,5',   { base:W_SLATE, label:'WALL' }],
  ['54,6',   { base:W_SLATE, label:'WALL' }],
  ['54,11',  { base:W_SLATE, label:'WALL' }],
  ['54,12',  { base:W_SLATE, label:'WALL' }],
  ['54,17',  { base:W_SLATE, label:'WALL' }],
  ['54,18',  { base:W_SLATE, label:'WALL' }],
  ['54,24',  { base:W_SLATE, label:'WALL' }],
  ['54,25',  { base:W_SLATE, label:'WALL' }],

  // ─── Top-right sector — additional density fill ───────────────────────────────
  ['2,31',   { base:W_DARK,  label:'WALL' }],
  ['2,32',   { base:W_DARK,  label:'WALL' }],
  ['2,38',   { base:W_DARK,  label:'WALL' }],
  ['2,39',   { base:W_DARK,  label:'WALL' }],
  ['2,45',   { base:W_DARK,  label:'WALL' }],
  ['2,46',   { base:W_DARK,  label:'WALL' }],
  ['2,52',   { base:W_DARK,  label:'WALL' }],
  ['2,53',   { base:W_DARK,  label:'WALL' }],
  ['4,30',   { base:W_STONE, label:'WALL' }],
  ['4,31',   { base:W_STONE, label:'WALL' }],
  ['4,36',   { base:W_STONE, label:'WALL' }],
  ['4,37',   { base:W_STONE, label:'WALL' }],
  ['4,43',   { base:W_STONE, label:'WALL' }],
  ['4,44',   { base:W_STONE, label:'WALL' }],
  ['4,49',   { base:W_STONE, label:'WALL' }],
  ['4,50',   { base:W_STONE, label:'WALL' }],
  ['6,29',   { base:W_DARK,  label:'WALL' }],
  ['6,33',   { base:W_DARK,  label:'WALL' }],
  ['6,34',   { base:W_DARK,  label:'WALL' }],
  ['6,40',   { base:W_DARK,  label:'WALL' }],
  ['6,41',   { base:W_DARK,  label:'WALL' }],
  ['6,47',   { base:W_DARK,  label:'WALL' }],
  ['6,48',   { base:W_DARK,  label:'WALL' }],
  ['6,53',   { base:W_DARK,  label:'WALL' }],
  ['8,29',   { base:W_SLATE, label:'WALL' }],
  ['8,30',   { base:W_SLATE, label:'WALL' }],
  ['8,34',   { base:W_SLATE, label:'WALL' }],
  ['8,35',   { base:W_SLATE, label:'WALL' }],
  ['8,41',   { base:W_SLATE, label:'WALL' }],
  ['8,42',   { base:W_SLATE, label:'WALL' }],
  ['8,48',   { base:W_SLATE, label:'WALL' }],
  ['8,49',   { base:W_SLATE, label:'WALL' }],
  ['11,30',  { base:W_STONE, label:'WALL' }],
  ['11,31',  { base:W_STONE, label:'WALL' }],
  ['11,37',  { base:W_STONE, label:'WALL' }],
  ['11,38',  { base:W_STONE, label:'WALL' }],
  ['11,44',  { base:W_STONE, label:'WALL' }],
  ['11,45',  { base:W_STONE, label:'WALL' }],
  ['11,52',  { base:W_STONE, label:'WALL' }],
  ['11,53',  { base:W_STONE, label:'WALL' }],
  ['13,29',  { base:W_DARK,  label:'WALL' }],
  ['13,30',  { base:W_DARK,  label:'WALL' }],
  ['13,35',  { base:W_DARK,  label:'WALL' }],
  ['13,36',  { base:W_DARK,  label:'WALL' }],
  ['13,42',  { base:W_DARK,  label:'WALL' }],
  ['13,43',  { base:W_DARK,  label:'WALL' }],
  ['13,49',  { base:W_DARK,  label:'WALL' }],
  ['13,50',  { base:W_DARK,  label:'WALL' }],
  ['16,30',  { base:W_SLATE, label:'WALL' }],
  ['16,31',  { base:W_SLATE, label:'WALL' }],
  ['16,36',  { base:W_SLATE, label:'WALL' }],
  ['16,37',  { base:W_SLATE, label:'WALL' }],
  ['16,44',  { base:W_SLATE, label:'WALL' }],
  ['16,45',  { base:W_SLATE, label:'WALL' }],
  ['16,51',  { base:W_SLATE, label:'WALL' }],
  ['16,52',  { base:W_SLATE, label:'WALL' }],
  ['18,29',  { base:W_STONE, label:'WALL' }],
  ['18,30',  { base:W_STONE, label:'WALL' }],
  ['18,35',  { base:W_STONE, label:'WALL' }],
  ['18,36',  { base:W_STONE, label:'WALL' }],
  ['18,43',  { base:W_STONE, label:'WALL' }],
  ['18,44',  { base:W_STONE, label:'WALL' }],
  ['18,50',  { base:W_STONE, label:'WALL' }],
  ['18,51',  { base:W_STONE, label:'WALL' }],
  ['21,30',  { base:W_DARK,  label:'WALL' }],
  ['21,31',  { base:W_DARK,  label:'WALL' }],
  ['21,37',  { base:W_DARK,  label:'WALL' }],
  ['21,38',  { base:W_DARK,  label:'WALL' }],
  ['21,44',  { base:W_DARK,  label:'WALL' }],
  ['21,45',  { base:W_DARK,  label:'WALL' }],
  ['21,51',  { base:W_DARK,  label:'WALL' }],
  ['21,52',  { base:W_DARK,  label:'WALL' }],
  ['23,29',  { base:W_SLATE, label:'WALL' }],
  ['23,30',  { base:W_SLATE, label:'WALL' }],
  ['23,36',  { base:W_SLATE, label:'WALL' }],
  ['23,37',  { base:W_SLATE, label:'WALL' }],
  ['23,42',  { base:W_SLATE, label:'WALL' }],
  ['23,43',  { base:W_SLATE, label:'WALL' }],
  ['23,49',  { base:W_SLATE, label:'WALL' }],
  ['23,50',  { base:W_SLATE, label:'WALL' }],
  ['27,30',  { base:W_STONE, label:'WALL' }],
  ['27,31',  { base:W_STONE, label:'WALL' }],
  ['27,36',  { base:W_STONE, label:'WALL' }],
  ['27,37',  { base:W_STONE, label:'WALL' }],
  ['27,43',  { base:W_STONE, label:'WALL' }],
  ['27,44',  { base:W_STONE, label:'WALL' }],
  ['27,50',  { base:W_STONE, label:'WALL' }],
  ['27,51',  { base:W_STONE, label:'WALL' }],

  // ─── Bottom-left sector — additional density fill ─────────────────────────────
  ['30,2',   { base:W_DARK,  label:'WALL' }],
  ['30,3',   { base:W_DARK,  label:'WALL' }],
  ['30,7',   { base:W_DARK,  label:'WALL' }],
  ['30,8',   { base:W_DARK,  label:'WALL' }],
  ['30,13',  { base:W_DARK,  label:'WALL' }],
  ['30,14',  { base:W_DARK,  label:'WALL' }],
  ['30,19',  { base:W_DARK,  label:'WALL' }],
  ['30,20',  { base:W_DARK,  label:'WALL' }],
  ['30,24',  { base:W_DARK,  label:'WALL' }],
  ['30,25',  { base:W_DARK,  label:'WALL' }],
  ['32,4',   { base:W_STONE, label:'WALL' }],
  ['32,5',   { base:W_STONE, label:'WALL' }],
  ['32,10',  { base:W_STONE, label:'WALL' }],
  ['32,11',  { base:W_STONE, label:'WALL' }],
  ['32,15',  { base:W_STONE, label:'WALL' }],
  ['32,16',  { base:W_STONE, label:'WALL' }],
  ['32,21',  { base:W_STONE, label:'WALL' }],
  ['32,22',  { base:W_STONE, label:'WALL' }],
  ['35,2',   { base:W_SLATE, label:'WALL' }],
  ['35,3',   { base:W_SLATE, label:'WALL' }],
  ['35,8',   { base:W_SLATE, label:'WALL' }],
  ['35,9',   { base:W_SLATE, label:'WALL' }],
  ['35,15',  { base:W_SLATE, label:'WALL' }],
  ['35,16',  { base:W_SLATE, label:'WALL' }],
  ['35,21',  { base:W_SLATE, label:'WALL' }],
  ['35,22',  { base:W_SLATE, label:'WALL' }],
  ['35,26',  { base:W_SLATE, label:'WALL' }],
  ['37,4',   { base:W_DARK,  label:'WALL' }],
  ['37,5',   { base:W_DARK,  label:'WALL' }],
  ['37,10',  { base:W_DARK,  label:'WALL' }],
  ['37,11',  { base:W_DARK,  label:'WALL' }],
  ['37,16',  { base:W_DARK,  label:'WALL' }],
  ['37,17',  { base:W_DARK,  label:'WALL' }],
  ['37,22',  { base:W_DARK,  label:'WALL' }],
  ['37,23',  { base:W_DARK,  label:'WALL' }],
  ['40,2',   { base:W_STONE, label:'WALL' }],
  ['40,3',   { base:W_STONE, label:'WALL' }],
  ['40,8',   { base:W_STONE, label:'WALL' }],
  ['40,9',   { base:W_STONE, label:'WALL' }],
  ['40,13',  { base:W_STONE, label:'WALL' }],
  ['40,14',  { base:W_STONE, label:'WALL' }],
  ['40,19',  { base:W_STONE, label:'WALL' }],
  ['40,20',  { base:W_STONE, label:'WALL' }],
  ['40,24',  { base:W_STONE, label:'WALL' }],
  ['40,25',  { base:W_STONE, label:'WALL' }],
  ['42,4',   { base:W_SLATE, label:'WALL' }],
  ['42,5',   { base:W_SLATE, label:'WALL' }],
  ['42,10',  { base:W_SLATE, label:'WALL' }],
  ['42,11',  { base:W_SLATE, label:'WALL' }],
  ['42,16',  { base:W_SLATE, label:'WALL' }],
  ['42,17',  { base:W_SLATE, label:'WALL' }],
  ['42,22',  { base:W_SLATE, label:'WALL' }],
  ['42,23',  { base:W_SLATE, label:'WALL' }],
  ['44,2',   { base:W_DARK,  label:'WALL' }],
  ['44,3',   { base:W_DARK,  label:'WALL' }],
  ['44,8',   { base:W_DARK,  label:'WALL' }],
  ['44,9',   { base:W_DARK,  label:'WALL' }],
  ['44,14',  { base:W_DARK,  label:'WALL' }],
  ['44,15',  { base:W_DARK,  label:'WALL' }],
  ['44,20',  { base:W_DARK,  label:'WALL' }],
  ['44,21',  { base:W_DARK,  label:'WALL' }],
  ['44,26',  { base:W_DARK,  label:'WALL' }],
  ['46,3',   { base:W_STONE, label:'WALL' }],
  ['46,4',   { base:W_STONE, label:'WALL' }],
  ['46,9',   { base:W_STONE, label:'WALL' }],
  ['46,10',  { base:W_STONE, label:'WALL' }],
  ['46,15',  { base:W_STONE, label:'WALL' }],
  ['46,16',  { base:W_STONE, label:'WALL' }],
  ['46,21',  { base:W_STONE, label:'WALL' }],
  ['46,22',  { base:W_STONE, label:'WALL' }],
  ['48,2',   { base:W_SLATE, label:'WALL' }],
  ['48,3',   { base:W_SLATE, label:'WALL' }],
  ['48,8',   { base:W_SLATE, label:'WALL' }],
  ['48,9',   { base:W_SLATE, label:'WALL' }],
  ['48,14',  { base:W_SLATE, label:'WALL' }],
  ['48,15',  { base:W_SLATE, label:'WALL' }],
  ['48,20',  { base:W_SLATE, label:'WALL' }],
  ['48,21',  { base:W_SLATE, label:'WALL' }],
  ['48,25',  { base:W_SLATE, label:'WALL' }],
  ['50,3',   { base:W_DARK,  label:'WALL' }],
  ['50,4',   { base:W_DARK,  label:'WALL' }],
  ['50,9',   { base:W_DARK,  label:'WALL' }],
  ['50,10',  { base:W_DARK,  label:'WALL' }],
  ['50,15',  { base:W_DARK,  label:'WALL' }],
  ['50,16',  { base:W_DARK,  label:'WALL' }],
  ['50,21',  { base:W_DARK,  label:'WALL' }],
  ['50,22',  { base:W_DARK,  label:'WALL' }],
  ['52,4',   { base:W_STONE, label:'WALL' }],
  ['52,5',   { base:W_STONE, label:'WALL' }],
  ['52,10',  { base:W_STONE, label:'WALL' }],
  ['52,11',  { base:W_STONE, label:'WALL' }],
  ['52,16',  { base:W_STONE, label:'WALL' }],
  ['52,17',  { base:W_STONE, label:'WALL' }],
  ['52,22',  { base:W_STONE, label:'WALL' }],
  ['52,23',  { base:W_STONE, label:'WALL' }],
  ['52,26',  { base:W_STONE, label:'WALL' }],

  // ─── Outer zone (28-55, 28-55) — additional fill between portal clusters ──────
  ['28,32',  { base:W_DARK,  label:'WALL' }],
  ['28,33',  { base:W_DARK,  label:'WALL' }],
  ['28,40',  { base:W_DARK,  label:'WALL' }],
  ['28,41',  { base:W_DARK,  label:'WALL' }],
  ['28,48',  { base:W_DARK,  label:'WALL' }],
  ['28,49',  { base:W_DARK,  label:'WALL' }],
  ['30,32',  { base:W_STONE, label:'WALL' }],
  ['30,33',  { base:W_STONE, label:'WALL' }],
  ['30,40',  { base:W_STONE, label:'WALL' }],
  ['30,41',  { base:W_STONE, label:'WALL' }],
  ['30,48',  { base:W_STONE, label:'WALL' }],
  ['30,49',  { base:W_STONE, label:'WALL' }],
  ['33,31',  { base:W_DARK,  label:'WALL' }],
  ['33,32',  { base:W_DARK,  label:'WALL' }],
  ['33,38',  { base:W_DARK,  label:'WALL' }],
  ['33,39',  { base:W_DARK,  label:'WALL' }],
  ['33,46',  { base:W_DARK,  label:'WALL' }],
  ['33,47',  { base:W_DARK,  label:'WALL' }],
  ['33,50',  { base:W_DARK,  label:'WALL' }],
  ['33,51',  { base:W_DARK,  label:'WALL' }],
  ['38,33',  { base:W_STONE, label:'WALL' }],
  ['38,34',  { base:W_STONE, label:'WALL' }],
  ['38,37',  { base:W_STONE, label:'WALL' }],
  ['38,45',  { base:W_STONE, label:'WALL' }],
  ['38,46',  { base:W_STONE, label:'WALL' }],
  ['38,50',  { base:W_STONE, label:'WALL' }],
  ['38,51',  { base:W_STONE, label:'WALL' }],
  ['46,33',  { base:W_DARK,  label:'WALL' }],
  ['46,34',  { base:W_DARK,  label:'WALL' }],
  ['46,37',  { base:W_DARK,  label:'WALL' }],
  ['46,43',  { base:W_DARK,  label:'WALL' }],
  ['46,44',  { base:W_DARK,  label:'WALL' }],
  ['46,50',  { base:W_DARK,  label:'WALL' }],
  ['46,51',  { base:W_DARK,  label:'WALL' }],
  ['50,31',  { base:W_STONE, label:'WALL' }],
  ['50,32',  { base:W_STONE, label:'WALL' }],
  ['50,36',  { base:W_STONE, label:'WALL' }],
  ['50,37',  { base:W_STONE, label:'WALL' }],
  ['50,43',  { base:W_STONE, label:'WALL' }],
  ['50,44',  { base:W_STONE, label:'WALL' }],
  ['50,46',  { base:W_STONE, label:'WALL' }],
  ['50,47',  { base:W_STONE, label:'WALL' }],
  ['52,33',  { base:W_DARK,  label:'WALL' }],
  ['52,34',  { base:W_DARK,  label:'WALL' }],
  ['52,43',  { base:W_DARK,  label:'WALL' }],
  ['52,44',  { base:W_DARK,  label:'WALL' }],
  ['52,46',  { base:W_DARK,  label:'WALL' }],
  ['52,47',  { base:W_DARK,  label:'WALL' }],
  ['52,50',  { base:W_DARK,  label:'WALL' }],
  ['52,51',  { base:W_DARK,  label:'WALL' }],
])

// ── Wall collision: returns true if position (grid units) hits a solid wall ──
// cellMap + obsSet distinguish empty corridors (passable) from block/obstacle cells
function hitsSolidWall(gx, gy, cellMap, obsSet, playerZ = 0) {
  const col = Math.floor(gx), row = Math.floor(gy)
  const key = `${row},${col}`
  if (obsSet?.has(key)) return playerZ < OBSTACLE_TOP
  if (!cellMap?.has(key)) return false     // Empty corridor: always passable
  if (playerZ >= BLOCK_TOP) return false
  // Block cell with data: standard centre-doorway collision
  const fx = gx - col, fy = gy - row
  if (fx < PLAYER_R)     { if (fy < DOOR_LO || fy > DOOR_HI) return true }
  if (fx > 1-PLAYER_R)   { if (fy < DOOR_LO || fy > DOOR_HI) return true }
  if (fy < PLAYER_R)     { if (fx < DOOR_LO || fx > DOOR_HI) return true }
  if (fy > 1-PLAYER_R)   { if (fx < DOOR_LO || fx > DOOR_HI) return true }
  return false
}

function findRandomFreeCell(cellMap, validObs) {
  const free = []
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      const k = `${r},${c}`
      if (!cellMap.has(k) && !validObs.has(k)) free.push([r, c])
    }
  }
  if (!free.length) return { row: 14, col: 14 }
  const idx = Math.floor(Math.random() * free.length)
  return { row: free[idx][0], col: free[idx][1] }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const c = (hex || '#000').replace('#', '').padStart(6, '0')
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)]
}

function wallRgb(cell, dist, side, myWallet) {
  if (cell?.isObstacle) {
    const [r,g,b] = cell.base || [40,25,65]
    const f = (side === 1 ? 0.72 : 1.0) * Math.max(0.14, 1 - dist * 0.055)
    return [Math.round(r*f), Math.round(g*f), Math.round(b*f)]
  }
  if (cell?.isChainNode) {
    const pulse = 0.60 + Math.sin(Date.now() / 300) * 0.40
    const f = (side === 1 ? 0.72 : 1.0) * Math.max(0.18, 1 - dist * 0.06) * pulse
    return [Math.round(255 * f), Math.round(180 * f), 0]
  }
  if (cell?.isPortalNode) {
    const [pr, pg, pb] = hexToRgb(cell.color || C)
    const pulse = 0.55 + Math.sin(Date.now() / 400) * 0.45
    const f = (side === 1 ? 0.72 : 1.0) * Math.max(0.18, 1 - dist * 0.06) * pulse
    return [Math.round(pr * f), Math.round(pg * f), Math.round(pb * f)]
  }
  let base
  if (cell?.owner) {
    const isMe = myWallet && cell.owner.toLowerCase() === myWallet.toLowerCase()
    if (isMe) {
      // My block: bright cyan-white
      base = [60, 200, 230]
    } else {
      // Someone else's block: their wallet color, slightly saturated
      const [r,g,b] = hexToRgb(cell.color)
      base = [Math.min(255,r*1.15|0), Math.min(255,g*1.15|0), Math.min(255,b*1.15|0)]
    }
  } else if (cell?.isMarket) {
    // Unowned NFTJI block: amber/gold draws attention.
    base = [200, 110, 20]
  } else if (cell) {
    // Unclaimed regular block: slate-blue, mineable
    base = [30, 60, 130]
  } else {
    // Empty / void
    base = [10, 18, 42]
  }
  const [r,g,b] = base
  const f = (side === 1 ? 0.72 : 1.0) * Math.max(0.14, 1 - dist * 0.065)
  return [Math.round(r*f), Math.round(g*f), Math.round(b*f)]
}

function worldToGrid(wx, wy) {
  return { row: Math.floor(wy / CELL_SIZE), col: Math.floor(wx / CELL_SIZE) }
}

// ── DDA with centre-doorways ──────────────────────────────────────────────────
function castRay(wx, wy, angle, cellMap, obsSet, maxDist = VISUAL_RANGE) {
  const px = wx / CELL_SIZE, py = wy / CELL_SIZE
  const dx = Math.cos(angle), dy = Math.sin(angle)
  let mx = Math.floor(px), my = Math.floor(py)
  const sx = dx>0?1:-1, sy = dy>0?1:-1
  const ddx = Math.abs(dx)<1e-7?1e30:Math.abs(1/dx)
  const ddy = Math.abs(dy)<1e-7?1e30:Math.abs(1/dy)
  let sdx = (dx<0?px-mx:mx+1-px)*ddx
  let sdy = (dy<0?py-my:my+1-py)*ddy
  let side=0, perpDist=0

  for (let step=0; step<Math.ceil(maxDist * 2.2); step++) {
    if (sdx<sdy) { sdx+=ddx; mx+=sx; side=0; perpDist=sdx-ddx }
    else         { sdy+=ddy; my+=sy; side=1; perpDist=sdy-ddy }
    perpDist = Math.max(0.05, perpDist)
    if (perpDist > maxDist) return {perpDist:maxDist,cell:null,side,mx,my,hit:false}
    if (mx<0||mx>=COLS||my<0||my>=ROWS) return {perpDist:Math.min(perpDist,maxDist),cell:null,side,mx,my,hit:false}
    const key = `${my},${mx}`
    // Decorative obstacle: solid wall, no doorway — always a hit
    const obsData = obsSet?.get?.(key) || null
    if (obsData) return {perpDist, cell:{isObstacle:true,...obsData}, side, mx, my, hit:true}
    // Doorway check for block cells
    const hitFrac = (((side===0?py+perpDist*dy:px+perpDist*dx)%1.0)+1.0)%1.0
    const lo=(1-DOOR_FRAC)/2, hi=(1+DOOR_FRAC)/2
    if (hitFrac<lo||hitFrac>hi) {
      const cell = cellMap.get(key) || null
      if (!cell) continue  // Empty corridor: ray passes through
      return {perpDist, cell, side, mx, my, hit:true}
    }
  }
  return {perpDist:maxDist, cell:null, side:0, mx:-1, my:-1, hit:false}
}

// ── Minimap ───────────────────────────────────────────────────────────────────
function minimapSize(W) {
  return W < 600 ? Math.min(W * 0.44, 128) : Math.min(176, W * 0.22)
}

function drawMinimap(ctx, gr, gc, angle, cellMap, presenceMap, myWallet, W, H, chainNodePos, validObs) {
  const isMobile = W < 600
  const SZ = minimapSize(W)
  const MX = W - SZ - 6
  const MY = 8
  const viewCells = RADAR_RANGE * 2 + 1
  const originCol = gc - RADAR_RANGE
  const originRow = gr - RADAR_RANGE
  const CS = SZ/viewCells
  const mapX = (col) => MX + (col-originCol)*CS
  const mapY = (row) => MY + (row-originRow)*CS
  const inCameraView = (row,col,pad=0) => {
    const vx=col-(gc+.5),vy=row-(gr+.5)
    const dist=Math.hypot(vx,vy)
    if(dist<=2.15+pad) return true
    if(dist>RADAR_RANGE+pad) return false
    const rel=Math.atan2(Math.sin(Math.atan2(vy,vx)-angle),Math.cos(Math.atan2(vy,vx)-angle))
    return Math.abs(rel)<=FOV/2+.035+pad*.01
  }
  const drawMapEmoji = (emoji,x,y,color,shape='circle') => {
    const fontSize = isMobile ? 9 : 10
    const radius = fontSize * .53
    ctx.save()
    ctx.globalAlpha = .96
    ctx.fillStyle = 'rgba(1,7,14,.88)'
    ctx.strokeStyle = (color || C) + 'cc';ctx.lineWidth = 1.25
    ctx.beginPath()
    if(shape==='square') ctx.roundRect(x-radius,y-radius,radius*2,radius*2,Math.max(1,radius*.18))
    else ctx.arc(x,y,radius,0,Math.PI*2)
    ctx.fill();ctx.stroke()
    ctx.font = `${fontSize}px serif`;ctx.textAlign='center';ctx.textBaseline='middle'
    ctx.fillStyle='#fff';ctx.fillText(emoji||'◆',x,y+fontSize*.03)
    ctx.restore()
  }

  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  ctx.fillRect(MX-1,MY-1,SZ+2,SZ+2)
  ctx.strokeStyle = C+'33'; ctx.lineWidth=0.5
  ctx.strokeRect(MX-1,MY-1,SZ+2,SZ+2)

  ctx.save()
  ctx.beginPath();ctx.rect(MX,MY,SZ,SZ);ctx.clip()
  const pvx=mapX(gc+.5),pvy=mapY(gr+.5)
  const visionEdge=[]
  const visionRays=isMobile?36:56
  for(let i=0;i<=visionRays;i++){
    const rayAngle=angle-FOV/2+(i/visionRays)*FOV
    const ray=castRay((gc+.5)*CELL_SIZE,(gr+.5)*CELL_SIZE,rayAngle,cellMap,validObs,RADAR_RANGE)
    const rayDist=Math.min(RADAR_RANGE,ray.perpDist+.04)
    visionEdge.push({
      x:mapX(gc+.5+Math.cos(rayAngle)*rayDist),
      y:mapY(gr+.5+Math.sin(rayAngle)*rayDist),
    })
  }
  ctx.beginPath()
  ctx.arc(pvx,pvy,CS*2.15,0,Math.PI*2)
  ctx.moveTo(pvx,pvy)
  for(const point of visionEdge)ctx.lineTo(point.x,point.y)
  ctx.closePath();ctx.clip()
  const r0=Math.max(0,Math.floor(originRow)),r1=Math.min(ROWS,Math.ceil(originRow+viewCells))
  const c0=Math.max(0,Math.floor(originCol)),c1=Math.min(COLS,Math.ceil(originCol+viewCells))
  for (let r=r0;r<r1;r++) for (let c=c0;c<c1;c++) {
    const key = `${r},${c}`
    const cell = cellMap.get(key)
    const obs  = validObs?.get(key) || null
    if (!inCameraView(r+.5,c+.5)) {
      ctx.fillStyle = '#01040a'
    } else if (obs) {
      const [or,og,ob] = obs.base
      ctx.fillStyle = `rgba(${or>>1},${og>>1},${ob>>1},0.85)`
    } else if (cell?.owner) {
      ctx.fillStyle = cell.color+'bb'
    } else if (cell?.isMarket) {
      ctx.fillStyle = cell.owner ? '#4ade8044' : '#fb923c55'
    } else if (cell?.isChainNode) {
      ctx.fillStyle = '#ffd70033'
    } else if (cell && !cell.isPortalNode) {
      ctx.fillStyle = '#0e1e2e'  // unclaimed mining block: dim blue, distinguishable from void
    } else {
      ctx.fillStyle = '#050810'  // open corridor / void
    }
    ctx.fillRect(mapX(c), mapY(r), Math.ceil(CS), Math.ceil(CS))
    const isMyBlock = inCameraView(r+.5,c+.5) && cell?.owner && myWallet && cell.owner.toLowerCase() === myWallet.toLowerCase()
    if (isMyBlock) {
      ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 0.7
      ctx.strokeRect(mapX(c)+0.5, mapY(r)+0.5, Math.max(1,Math.ceil(CS)-1), Math.max(1,Math.ceil(CS)-1))
    }
  }

  // NFTJI block markers — amber diamond (free) or green diamond (owned)
  for (const [key, cell] of cellMap) {
    if (!cell?.isMarket) continue
    const obs = validObs?.get(key)
    if (obs) continue  // hidden behind static wall, skip
    const [rr, cc] = key.split(',').map(Number)
    if(!inCameraView(rr+.5,cc+.5)) continue
    const mx2 = mapX(cc + 0.5)
    const my2 = mapY(rr + 0.5)
    const ds = Math.max(1.2, CS * 0.36)
    ctx.save()
    ctx.translate(mx2, my2)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = cell.owner ? '#4ade80cc' : '#fb923ccc'
    ctx.fillRect(-ds, -ds, ds*2, ds*2)
    ctx.restore()
    if(cell.emoji){
      drawMapEmoji(cell.emoji,mx2,my2,cell.owner?'#4ade80':'#fb923c','square')
    }
  }

  ctx.strokeStyle = C+'cc'; ctx.lineWidth=0.8
  ctx.strokeRect(mapX(gc), mapY(gr), Math.ceil(CS), Math.ceil(CS))

  ctx.fillStyle='rgba(34,211,238,.045)'
  ctx.beginPath();ctx.moveTo(pvx,pvy)
  for(const point of visionEdge)ctx.lineTo(point.x,point.y)
  ctx.closePath();ctx.fill()

  for (const [w,p] of Object.entries(presenceMap||{})) {
    if (p.row==null && p.gy==null) continue
    const isMe = w.toLowerCase()===(myWallet||'').toLowerCase()
    if(isMe) continue
    const isBot = Boolean(p.isBot)
    const dotGX = p.gx ?? ((p.col??0) + 0.5)
    const dotGY = p.gy ?? ((p.row??0) + 0.5)
    if(!inCameraView(dotGY,dotGX,1)) continue
    if(!isMe){
      const vx=dotGX-(gc+.5),vy=dotGY-(gr+.5)
      const walletDist=Math.hypot(vx,vy)
      const walletAngle=Math.atan2(vy,vx)
      const relAngle=Math.atan2(Math.sin(walletAngle-angle),Math.cos(walletAngle-angle))
      if(walletDist>2.5&&Math.abs(relAngle)>FOV/2+.08) continue
      const sight=castRay((gc+.5)*CELL_SIZE,(gr+.5)*CELL_SIZE,walletAngle,cellMap,validObs,Math.min(RADAR_RANGE,walletDist))
      if(sight.hit&&sight.perpDist<walletDist-.35) continue
    }
    const col = colorFromAddress(w)
    const dx=mapX(dotGX), dy=mapY(dotGY)
    const heading=Number(p.angle)||0

    if (isBot && !isMe) {
      // Bots: large square marker so they're clearly visible on a 56-cell minimap
      const bs = Math.max(4, CS * 0.95)
      // Pulsing outer ring
      ctx.strokeStyle = col + 'bb'
      ctx.lineWidth = 1
      ctx.strokeRect(dx - bs, dy - bs, bs * 2, bs * 2)
      // Filled interior
      ctx.fillStyle = col + '44'
      ctx.fillRect(dx - bs + 1, dy - bs + 1, bs * 2 - 2, bs * 2 - 2)
      // Inner cross
      ctx.strokeStyle = col + 'ff'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(dx - bs * 0.55, dy); ctx.lineTo(dx + bs * 0.55, dy)
      ctx.moveTo(dx, dy - bs * 0.55); ctx.lineTo(dx, dy + bs * 0.55)
      ctx.stroke()
      // Direction line
      ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(dx, dy)
      ctx.lineTo(dx + Math.cos(heading) * CS * 2.2, dy + Math.sin(heading) * CS * 2.2)
      ctx.stroke()
    } else {
      const r = Math.max(2.2, isMe ? CS * 0.82 : CS * 0.72)
      if (!isMe) {
        ctx.strokeStyle = col + 'aa'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(dx, dy, r + 1.5, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = isMe ? C : col
      ctx.beginPath()
      ctx.arc(dx, dy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = (isMe ? C : col) + 'cc'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(dx, dy)
      ctx.lineTo(dx + Math.cos(heading) * CS * 1.8, dy + Math.sin(heading) * CS * 1.8)
      ctx.stroke()
    }
  }

  // Chain node: diamond crosshair — visually distinct landmark (static, not a dot)
  const cnPos   = chainNodePos || { row: CHAIN_NODE_ROW, col: CHAIN_NODE_COL }
  if(inCameraView(cnPos.row+.5,cnPos.col+.5)){
    const cnPulse = 0.55 + Math.sin(Date.now() / 600) * 0.45
    const cnx = mapX(cnPos.col + 0.5)
    const cny = mapY(cnPos.row + 0.5)
    const armLen = CS * 2.8
    const gapR   = CS * 0.85
    ctx.globalAlpha = cnPulse * 0.28
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.arc(cnx, cny, CS * 2.1, 0, Math.PI*2); ctx.stroke()
    ctx.globalAlpha = Math.max(0.55, cnPulse)
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(cnx - gapR, cny); ctx.lineTo(cnx - armLen, cny)
    ctx.moveTo(cnx + gapR, cny); ctx.lineTo(cnx + armLen, cny)
    ctx.moveTo(cnx, cny - gapR); ctx.lineTo(cnx, cny - armLen)
    ctx.moveTo(cnx, cny + gapR); ctx.lineTo(cnx, cny + armLen)
    ctx.stroke()
    ctx.globalAlpha = Math.max(0.70, cnPulse)
    ctx.fillStyle = '#ffd700'
    ctx.save(); ctx.translate(cnx, cny); ctx.rotate(Math.PI / 4)
    const ds = CS * 0.52
    ctx.fillRect(-ds, -ds, ds*2, ds*2)
    ctx.restore()
    ctx.globalAlpha = 1
  }

  // Portal navigation nodes — pulsing colored dots
  for (const [key, cell] of cellMap) {
    if (!cell?.isPortalNode) continue
    const [rr, cc] = key.split(',').map(Number)
    if(!inCameraView(rr+.5,cc+.5)) continue
    const px2 = mapX(cc + 0.5)
    const py2 = mapY(rr + 0.5)
    const pPulse = 0.60 + Math.sin(Date.now() / 500 + cc * 0.4) * 0.40
    ctx.globalAlpha = Math.max(0.55, pPulse) * 0.9
    ctx.fillStyle = cell.color || C
    ctx.beginPath()
    ctx.arc(px2, py2, Math.max(2, CS * 0.75), 0, Math.PI * 2)
    ctx.fill()
    drawMapEmoji(cell.emoji||'◆',px2,py2,cell.color||C,'circle')
    ctx.globalAlpha = 1
  }

  ctx.restore()
  ctx.strokeStyle=C+'aa';ctx.lineWidth=1
  ctx.beginPath();ctx.moveTo(pvx,pvy)
  for(const point of visionEdge)ctx.lineTo(point.x,point.y)
  ctx.closePath();ctx.stroke()
  const playerRadius=Math.max(3,CS*.9)
  ctx.fillStyle=C;ctx.beginPath();ctx.arc(pvx,pvy,playerRadius,0,Math.PI*2);ctx.fill()
  ctx.strokeStyle='#e0fbff';ctx.lineWidth=1.2
  ctx.beginPath();ctx.moveTo(pvx,pvy)
  ctx.lineTo(pvx+Math.cos(angle)*CS*3,pvy+Math.sin(angle)*CS*3);ctx.stroke()
}

// ── Facing block HUD (top-right info card) ────────────────────────────────────
function drawFacingHUD(ctx, W, H, fwdCell, fwdMx, fwdMy, myWallet, es, dist, obsMap) {
  if (W < 600) return  // HTML panel below canvas handles this on mobile
  if (fwdMx < 0 || fwdMy < 0 || fwdMx >= COLS || fwdMy >= ROWS) return

  // Double-check: use both cell flag and obsMap to catch any desync
  const isObs = fwdCell?.isObstacle || obsMap?.has(`${fwdMy},${fwdMx}`)
  // Position cards to the left of the minimap (SZ matches drawMinimap for W>=600)
  const _mapSZ = Math.min(130, W * 0.2)
  const _mapLeft = W - _mapSZ - 6
  if (isObs) {
    const lines = [
      { text: es ? 'PARED' : 'WALL', size: 12, weight: 'bold', col: '#90a0b0' },
      { text: es ? '· no interactivo' : '· non-interactive', size: 10, col: '#445566' },
    ]
    const lineH=15, padX=9, padY=7, ph=lines.length*lineH+padY*2
    const pw=Math.min(_mapLeft-16,180), px=_mapLeft-pw-6, py=8
    ctx.globalAlpha=0.80; ctx.fillStyle='#010709'; ctx.fillRect(px,py,pw,ph); ctx.globalAlpha=1
    ctx.lineWidth=0.5; ctx.strokeStyle='#90a0b033'; ctx.strokeRect(px,py,pw,ph)
    ctx.fillStyle='#90a0b055'; ctx.fillRect(px,py,2,ph)
    ctx.textAlign='left'; ctx.textBaseline='top'
    for (let i=0;i<lines.length;i++){
      const l=lines[i]; ctx.font=`${l.weight||'normal'} ${l.size}px monospace`
      ctx.fillStyle=l.col; ctx.fillText(l.text,px+padX,py+padY+i*lineH,pw-padX*2)
    }
    return
  }

  if (fwdCell?.isPortalNode) {
    const inRange = dist == null || dist <= INTERACT_DIST
    const col = fwdCell.color || C
    const pLines = [
      { text: `${fwdCell.emoji || '⬡'}  ${fwdCell.titleEn || 'PORTAL'}`, size: 13, weight: 'bold', col },
      { text: fwdCell.navUrl || '', size: 10, col: '#5b8aa3' },
      inRange
        ? { text: es ? '↵ · Ir a sección' : '↵ · Go to section', size: 10, col: col + 'cc' }
        : { text: es ? '· acércate para acceder' : '· move closer to access', size: 9, col: col + '55' },
    ]
    const _lineH = 16, _padX = 9, _padY = 8
    const _ph = pLines.length * _lineH + _padY * 2
    const _pw = Math.min(_mapLeft - 16, 240)
    const _px = _mapLeft - _pw - 6
    ctx.globalAlpha = 0.90; ctx.fillStyle = '#010709'; ctx.fillRect(_px, 8, _pw, _ph); ctx.globalAlpha = 1
    ctx.lineWidth = 1; ctx.strokeStyle = col + '55'; ctx.strokeRect(_px, 8, _pw, _ph)
    ctx.fillStyle = col + '77'; ctx.fillRect(_px, 8, 2, _ph)
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    for (let i = 0; i < pLines.length; i++) {
      const l = pLines[i]
      ctx.font = `${l.weight || 'normal'} ${l.size}px monospace`
      ctx.fillStyle = l.col
      ctx.fillText(l.text, _px + _padX, 8 + _padY + i * _lineH, _pw - _padX * 2)
    }
    return
  }

  if (fwdCell?.isChainNode) {
    const inRange = dist == null || dist <= INTERACT_DIST
    const col = fwdCell.color || '#ffd700'
    const title = es ? (fwdCell.titleEs || 'NODO CENTRAL') : (fwdCell.titleEn || 'CENTRAL NODE')
    const lines = [
      { text: `${fwdCell.emoji || '⬡'}  ${title}`, size: 13, weight: 'bold', col },
      { text: es ? 'Terminal estático de la cadena' : 'Static chain terminal', size: 10, col: '#8b7f52' },
      inRange
        ? { text: es ? '↵ · Resolver cadena' : '↵ · Solve formula chain', size: 10, col: col + 'cc' }
        : { text: es ? '· acércate para interactuar' : '· move closer to interact', size: 9, col: col + '55' },
    ]
    const lineH=16,padX=9,padY=8,ph=lines.length*lineH+padY*2,pw=Math.min(_mapLeft-16,240),px=_mapLeft-pw-6
    ctx.globalAlpha=.9;ctx.fillStyle='#010709';ctx.fillRect(px,8,pw,ph);ctx.globalAlpha=1
    ctx.strokeStyle=col+'55';ctx.strokeRect(px,8,pw,ph);ctx.fillStyle=col+'77';ctx.fillRect(px,8,2,ph)
    ctx.textAlign='left';ctx.textBaseline='top'
    lines.forEach((line,i)=>{ctx.font=`${line.weight||'normal'} ${line.size}px monospace`;ctx.fillStyle=line.col;ctx.fillText(line.text,px+padX,8+padY+i*lineH,pw-padX*2)})
    return
  }

  const hex   = fwdCell?.blockHex || gridToBlockHex(fwdMy, fwdMx)
  const title = fwdCell
    ? (es ? (fwdCell.titleEs || fwdCell.titleEn || '') : (fwdCell.titleEn || fwdCell.titleEs || ''))
    : ''
  const owner  = fwdCell?.owner || null
  const isMine = myWallet && owner?.toLowerCase() === myWallet.toLowerCase()
  const color  = fwdCell?.color || C

  const lines = []
  const epfx  = fwdCell?.emoji ? `${fwdCell.emoji}  ` : ''
  lines.push({ text: `${epfx}${hex}`, size: 13, weight: 'bold', col: color })
  if (title) lines.push({ text: title, size: 11, col: '#c7d8e2' })

  if (owner) {
    lines.push({
      text: isMine
        ? (es ? '🔑 Tu bloque' : '🔑 Yours')
        : `◈ ${owner.slice(0,6)}…${owner.slice(-4)}`,
      size: 11, col: isMine ? C : color + 'dd',
    })
  } else if (fwdCell?.isMarket) {
    lines.push({ text: es ? '○ NFTJI libre' : '○ Free NFTJI', size: 11, col: '#5b8aa3' })
  } else if (fwdCell) {
    lines.push({ text: es ? '○ Sin reclamar' : '○ Unclaimed', size: 11, col: '#5b7890' })
  } else {
    // Unclaimed block not in DB (never touched)
    lines.push({ text: es ? '○ Sin reclamar' : '○ Unclaimed', size: 11, col: '#5b7890' })
  }

  if (fwdCell?.priceEur > 0) {
    lines.push({ text: `${fwdCell.priceEur} EUR`, size: 11, weight: 'bold', col: '#fb923c' })
  }

  if (dist != null && !fwdCell?.isObstacle) {
    const distCol = dist <= INTERACT_DIST ? '#4ade8077' : '#3d5a6a'
    lines.push({ text: `${dist.toFixed(1)} cells`, size: 9, col: distCol })
  }

  if (!owner) {
    const inRange = dist == null || dist <= INTERACT_DIST
    if (fwdCell?.isChainNode) {
      lines.push(inRange
        ? { text: es ? '↵ · Resolver cadena' : '↵ · Solve formula chain', size: 10, col: '#ffd700cc' }
        : { text: es ? '· acercarse para interactuar' : '· move closer to interact', size: 9, col: '#ffd70055' })
    } else if (fwdCell?.isMarket) {
      // Free NFTJI block — 2 options
      lines.push(inRange
        ? { text: es ? '↵ · Comprar NFTJI  /buy' : '↵ · Buy NFTJI  /buy', size: 10, col: '#fb923ccc' }
        : { text: es ? '· acercarse para comprar' : '· move closer to buy', size: 9, col: '#fb923c55' })
      lines.push({ text: es ? '· Liberar /resell  (sin dueño)' : '· Resell /resell  (no owner)', size: 9, col: '#4ade8033' })
    } else {
      lines.push(inRange
        ? { text: es ? '↵ · Minar bloque' : '↵ · Mine block', size: 10, col: C + 'cc' }
        : { text: es ? '· acercarse para minar' : '· move closer to mine', size: 9, col: C + '55' })
    }
  } else if (owner && fwdCell?.isMarket) {
    const isMineWall = myWallet && owner.toLowerCase() === myWallet.toLowerCase()
    if (isMineWall) {
      // My NFTJI block — 2 options
      lines.push({ text: es ? '· Comprar /buy  (ya posees)' : '· Buy /buy  (already owned)', size: 9, col: '#fb923c33' })
      lines.push({ text: es ? '↵ · Liberar NFTJI  /resell' : '↵ · Resell NFTJI  /resell', size: 10, col: '#4ade80cc' })
    }
  }

  const lineH = 16, padX = 9, padY = 8
  const ph = lines.length * lineH + padY * 2
  const pw = Math.min(_mapLeft - 16, 240)
  const px = _mapLeft - pw - 6
  const py = 8

  // Background
  ctx.globalAlpha = 0.90
  ctx.fillStyle = '#010709'
  ctx.fillRect(px, py, pw, ph)
  ctx.globalAlpha = 1

  // Border + accent bar
  ctx.lineWidth = 1
  ctx.strokeStyle = color + '55'
  ctx.strokeRect(px, py, pw, ph)
  ctx.fillStyle = color + '77'
  ctx.fillRect(px, py, 2, ph)

  // Text lines
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    ctx.font = `${l.weight || 'normal'} ${l.size}px monospace`
    ctx.fillStyle = l.col
    ctx.fillText(l.text, px + padX, py + padY + i * lineH, pw - padX * 2)
  }
}

// ── Pickaxe sounds ──────────────────────────────────────────────────────────
function playPickHit(audioCtxRef, type) {
  try {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume().catch(()=>{})
    const t = ctx.currentTime

    if (type === 'nftji') {
      // Metallic ring: two sine waves
      [[1300, 0.20], [2000, 0.07]].forEach(([freq, vol], i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, t)
        osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.22)
        g.gain.setValueAtTime(vol, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.26)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(t); osc.stop(t + 0.28)
      })
    } else if (type === 'mine') {
      // Rock thud: noise burst through low bandpass
      const sr = ctx.sampleRate
      const buf = ctx.createBuffer(1, Math.ceil(sr * 0.14), sr)
      const d   = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 1.4)
      const src = ctx.createBufferSource(); src.buffer = buf
      const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=160; f.Q.value=4
      const g = ctx.createGain(); g.gain.value = 0.45
      src.connect(f); f.connect(g); g.connect(ctx.destination); src.start()
    } else if (type === 'complete') {
      // Ascending chime
      [523, 659, 784, 1047].forEach((freq, i) => {
        const ts = t + i * 0.09
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'triangle'; osc.frequency.value = freq
        g.gain.setValueAtTime(0.14, ts)
        g.gain.exponentialRampToValueAtTime(0.001, ts + 0.22)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(ts); osc.stop(ts + 0.25)
      })
    } else {
      // Empty swing: dry click
      const sr = ctx.sampleRate
      const buf = ctx.createBuffer(1, Math.ceil(sr * 0.03), sr)
      const d   = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 7)
      const src = ctx.createBufferSource(); src.buffer = buf
      const g = ctx.createGain(); g.gain.value = 0.06
      src.connect(g); g.connect(ctx.destination); src.start()
    }
  } catch {}
}

// ── First-person pickaxe ────────────────────────────────────────────────────
function drawFirstPersonTool(ctx, W, H, color, swingT, walkDist) {
  const mobile = W < 640
  const scale = mobile ? 0.72 : Math.max(0.82, Math.min(1.15, H / 620))
  const bob = Math.sin(walkDist * 0.16) * 3 * scale
  const swing = Math.sin(Math.min(1, swingT) * Math.PI)
  const handX = W * (mobile ? 0.83 : 0.77) - swing * 74 * scale
  const handY = H + 18 * scale - swing * 88 * scale + bob
  const [r,g,b] = hexToRgb(color || C)

  ctx.save()
  ctx.globalAlpha = 0.96
  ctx.strokeStyle = `rgb(${Math.round(r*.62)},${Math.round(g*.62)},${Math.round(b*.62)})`
  ctx.lineWidth = Math.max(12, 18*scale); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(W + 18, H + 18); ctx.lineTo(handX, handY); ctx.stroke()

  const pickL = 128 * scale
  const pickA = -2.02 - swing * 0.92
  drawFreakDrillPick(ctx,handX,handY,pickL,pickA,scale)
  ctx.restore()
}

function drawFreakDrillPick(ctx,handX,handY,length,angle,scale=1,alpha=1){
  const tipX=handX+Math.cos(angle)*length,tipY=handY+Math.sin(angle)*length
  ctx.save();ctx.globalAlpha*=alpha;ctx.lineCap='round'
  ctx.strokeStyle='#70462d';ctx.lineWidth=Math.max(2,5*scale)
  ctx.beginPath();ctx.moveTo(handX,handY);ctx.lineTo(tipX,tipY);ctx.stroke()
  const nx=-Math.sin(angle),ny=Math.cos(angle),headL=15*scale
  ctx.lineCap='butt';ctx.fillStyle='#172b38';ctx.strokeStyle='#67e8f9';ctx.lineWidth=Math.max(.7,scale)
  ctx.beginPath();ctx.moveTo(tipX+nx*headL,tipY+ny*headL);ctx.lineTo(tipX-nx*headL*.8,tipY-ny*headL*.8)
  ctx.lineTo(tipX-nx*headL*.48-Math.cos(angle)*headL*.8,tipY-ny*headL*.48-Math.sin(angle)*headL*.8)
  ctx.lineTo(tipX+nx*headL*.55-Math.cos(angle)*headL*.45,tipY+ny*headL*.55-Math.sin(angle)*headL*.45);ctx.closePath();ctx.fill();ctx.stroke()
  ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(tipX,tipY,3.2*scale,0,Math.PI*2);ctx.fill()
  ctx.strokeStyle='#22d3ee';ctx.lineWidth=Math.max(1,1.5*scale);ctx.beginPath()
  ctx.moveTo(tipX+nx*headL,tipY+ny*headL);ctx.lineTo(tipX+nx*headL*1.45-Math.cos(angle)*headL*.18,tipY+ny*headL*1.45-Math.sin(angle)*headL*.18);ctx.stroke()
  ctx.restore()
}

function drawThirdPersonPlayer(ctx,W,H,color,swingT,walkDist,dockTop){
  const mobile=W<640,scale=mobile ? .76 : Math.max(.86,Math.min(1.1,H/590))
  const bodyW=66*scale,bodyH=76*scale,headW=43*scale,headH=28*scale
  const bob=Math.sin(walkDist*.18)*2.2*scale
  const cx=W/2,bottomY=(dockTop??(H-18))+bob,bodyTop=bottomY-bodyH,headTop=bodyTop-headH+4*scale
  const [r,g,b]=hexToRgb(color||C)
  ctx.save();ctx.globalAlpha=.98
  ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(cx,bottomY+4,bodyW*.62,7*scale,0,0,Math.PI*2);ctx.fill()
  ctx.fillStyle=`rgb(${r*.35|0},${g*.35|0},${b*.35|0})`;ctx.strokeStyle=color||C;ctx.lineWidth=1.2
  ctx.fillRect(cx-bodyW*.42,bodyTop,bodyW*.84,bodyH);ctx.strokeRect(cx-bodyW*.42,bodyTop,bodyW*.84,bodyH)
  ctx.fillStyle=`rgb(${r*.48|0},${g*.48|0},${b*.48|0})`
  ctx.fillRect(cx-bodyW*.54,bodyTop+9*scale,bodyW*.12,bodyH*.28);ctx.fillRect(cx+bodyW*.42,bodyTop+9*scale,bodyW*.12,bodyH*.28)
  ctx.fillStyle=`rgba(${r},${g},${b},.38)`;ctx.fillRect(cx-bodyW*.35,bodyTop+8,bodyW*.7,7*scale)
  ctx.fillStyle='#09131d';ctx.fillRect(cx-bodyW*.25,bodyTop+bodyH*.29,bodyW*.5,bodyH*.22)
  ctx.strokeStyle='#67e8f966';ctx.strokeRect(cx-bodyW*.25,bodyTop+bodyH*.29,bodyW*.5,bodyH*.22)
  ctx.fillStyle='#facc15';ctx.fillRect(cx-5*scale,bodyTop+bodyH*.34,10*scale,7*scale)
  ctx.fillStyle='#071019';ctx.fillRect(cx-bodyW*.42,bodyTop+bodyH*.70,bodyW*.84,6*scale)
  ctx.fillStyle=`rgb(${r*.28|0},${g*.28|0},${b*.28|0})`;ctx.fillRect(cx-bodyW*.34,bottomY-9*scale,bodyW*.25,9*scale);ctx.fillRect(cx+bodyW*.09,bottomY-9*scale,bodyW*.25,9*scale)
  ctx.fillStyle=`rgb(${Math.min(255,r*.82+35)|0},${Math.min(255,g*.82+35)|0},${Math.min(255,b*.82+35)|0})`
  ctx.fillRect(cx-headW/2,headTop,headW,headH);ctx.strokeRect(cx-headW/2,headTop,headW,headH)
  ctx.fillStyle='#071722';ctx.fillRect(cx-headW*.36,headTop+headH*.28,headW*.72,headH*.34)
  ctx.fillStyle='#67e8f9';ctx.fillRect(cx-headW*.28,headTop+headH*.36,headW*.56,2*scale)
  ctx.fillStyle=color||C;ctx.fillRect(cx-4*scale,headTop-5*scale,8*scale,5*scale)
  const handX=cx+bodyW*.47,handY=bodyTop+bodyH*.43,pickL=64*scale
  ctx.strokeStyle=`rgb(${r*.72|0},${g*.72|0},${b*.72|0})`;ctx.lineWidth=6*scale;ctx.lineCap='round'
  ctx.beginPath();ctx.moveTo(cx+bodyW*.34,bodyTop+bodyH*.28);ctx.lineTo(handX,handY);ctx.stroke()
  const pickA=-.92-Math.sin(swingT*Math.PI)*1.25
  drawFreakDrillPick(ctx,handX,handY,pickL,pickA,scale)
  ctx.restore()
}

// ── Mining progress arc ──────────────────────────────────────────────────────
function drawMineProgress(ctx, W, H, progress, type) {
  if (progress <= 0) return
  const cx = W / 2, cy = H * HORIZON_RATIO
  const r   = 24
  const col = type === 'nftji' ? '#fb923c' : C
  const s   = -Math.PI / 2

  ctx.globalAlpha = 0.28
  ctx.strokeStyle = col; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()

  ctx.globalAlpha = 0.88
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, r, s, s + progress * Math.PI * 2); ctx.stroke()
  ctx.lineCap = 'butt'

  ctx.globalAlpha = 0.65
  ctx.fillStyle = col; ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(`${Math.round(progress * 100)}%`, cx, cy + r + 10)
  ctx.globalAlpha = 1
}

// ── Fixed NFTJI skills HUD (top-left, independent from player movement) ──────
function drawWalletDock(ctx, W, H, myNftjis, health, es, isLoggedWallet) {
  const mobile = W < 600
  const SLOT_W = mobile ? 28 : 32, SLOT_H = mobile ? 34 : 40
  const GAP = 4, PAD_X = 8, PAD_Y = 5, HEADER_H = 3
  const skills = myNftjis || []
  const minimumSlots = mobile ? 3 : 4
  const slotCount = Math.max(skills.length, minimumSlots)
  const skillsW = slotCount ? PAD_X * 2 + slotCount * (SLOT_W + GAP) - GAP : 0
  const pw = slotCount ? skillsW : (mobile ? Math.min(158, W * .46) : 178)
  const ph = slotCount ? PAD_Y * 2 + HEADER_H + SLOT_H : (mobile ? 12 : 24)

  const px = 6
  const healthY = 8
  const py = healthY + 10

  const hp = Math.max(0, Math.min(100, Number(health ?? 100)))
  const hpColor = hp > 60 ? '#4ade80' : hp > 25 ? '#facc15' : '#fb7185'
  ctx.globalAlpha = .94
  ctx.fillStyle = '#17070b'
  ctx.fillRect(px, healthY, pw, 10)
  ctx.fillStyle = hpColor
  ctx.fillRect(px, healthY, pw * hp / 100, 10)
  ctx.strokeStyle = hpColor + 'aa'; ctx.lineWidth = .75
  ctx.strokeRect(px, healthY, pw, 10)
  ctx.fillStyle = '#e8fbff'; ctx.font = 'bold 8px monospace'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(`${es ? 'VIDA' : 'HP'} ${hp}/100`, px + 5, healthY + 5)

  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#010709'
  ctx.fillRect(px, py, pw, ph)
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#fb923c44'; ctx.lineWidth = 0.5
  ctx.strokeRect(px, py, pw, ph)
  // top accent bar (horizontal)
  ctx.fillStyle = hpColor + 'aa'
  ctx.fillRect(px, py, pw, 2)

  const slotY = py + PAD_Y + HEADER_H
  for (let i = 0; i < slotCount; i++) {
    const skill = skills[i]
    const { emoji, level, isActive } = skill || {}
    const sx = px + PAD_X + i * (SLOT_W + GAP)

    ctx.fillStyle = skill ? (isActive ? '#0e2010' : '#080e18') : '#050a12'
    ctx.fillRect(sx, slotY, SLOT_W, SLOT_H)
    ctx.strokeStyle = skill ? (isActive ? '#4ade80aa' : '#fb923c22') : '#52617255'
    ctx.lineWidth = isActive ? 1 : 0.5
    ctx.strokeRect(sx, slotY, SLOT_W, SLOT_H)

    if (!skill) {
      ctx.fillStyle = '#52617222'
      ctx.fillRect(sx + 5, slotY + 6, SLOT_W - 10, SLOT_H - 12)
      continue
    }

    ctx.font = '17px serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(emoji || '⬡', sx + SLOT_W / 2, slotY + SLOT_H / 2 - 5)

    ctx.font = 'bold 7px monospace'
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillStyle = isActive ? '#4ade80dd' : '#fb923c99'
    ctx.fillText(`Lv${level}`, sx + SLOT_W / 2, slotY + SLOT_H - 1)
  }

  ctx.textAlign = 'left'; ctx.globalAlpha = 1
  return { top: healthY, bottom: py + ph, width: pw }
}

function drawChainStats(ctx, W, H, stats, es, top = 8) {
  if (!stats) return
  const { owned, marketFree, marketOwned, total, pct } = stats

  const lines = [
    { label: es ? 'CADENA MM3' : 'MM3 CHAIN', val: null, header: true },
    { label: es ? 'Reclamados' : 'Claimed', val: `${owned} / ${total}` },
    { label: es ? 'NFTJI libres' : 'Free NFTJI', val: String(marketFree) },
    { label: es ? 'NFTJI vendidos' : 'Owned NFTJI', val: String(marketOwned) },
  ]

  const LINE_H = 13, PAD_X = 8, PAD_Y = 6
  const pw = 158, ph = lines.length * LINE_H + PAD_Y * 2 + 9
  const px = 6
  const py = top

  ctx.globalAlpha = 0.78
  ctx.fillStyle = '#010709'
  ctx.fillRect(px, py, pw, ph)
  ctx.globalAlpha = 1
  ctx.strokeStyle = C + '33'; ctx.lineWidth = 0.5
  ctx.strokeRect(px, py, pw, ph)
  ctx.fillStyle = C + '77'
  ctx.fillRect(px, py, 2, ph)

  // Progress bar for owned%
  const barW = pw - PAD_X * 2
  ctx.fillStyle = '#0a1a22'
  ctx.fillRect(px + PAD_X, py + ph - PAD_Y - 4, barW, 4)
  ctx.fillStyle = C + 'aa'
  ctx.fillRect(px + PAD_X, py + ph - PAD_Y - 4, Math.round(barW * pct / 100), 4)

  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    const { label, val, header } = lines[i]
    const ly = py + PAD_Y + i * LINE_H
    if (header) {
      ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left'
      ctx.fillStyle = C + 'cc'
      ctx.fillText(label, px + PAD_X, ly)
      ctx.font = 'bold 9px monospace'; ctx.textAlign = 'right'
      ctx.fillStyle = '#4ade80cc'
      ctx.fillText(`${pct}%`, px + pw - PAD_X, ly)
    } else {
      ctx.font = '9px monospace'; ctx.textAlign = 'left'
      ctx.fillStyle = '#70879c'
      ctx.fillText(label, px + PAD_X, ly)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#c2d2de'
      ctx.fillText(val, px + pw - PAD_X, ly)
    }
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1
}

// ── Online players list (below minimap) ─────────────────────────────────────
function drawOnlineList(ctx, W, H, presenceMap, myWallet, pvpStolen) {
  const isMobile = W < 600
  const SZ = minimapSize(W)
  const MX = W - SZ - 6
  const MY = 8

  const all = []
  for (const [w, pres] of Object.entries(presenceMap || {})) {
    if (pres.row == null && pres.gy == null) continue
    const isAnon = w.startsWith('anon-')
    all.push({ w, isAnon, isBot: Boolean(pres.isBot), stolen: (pvpStolen || {})[w] || 0 })
  }

  const grouped = groupPresenceEntries(all, (entry) => entry.w)
  const loggedTotal = grouped.wallets.length
  const anonTotal = grouped.anonymous.length
  const logged = grouped.wallets.sort((a, b) => b.stolen - a.stolen).slice(0, 5)
  const anon = grouped.anonymous.sort((a, b) => a.w.localeCompare(b.w)).slice(0, 5)
  if (!logged.length && !anon.length) return

  const HEADER_H = 15
  const LINE_H   = 13
  const GROUP_H  = 11
  const PAD_X    = 7, PAD_Y = 5
  const pw  = SZ + 2
  const ph  = HEADER_H + PAD_Y * 2
    + (logged.length ? GROUP_H + logged.length * LINE_H : 0)
    + (anon.length ? GROUP_H + anon.length * LINE_H : 0)
  const px  = MX - 1
  const py  = MY + SZ + 5

  ctx.globalAlpha = 0.82
  ctx.fillStyle = '#010709'
  ctx.fillRect(px, py, pw, ph)
  ctx.globalAlpha = 1
  ctx.strokeStyle = C + '33'; ctx.lineWidth = 0.5
  ctx.strokeRect(px, py, pw, ph)

  ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  ctx.fillStyle = C + 'bb'
  ctx.fillText(`WALLETS ${loggedTotal} · ANON ${anonTotal}`, px + PAD_X, py + PAD_Y)

  let ly = py + PAD_Y + HEADER_H
  const drawGroup = (label, entries) => {
    if (!entries.length) return
    ctx.font = 'bold 7px monospace'; ctx.fillStyle = '#526172'; ctx.textAlign = 'left'
    ctx.fillText(label, px + PAD_X, ly)
    ly += GROUP_H
    for (const { w, isAnon, isBot, stolen } of entries) {
    const isMe = w.toLowerCase() === (myWallet || '').toLowerCase()
    const col  = isMe ? C : isAnon ? '#5a7080' : colorFromAddress(w)
    const label = isAnon
      ? w
      : `${w.slice(0, 6)}…${w.slice(-3)}${isBot ? ' B' : ''}`
    ctx.font = `${isMe ? 'bold ' : ''}9px monospace`
    ctx.textAlign = 'left'
    ctx.fillStyle = col
    ctx.fillText(label, px + PAD_X, ly)
    if (stolen > 0) {
      ctx.fillStyle = '#4ade8099'
      ctx.textAlign = 'right'
      ctx.font = '9px monospace'
      ctx.fillText(`+${stolen.toFixed(2)}`, px + pw - PAD_X, ly)
    }
      ly += LINE_H
    }
  }
  drawGroup('WALLETS', logged)
  drawGroup('ANONYMOUS', anon)
  ctx.textAlign = 'left'; ctx.globalAlpha = 1
}

// ── Footstep sound (procedural via Web Audio API) ────────────────────────────
function playStep(audioCtxRef) {
  try {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const sr  = ctx.sampleRate
    const dur = 0.055
    const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr)
    const d   = buf.getChannelData(0)
    // Short noise burst with fast exponential decay → soft floor thud
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.4)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type  = 'lowpass'
    filt.frequency.value = 210
    const gain = ctx.createGain()
    gain.gain.value = 0.09
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
    src.start()
  } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MiningChain3DFPV({
  cellMap, presenceMap, myWallet, presenceKey, myColor,
  initRow, initCol, jumpToCell,
  onPositionChange, onFacingChange, onWantNavigate, onPositionRealtime,
  onPvpHit, pvpStolen,
  onChainSolveOpen, externalPvpFlash, externalKnockback, externalPush, onCollisionPush,
  swingMap, myPoolCode,
  anonKillMsg,
  playerLevel, playerNftjiCount, walletNftjis, myNftjis,
  healthMap,
  currency = 'EUR',
  es,
}) {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)
  const [, setPointerLocked] = useState(false)
  const keysRef      = useRef({w:false,s:false,a:false,d:false,q:false,e:false,space:false,shift:false})
  const playerRef    = useRef({
    x:((initCol??14)+0.5)*CELL_SIZE,
    y:((initRow??14)+0.5)*CELL_SIZE,
    angle:0,
    pitch:0,
    z:0, vz:0, jumps:0,
  })
  const walkDistRef        = useRef(0)
  const audioCtxRef        = useRef(null)
  const stepCountRef       = useRef(0)
  const lastRealtimeRef    = useRef(0)
  const notifRef           = useRef(null)
  const facingKeyRef  = useRef(null)
  const actionUrlRef  = useRef(null)
  const cellMapRef    = useRef(cellMap)
  const presenceRef   = useRef(presenceMap)
  const myWalletRef   = useRef(myWallet)
  const currencyRef   = useRef(currency)
  const presenceKeyRef = useRef(presenceKey||myWallet)
  const esRef         = useRef(es)
  const onWantNavRef  = useRef(onWantNavigate)
  const dragRef       = useRef(null)
  const joystickRef   = useRef({x:0,y:0,pointerId:null})
  const joystickPadRef = useRef(null)
  const joystickKnobRef = useRef(null)
  const cameraVisualRef = useRef({z:0,pitch:0,last:0})
  const animRef       = useRef(null)
  const lastFrameRef  = useRef(0)
  const velocityRef   = useRef({x:0,y:0})
  const lastSentStateRef = useRef(null)
  const swingEpochRef = useRef(0)
  const remoteVisualsRef = useRef(new Map())
  const lastRemoteFrameRef = useRef(0)
  const lastAmbientRenderRef = useRef(0)
  const renderRef     = useRef(null)
  const lastCellRef   = useRef({row:initRow??14,col:initCol??14})
  const zBufferRef    = useRef(null)
  // Pickaxe / mining
  const swingStartRef   = useRef(-9999)
  const hitDoneRef      = useRef(false)
  const mineProgressRef = useRef(0)
  const mineTargetRef   = useRef(null)
  const mineTypeRef     = useRef('empty')
  const facingDataRef   = useRef({ mx:-1, my:-1, cell:null })
  // PvP
  const enemyTargetRef  = useRef(null)   // { wallet, dist, isAnon }
  const pvpFlashRef     = useRef(0)      // timestamp of last pvp strike (for red flash)
  const pvpGainRef      = useRef(null)   // { text, at } for "+X EUR" popup
  const onPvpHitRef          = useRef(onPvpHit)
  const pvpStolenRef         = useRef(pvpStolen || {})
  const chainStatsRef        = useRef(null)
  const onChainSolveOpenRef  = useRef(onChainSolveOpen)
  const swingMapRef          = useRef(swingMap || {})
  const myPoolCodeRef        = useRef(myPoolCode || null)
  // Precomputed from cellMap: Map<key,{base,label}> of currently active obstacles
  const validObstaclesRef   = useRef(new Map(OBSTACLE_MAP))
  const chainNodePosRef     = useRef({ row: CHAIN_NODE_ROW, col: CHAIN_NODE_COL })
  // Anon collision push
  const onCollisionPushRef      = useRef(onCollisionPush)
  const collisionPushThrottleRef = useRef(new Map())
  // Critical hit system
  const critChanceRef       = useRef(0.05)
  const critFlashRef        = useRef(-9999)
  const walletNftjisRef     = useRef(walletNftjis || {})
  const myNftjisRef         = useRef(myNftjis || [])
  const healthMapRef        = useRef(healthMap||{})

  // Keep refs in sync with props
  useEffect(()=>{ cellMapRef.current=cellMap },[cellMap])
  useEffect(()=>{ presenceRef.current=presenceMap },[presenceMap])
  useEffect(()=>{ myWalletRef.current=myWallet },[myWallet])
  useEffect(()=>{ currencyRef.current=currency },[currency])
  useEffect(()=>{ presenceKeyRef.current=presenceKey||myWallet },[presenceKey,myWallet])
  useEffect(()=>{ esRef.current=es },[es])
  useEffect(()=>{ onWantNavRef.current=onWantNavigate },[onWantNavigate])
  useEffect(()=>{ onPvpHitRef.current=onPvpHit },[onPvpHit])
  useEffect(()=>{ pvpStolenRef.current=pvpStolen||{} },[pvpStolen])
  useEffect(()=>{ onChainSolveOpenRef.current=onChainSolveOpen },[onChainSolveOpen])
  useEffect(()=>{ onCollisionPushRef.current=onCollisionPush },[onCollisionPush])
  useEffect(()=>{ swingMapRef.current=swingMap||{} },[swingMap])
  useEffect(()=>{ myPoolCodeRef.current=myPoolCode||null },[myPoolCode])
  useEffect(()=>{ walletNftjisRef.current=walletNftjis||{} },[walletNftjis])
  useEffect(()=>{ myNftjisRef.current=myNftjis||[] },[myNftjis])
  useEffect(()=>{ healthMapRef.current=healthMap||{} },[healthMap])
  // Crit chance: 5% if player owns a ❤️ NFTJI (heart skill), 0% otherwise
  useEffect(()=>{
    const hasHeart = (myNftjis||[]).some(n => n.emoji === '❤️')
    critChanceRef.current = hasHeart ? 0.05 : 0
  },[myNftjis])
  // External hit flash (victim sees red screen when struck by another player)
  useEffect(()=>{ if(externalPvpFlash) pvpFlashRef.current=performance.now() },[externalPvpFlash])
  // PvP knockback: apply velocity impulse away from attacker when hit
  useEffect(()=>{
    if(!externalKnockback) return
    const p=playerRef.current
    const attPos=remoteVisualsRef.current.get(externalKnockback.attacker)
    const myGX=p.x/CELL_SIZE, myGY=p.y/CELL_SIZE
    let dx,dy
    if(attPos){ dx=myGX-attPos.gx; dy=myGY-attPos.gy }
    else { dx=-Math.cos(p.angle); dy=-Math.sin(p.angle) }
    const len=Math.hypot(dx,dy)||1
    velocityRef.current.x+=(dx/len)*160
    velocityRef.current.y+=(dy/len)*160
  },[externalKnockback])
  // Anon collision push: apply velocity impulse in the received direction
  useEffect(()=>{
    if(!externalPush) return
    velocityRef.current.x += (externalPush.dx || 0) * 100
    velocityRef.current.y += (externalPush.dy || 0) * 100
  },[externalPush])
  // Kill notification from other players (spectator kill feed)
  useEffect(()=>{
    if(anonKillMsg) notifRef.current = { text: anonKillMsg, color: '#f97316', startedAt: Date.now() }
  },[anonKillMsg])

  // Recompute valid obstacles (Map<key,data>) and chain node position whenever cellMap changes
  useEffect(() => {
    // Find chain node position from cellMap
    let cnRow = CHAIN_NODE_ROW, cnCol = CHAIN_NODE_COL
    for (const [key, cell] of cellMap) {
      if (cell.isChainNode) {
        const [r,c] = key.split(',').map(Number)
        cnRow = r; cnCol = c; break
      }
    }
    chainNodePosRef.current = { row: cnRow, col: cnCol }

    // Interactive/mining cells are immutable landmarks. Obstacles may shape
    // corridors around them, but can never replace them or block every approach.
    const reserved = new Set()
    for(const [key] of cellMap){
      const [r,c]=key.split(',').map(Number)
      reserved.add(key)
      for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) reserved.add(`${r+dr},${c+dc}`)
    }
    const valid = new Map()
    for (const [key, data] of OBSTACLE_MAP) {
      if(!reserved.has(key)) valid.set(key, chainObstacle(key,data))
    }

    // Dynamic wall segments: sampled on a 4-cell grid, ~22% become wall origins
    // Each origin spawns a 2–4 cell segment (horiz or vert) → looks like maze walls
    const DYN = [
      { base:W_STONE, label:'WALL' },
      { base:W_SLATE, label:'WALL' },
      { base:W_SAND,  label:'WALL' },
      { base:W_DARK,  label:'WALL' },
    ]
    for (let r = 4; r < MM3_BLOCK_GRID_ROWS-4; r += 4) {
      for (let c = 4; c < MM3_BLOCK_GRID_COLS-4; c += 4) {
        if (Math.abs(r-14) <= 5 && Math.abs(c-14) <= 5) continue  // keep center zone free
        const h = (((r * 31 + c * 17) ^ (r * c * 7)) % 100 + 100) % 100
        if (h >= 22) continue  // ~22% become wall origins
        const isHoriz = ((r * 13 + c * 7) & 1) === 0
        const len = 2 + ((r * 7 + c * 11) % 3)  // 2–4 cells
        const wallData = DYN[(r + c) % 4]
        for (let i = 0; i < len; i++) {
          const wr = isHoriz ? r : r + i
          const wc = isHoriz ? c + i : c
          if (wr < 2 || wr >= MM3_BLOCK_GRID_ROWS-2 || wc < 2 || wc >= MM3_BLOCK_GRID_COLS-2) break
          const key = `${wr},${wc}`
          // Only fill truly empty positions — never override NFTJI/mined blocks
          if (!reserved.has(key) && !valid.has(key)) valid.set(key, chainObstacle(key,wallData))
        }
      }
    }
    validObstaclesRef.current = valid

    // Safety: if player is inside an obstacle or block, teleport to a random free cell
    const sgr = Math.floor(playerRef.current.y / CELL_SIZE)
    const sgc = Math.floor(playerRef.current.x / CELL_SIZE)
    if (valid.has(`${sgr},${sgc}`) || cellMap.has(`${sgr},${sgc}`)) {
      const free = findRandomFreeCell(cellMap, valid)
      playerRef.current.x = (free.col + 0.5) * CELL_SIZE
      playerRef.current.y = (free.row + 0.5) * CELL_SIZE
    }
  }, [cellMap])

  useEffect(()=>{
    let owned=0, marketFree=0, marketOwned=0
    for (const cell of cellMap.values()) {
      if (cell.owner) { owned++; if (cell.isMarket) marketOwned++ }
      else if (cell.isMarket) marketFree++
    }
    const total = MM3_BLOCK_GRID_ROWS * MM3_BLOCK_GRID_COLS
    chainStatsRef.current = { owned, marketFree, marketOwned, total, pct: Math.round(owned/total*100) }
  },[cellMap])

  const onPositionRealtimeRef = useRef(onPositionRealtime)
  useEffect(()=>{ onPositionRealtimeRef.current=onPositionRealtime },[onPositionRealtime])

  // External teleport — fallback to random free cell if target is blocked
  useEffect(()=>{
    if (!jumpToCell) return
    const obs = validObstaclesRef.current
    const cm  = cellMapRef.current
    const k   = `${jumpToCell.row},${jumpToCell.col}`
    if (obs.has(k) || cm.has(k)) {
      const free = findRandomFreeCell(cm, obs)
      playerRef.current.x = (free.col + 0.5) * CELL_SIZE
      playerRef.current.y = (free.row + 0.5) * CELL_SIZE
    } else {
      playerRef.current.x = (jumpToCell.col + 0.5) * CELL_SIZE
      playerRef.current.y = (jumpToCell.row + 0.5) * CELL_SIZE
    }
    renderRef.current?.()
  },[jumpToCell])

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderFrame = useCallback(()=>{
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Number(canvas.dataset.dpr) || 1
    const W = Math.round(canvas.width / dpr)
    const H = Math.round(canvas.height / dpr)
    if (!W||!H) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false

    const cellMap  = cellMapRef.current
    const rawPresence = presenceRef.current
    const myWallet = myWalletRef.current
    const myIdentity = presenceKeyRef.current||myWallet
    const es       = esRef.current

    // Smooth network updates once per rendered frame. World sprites and the
    // minimap consume this same map, so they cannot drift apart visually.
    const remoteNow = performance.now()
    const remoteDt = lastRemoteFrameRef.current
      ? Math.min(0.05,(remoteNow-lastRemoteFrameRef.current)/1000)
      : 1/60
    lastRemoteFrameRef.current = remoteNow
    const remoteBlend = 1-Math.exp(-14*remoteDt)
    const visuals = remoteVisualsRef.current
    for(const [w,target] of Object.entries(rawPresence||{})){
      const tx=target.gx??((target.col??0)+0.5), ty=target.gy??((target.row??0)+0.5)
      let current=visuals.get(w)
      if(!current){ current={...target,gx:tx,gy:ty,z:Number(target.z)||0}; visuals.set(w,current) }
      current.gx += (tx-current.gx)*remoteBlend
      current.gy += (ty-current.gy)*remoteBlend
      current.z += ((Number(target.z)||0)-current.z)*remoteBlend
      current.row=Math.floor(current.gy); current.col=Math.floor(current.gx)
      current.angle=Number(target.angle)||0
      current.pitch=Number(target.pitch)||0
      current.swingAt=Number(target.swingAt)||current.swingAt||0
      current.poolCode=target.poolCode||null
      current.isBot=Boolean(target.isBot)
      current.task=target.task||null
      current.taskLabel=target.taskLabel||null
      current.taskPhase=target.taskPhase||null
    }
    for(const w of visuals.keys()) if(!rawPresence?.[w]) visuals.delete(w)
    const presence=Object.fromEntries(visuals)

    const {x:px,y:py,angle,pitch:rawPitch=0,z:rawZ=0} = playerRef.current
    const cameraNow=performance.now(),cameraVisual=cameraVisualRef.current
    const cameraDt=cameraVisual.last?Math.min(.05,(cameraNow-cameraVisual.last)/1000):1/60
    cameraVisual.last=cameraNow
    const cameraBlend=1-Math.exp(-18*cameraDt)
    cameraVisual.z+=(rawZ-cameraVisual.z)*cameraBlend
    cameraVisual.pitch+=(rawPitch-cameraVisual.pitch)*cameraBlend
    const pz=cameraVisual.z,pitch=cameraVisual.pitch
    const viewCenterY = H * HORIZON_RATIO
    // Capped rays make finer ultrawide strips affordable without traversing
    // the whole 56-cell world for every screen column.
    const stripW=W<=1600?2:STRIP_W
    const strips=Math.ceil(W/stripW)

    if (!zBufferRef.current || zBufferRef.current.length !== strips) {
      zBufferRef.current = new Float32Array(strips)
    }
    const zBuffer = zBufferRef.current

    const cameraBobZ = pz > 0 ? 0 : Math.sin(walkDistRef.current*0.12) * 0.012
    const cameraZ = pz + CAMERA_EYE_Z + cameraBobZ
    const projectionScale = H * PROJ_DIST
    const pitchSin = Math.sin(pitch)
    const pitchCos = Math.cos(pitch)
    const cameraPoint = (worldZ, depth) => {
      const relZ = worldZ - cameraZ
      const rotatedDepth = depth * pitchCos - relZ * pitchSin
      const rotatedVertical = relZ * pitchCos + depth * pitchSin
      return { rotatedDepth, rotatedVertical }
    }
    const projectY = (worldZ, depth) => {
      const { rotatedDepth, rotatedVertical } = cameraPoint(worldZ, depth)
      if (rotatedDepth <= 0.01) return rotatedVertical > 0 ? -H * 4 : H * 4
      return viewCenterY - rotatedVertical * projectionScale / rotatedDepth
    }
    const horizon = viewCenterY - Math.tan(pitch) * projectionScale
    const sceneSplitY = Math.max(0, Math.min(H, horizon))
    const horizontalProjection = W/(2*Math.tan(FOV/2))
    const cameraVertex=(gx,gy,worldZ)=>{
      const rx=gx-px/CELL_SIZE,ry=gy-py/CELL_SIZE
      const depth=Math.cos(angle)*rx+Math.sin(angle)*ry
      const lateral=-Math.sin(angle)*rx+Math.cos(angle)*ry
      const relZ=worldZ-cameraZ
      return {
        lateral,
        depth:depth*pitchCos-relZ*pitchSin,
        vertical:relZ*pitchCos+depth*pitchSin,
      }
    }
    const horizontalCameraPoint=(gx,gy)=>{
      const rx=gx-px/CELL_SIZE,ry=gy-py/CELL_SIZE
      return {
        depth:Math.cos(angle)*rx+Math.sin(angle)*ry,
        lateral:-Math.sin(angle)*rx+Math.cos(angle)*ry,
        dist:Math.hypot(rx,ry),
      }
    }
    const clipNear=(vertices,near=0.06)=>{
      const out=[]
      for(let i=0;i<vertices.length;i++){
        const a=vertices[i],b=vertices[(i+1)%vertices.length]
        const aIn=a.depth>near,bIn=b.depth>near
        if(aIn) out.push(a)
        if(aIn!==bIn){
          const t=(near-a.depth)/(b.depth-a.depth)
          out.push({
            lateral:a.lateral+(b.lateral-a.lateral)*t,
            depth:near,
            vertical:a.vertical+(b.vertical-a.vertical)*t,
          })
        }
      }
      return out
    }
    const screenVertex=v=>({
      x:W/2+v.lateral*horizontalProjection/v.depth,
      y:viewCenterY-v.vertical*projectionScale/v.depth,
    })
    const projectSegment=(a,b)=>{
      let va=cameraVertex(...a),vb=cameraVertex(...b)
      const near=0.06
      if(va.depth<=near&&vb.depth<=near) return null
      if(va.depth<=near||vb.depth<=near){
        const t=(near-va.depth)/(vb.depth-va.depth)
        const mid={lateral:va.lateral+(vb.lateral-va.lateral)*t,depth:near,vertical:va.vertical+(vb.vertical-va.vertical)*t}
        if(va.depth<=near) va=mid; else vb=mid
      }
      return [screenVertex(va),screenVertex(vb),Math.min(va.depth,vb.depth)]
    }

    // Atmospheric tint from current room
    const {row:gr,col:gc} = worldToGrid(px,py)
    const viewMinRow=Math.max(0,gr-VISUAL_RANGE)
    const viewMaxRow=Math.min(ROWS-1,gr+VISUAL_RANGE)
    const viewMinCol=Math.max(0,gc-VISUAL_RANGE)
    const viewMaxCol=Math.min(COLS-1,gc+VISUAL_RANGE)
    const curCell = cellMap.get(`${gr},${gc}`)
    // A cell directly below the player is a platform, not the room containing
    // the camera. Do not recolor the whole scene when landing on top of it.
    const atmosphereCell = pz < BLOCK_TOP ? curCell : null
    const [ar,ag,ab] = atmosphereCell?.color ? hexToRgb(atmosphereCell.color) : [0,0,0]
    const AT = 0.18

    // Ceiling — brighter base values
    const cg = ctx.createLinearGradient(0,0,0,Math.max(1,sceneSplitY))
    cg.addColorStop(0,`rgb(${Math.round(8+ar*AT)},${Math.round(13+ag*AT)},${Math.round(34+ab*AT)})`)
    cg.addColorStop(1,`rgb(${Math.round(16+ar*AT)},${Math.round(26+ag*AT)},${Math.round(62+ab*AT)})`)
    ctx.fillStyle=cg; ctx.fillRect(0,0,W,sceneSplitY)

    // Base fill behind the projected world floor.
    const [_fr, _fg2, _fb] = [22+Math.round(ar*AT), 36+Math.round(ag*AT), 72+Math.round(ab*AT)]
    const [_fr2, _fg3, _fb2] = [6+Math.round(ar*AT*.5), 10+Math.round(ag*AT*.5), 20+Math.round(ab*AT*.5)]
    // Floor: darker at horizon (far), brighter near feet (near-lit mine)
    const fg = ctx.createLinearGradient(0,sceneSplitY,0,H)
    fg.addColorStop(0,`rgb(${_fr2},${_fg3},${_fb2})`)
    fg.addColorStop(1,`rgb(${_fr},${_fg2},${_fb})`)
    ctx.fillStyle=fg; ctx.fillRect(0,sceneSplitY,W,H-sceneSplitY)

    // World-space grid made from projected cell edges. This is dramatically
    // cheaper than per-pixel floor casting and remains stable during motion.
    const solidHeightAt=(gx,gy)=>{
      const row=Math.floor(gy),col=Math.floor(gx),key=`${row},${col}`
      if(validObstaclesRef.current.has(key)) return OBSTACLE_TOP
      if(cellMap.has(key)) return BLOCK_TOP
      return 0
    }
    ctx.globalAlpha=.12;ctx.strokeStyle=C;ctx.lineWidth=1;ctx.beginPath()
    for(let c=viewMinCol;c<=viewMaxCol+1;c++){
      const seg=projectSegment([c,viewMinRow,0],[c,viewMaxRow+1,0]); if(!seg) continue
      const [a,b,d]=seg;if((a.y<sceneSplitY&&b.y<sceneSplitY)||d>VISUAL_RANGE) continue
      ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)
    }
    for(let r=viewMinRow;r<=viewMaxRow+1;r++){
      const seg=projectSegment([viewMinCol,r,0],[viewMaxCol+1,r,0]); if(!seg) continue
      const [a,b,d]=seg;if((a.y<sceneSplitY&&b.y<sceneSplitY)||d>VISUAL_RANGE) continue
      ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)
    }
    ctx.stroke();ctx.globalAlpha=1

    // Visible block tops are clipped polygons and are rendered before walls;
    // wall strips therefore occlude them cleanly without jagged overlaps.
    const tops=[]
    for(let r=viewMinRow;r<=viewMaxRow;r++) for(let c=viewMinCol;c<=viewMaxCol;c++){
      const topCamera=horizontalCameraPoint(c+.5,r+.5)
      if(topCamera.dist>TOP_RANGE||topCamera.depth<-.65) continue
      if(Math.abs(topCamera.lateral)>Math.max(1.15,topCamera.depth*Math.tan(FOV/2)+.9)) continue
      const topHeight=solidHeightAt(c+.5,r+.5)
      if(!topHeight||cameraZ<=topHeight+.015) continue
      // Never project the platform directly under the camera. Its near-clipped
      // polygon otherwise expands across the screen when the player climbs it.
      if(r===gr&&c===gc&&pz>=topHeight-.03) continue
      const verts=clipNear([
        cameraVertex(c,r,topHeight),cameraVertex(c+1,r,topHeight),
        cameraVertex(c+1,r+1,topHeight),cameraVertex(c,r+1,topHeight),
      ])
      if(verts.length<3) continue
      const points=verts.map(screenVertex)
      if(points.every(p=>p.x<-2||p.x>W+2||p.y<-2||p.y>H+2)) continue
      const depth=verts.reduce((sum,v)=>sum+v.depth,0)/verts.length
      tops.push({r,c,points,depth,topHeight})
    }
    tops.sort((a,b)=>b.depth-a.depth)
    for(const top of tops){
      const key=`${top.r},${top.c}`,obs=validObstaclesRef.current.get(key),cell=cellMap.get(key)
      const base=obs?.base||(cell?.color?hexToRgb(cell.color):cell?.isChainNode?[220,170,25]:[48,82,142])
      const light=Math.max(.48,1-top.depth*.025)
      ctx.fillStyle=`rgb(${Math.round(base[0]*light)},${Math.round(base[1]*light)},${Math.round(base[2]*light)})`
      ctx.strokeStyle='rgba(220,240,255,.32)';ctx.lineWidth=1
      ctx.beginPath();ctx.moveTo(top.points[0].x,top.points[0].y)
      for(let i=1;i<top.points.length;i++)ctx.lineTo(top.points[i].x,top.points[i].y)
      ctx.closePath();ctx.fill();ctx.stroke()
      if(top.depth<10){
        const a=projectSegment([top.c+.5,top.r,top.topHeight+.003],[top.c+.5,top.r+1,top.topHeight+.003])
        const b=projectSegment([top.c,top.r+.5,top.topHeight+.003],[top.c+1,top.r+.5,top.topHeight+.003])
        ctx.strokeStyle='rgba(0,0,0,.16)';ctx.beginPath()
        if(a){ctx.moveTo(a[0].x,a[0].y);ctx.lineTo(a[1].x,a[1].y)}
        if(b){ctx.moveTo(b[0].x,b[0].y);ctx.lineTo(b[1].x,b[1].y)}
        ctx.stroke()
      }
    }

    // Pre-compute forward cell
    const {mx:fwdMx,my:fwdMy,cell:fwdCell,perpDist:fwdDist,side:fwdSide} = castRay(px,py,angle,cellMap,validObstaclesRef.current)
    // Only fire HUD when the ray hit a clearly solid face (not near the doorway boundary).
    // Near-doorway hits produce thin slivers the player barely notices — suppress the HUD there.
    const _fgx=px/CELL_SIZE,_fgy=py/CELL_SIZE
    const _fR=fwdSide===0?(_fgy+fwdDist*Math.sin(angle)):(_fgx+fwdDist*Math.cos(angle))
    const _fHF=((_fR%1)+1)%1
    const fwdFaceSolid=_fHF<(DOOR_LO-0.08)||_fHF>(DOOR_HI+0.08)

    // Collect cells with emoji visible on any wall face
    const visibleWalls = new Map()

    // ── Wall strips + build zBuffer ───────────────────────────────────────────
    for (let col=0; col<strips; col++){
      const ra = angle - FOV/2 + (col+0.5)*FOV/strips
      const {perpDist,cell,side,mx:hitMx,my:hitMy,hit} = castRay(px,py,ra,cellMap,validObstaclesRef.current,VISUAL_RANGE)
      const dist  = perpDist*Math.cos(ra-angle)
      zBuffer[col] = dist
      if(!hit||!cell) continue
      const wallTop = cell?.isObstacle ? OBSTACLE_TOP : BLOCK_TOP
      const projectedTop = projectY(wallTop, dist)
      const projectedBottom = projectY(0, dist)
      const wTop = Math.round(Math.min(projectedTop, projectedBottom))
      const wallH = Math.min(H * 8, Math.max(1, Math.abs(projectedBottom - projectedTop)))

      // Collect emoji cells (all visible wall faces, not just forward)
      if (cell?.emoji && hitMx >= 0 && hitMy >= 0) {
        const k = `${hitMx},${hitMy}`
        const vw = visibleWalls.get(k)
        if (!vw) {
          visibleWalls.set(k, { x1:col*stripW, x2:col*stripW+stripW, wTop, wallH, dist, cell })
        } else {
          vw.x2 = col*stripW+stripW
          if (dist < vw.dist) { vw.dist=dist; vw.wTop=wTop; vw.wallH=wallH }
        }
      }

      const [rw,gw,bw] = wallRgb(cell,dist,side,myWallet)

      ctx.fillStyle=`rgb(${rw},${gw},${bw})`
      ctx.fillRect(col*stripW,wTop,stripW,wallH)

      // NFTJI block patterns
      if (cell?.isMarket) {
        if (!cell.owner) {
          // Unowned NFTJI: amber diagonal stripes.
          const stripeH = Math.max(3, Math.round(wallH/6))
          for (let sy=wTop; sy<wTop+wallH; sy+=stripeH*2) {
            ctx.fillStyle = 'rgba(251,146,60,0.22)'
            ctx.fillRect(col*stripW, sy, stripW, Math.min(stripeH, wTop+wallH-sy))
          }
        } else {
          const isMe = myWallet && cell.owner.toLowerCase() === myWallet.toLowerCase()
          if (isMe) {
            // My NFTJI block: cyan shimmer
            ctx.fillStyle = 'rgba(34,211,238,0.18)'
            ctx.fillRect(col*stripW, wTop, stripW, wallH)
          } else {
            const [mr,mg,mb] = hexToRgb(cell.color)
            ctx.fillStyle = `rgba(${mr},${mg},${mb},0.15)`
            ctx.fillRect(col*stripW, wTop, stripW, wallH)
          }
        }
      }

      if (!cell?.isObstacle) {
        // Cube top highlight — bright ledge (blocks only, not walls)
        if (wallH > 8) {
          const hlH = Math.max(2, Math.round(wallH*0.035))
          ctx.fillStyle = 'rgba(255,255,255,0.14)'
          ctx.fillRect(col*stripW, wTop, stripW, hlH)
        }
        // Ambient-occlusion edges (blocks only — walls are continuous, no float)
        const edgeH = Math.max(2,Math.round(wallH*0.12))
        ctx.fillStyle='rgba(0,0,0,0.28)'
        ctx.fillRect(col*stripW,wTop,stripW,edgeH)
        ctx.fillRect(col*stripW,wTop+wallH-edgeH,stripW,edgeH)
      } else if(col%3===0) {
        // Blockchain architecture: each obstacle family has a cheap strip-based
        // material pattern, keeping the maze varied without textures or meshes.
        const [or,og,ob] = cell.base
        const [lr,lg,lb] = cell.glow || [34,211,238]
        const panelH = Math.max(5, Math.round(wallH / 4))
        if(cell.kind==='hash'){
          for(let sy=wTop;sy<wTop+wallH;sy+=panelH){
            ctx.fillStyle=`rgba(${lr},${lg},${lb},.28)`;ctx.fillRect(col*stripW,sy,stripW*3,1)
          }
          if(((col/3)|0)%4===0){ctx.fillStyle=`rgba(${lr},${lg},${lb},.20)`;ctx.fillRect(col*stripW,wTop,1,wallH)}
        } else if(cell.kind==='ledger'){
          for(let sy=wTop+panelH*.35;sy<wTop+wallH;sy+=panelH){
            ctx.fillStyle='rgba(2,8,18,.42)';ctx.fillRect(col*stripW,sy,stripW*3,2)
            ctx.fillStyle=`rgba(${lr},${lg},${lb},.20)`;ctx.fillRect(col*stripW,sy+2,stripW*3,1)
          }
        } else if(cell.kind==='consensus'){
          const pulse=.16+(Math.sin(Date.now()/420+hitMx*.7+hitMy)*.5+.5)*.18
          ctx.fillStyle=`rgba(${lr},${lg},${lb},${pulse})`;ctx.fillRect(col*stripW,wTop,stripW*3,wallH)
          for(let sy=wTop+panelH;sy<wTop+wallH;sy+=panelH*2){ctx.fillStyle='rgba(2,8,18,.48)';ctx.fillRect(col*stripW,sy,stripW*3,2)}
        } else {
          for(let sy=wTop+panelH*.5;sy<wTop+wallH;sy+=panelH){
            ctx.fillStyle=`rgba(${lr},${lg},${lb},.32)`;ctx.fillRect(col*stripW,sy,Math.max(1,stripW),2)
          }
          if(((col/3)|0)%3===0){ctx.fillStyle=`rgba(${lr},${lg},${lb},.26)`;ctx.fillRect(col*stripW+1,wTop,1,wallH)}
        }
      }

      // Chain node shimmer
      if (cell?.isChainNode) {
        const a = (0.14 + Math.sin(Date.now() / 420) * 0.10).toFixed(3)
        ctx.fillStyle = `rgba(255,220,0,${a})`
        ctx.fillRect(col*stripW, wTop, stripW, wallH)
      }

      // Forward-cell selection glow — blocks only, never walls
      if (hitMx===fwdMx && hitMy===fwdMy && fwdMx>=0 && cell && !cell.isObstacle){
        ctx.fillStyle='rgba(34,211,238,0.11)'
        ctx.fillRect(col*stripW,wTop,stripW,wallH)
      }

      // CRT scanlines on blocks only (not structural walls)
      if (!cell?.isObstacle&&col%3===0) {
        ctx.fillStyle='rgba(0,0,0,0.10)'
        for (let sy=wTop;sy<wTop+wallH;sy+=5) ctx.fillRect(col*stripW,sy,stripW*3,1)
      }
    }

    // ── Emoji on all visible wall faces ──────────────────────────────────────
    for (const vw of visibleWalls.values()) {
      const scrX = (vw.x1 + vw.x2) / 2
      const scrY = vw.wTop + vw.wallH / 2
      const sz   = Math.max(14, Math.round(vw.wallH * 0.46))
      const a    = Math.min(0.92, Math.max(0.1, 1 - vw.dist * 0.065))
      ctx.globalAlpha = a
      ctx.font = `${sz}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(vw.cell.emoji, scrX, scrY)
    }
    ctx.globalAlpha = 1

    // ── Presence sprites (retro wallet shape, grounded to floor) ────────────────
    const camGX = px / CELL_SIZE, camGY = py / CELL_SIZE
    const sprites = []
    for (const [w, pres] of Object.entries(presence || {})) {
      if (pres.row == null && pres.gy == null) continue
      const isMe = w.toLowerCase() === (myIdentity || '').toLowerCase()
      if (isMe) continue
      const sgx = pres.gx ?? ((pres.col ?? 0) + 0.5)
      const sgy = pres.gy ?? ((pres.row ?? 0) + 0.5)
      const rx = sgx - camGX
      const ry = sgy - camGY
      const tY = Math.cos(angle)*rx + Math.sin(angle)*ry
      if (tY < 0.08) continue
      // Fixed sign: right vector is (-sin, cos) so tX = -sin*rx + cos*ry
      const tX   = -Math.sin(angle)*rx + Math.cos(angle)*ry
      const dist  = Math.sqrt(rx*rx + ry*ry)
      if (dist > VISUAL_RANGE) continue
      const remoteZ=Number(pres.z)||0
      const solidHeight=solidHeightAt(sgx,sgy)
      const supportZ=solidHeight&&remoteZ>=solidHeight?solidHeight:0
      sprites.push({
        w, tX, tY, dist, z:remoteZ, supportZ,
        angle:Number(pres.angle)||0, swingAt:Number(pres.swingAt)||0,
        isBot:Boolean(pres.isBot), taskLabel:pres.taskLabel||null, taskPhase:pres.taskPhase||null,
        color: colorFromAddress(w),
      })
    }
    sprites.sort((a,b) => b.dist - a.dist)

    for (const { w, tX, tY, z:remoteZ, supportZ, angle:remoteAngle, swingAt, isBot, taskLabel, taskPhase, color } of sprites) {
      const groundCamera = cameraPoint(0, tY)
      if (groundCamera.rotatedDepth <= 0.05) continue
      const scrX = Math.round(W/2 + tX*horizontalProjection/groundCamera.rotatedDepth)
      const [cr,cg2,cb] = hexToRgb(color)
      const fade  = Math.max(0.32, 1 - tY*0.038)   // slower darkening at distance
      const alpha = Math.min(0.98, Math.max(0.12, 1.0 - tY*0.028)) // visible up to ~30 cells

      // Perspective-correct grounding. Remote avatars use the same visual scale
      // as the local third-person avatar and are capped at close range.
      const stableDepth = Math.max(0.72,groundCamera.rotatedDepth)
      const cellScale = projectionScale/stableDepth
      const bottomY   = Math.min(H+30,Math.round(projectY(remoteZ,tY)))
      const sScale    = Math.min(cellScale,150)
      const walletH   = Math.round(sScale * 0.58)
      const walletW   = Math.round(sScale * 0.50)
      const billsH    = Math.round(sScale * 0.20)
      const billsW    = Math.round(walletW * 0.44)
      const walletTop = bottomY - walletH
      const billsTop  = walletTop - billsH
      const foldY     = Math.round(walletTop + walletH * 0.44)
      const claspH    = Math.max(2, Math.round(walletH * 0.16))
      const claspY    = Math.round(walletTop + walletH * 0.28)
      const wx1 = scrX - Math.floor(walletW / 2)
      const wx2 = scrX + Math.ceil(walletW / 2)
      const bx1 = scrX - Math.floor(billsW / 2)
      const bx2 = scrX + Math.ceil(billsW / 2)
      const fullLeft  = Math.min(wx1, bx1)
      const fullRight = Math.max(wx2, bx2)

      // Glow outline pass
      for (let sx = fullLeft-1; sx <= fullRight; sx++) {
        const zCol = Math.floor(sx / stripW)
        if (zCol < 0 || zCol >= strips) continue
        if (tY >= zBuffer[zCol]) continue
        ctx.globalAlpha = alpha * 0.28; ctx.fillStyle = color
        if (sx >= bx1-1 && sx <= bx2) ctx.fillRect(sx, billsTop-1, 1, billsH+1)
        if (sx >= wx1-1 && sx <= wx2)  ctx.fillRect(sx, walletTop-1, 1, walletH+2)
      }

      // Wallet body (column-by-column depth-correct)
      for (let sx = fullLeft; sx < fullRight; sx++) {
        const zCol = Math.floor(sx / stripW)
        if (zCol < 0 || zCol >= strips) continue
        if (tY >= zBuffer[zCol]) continue
        const inWallet = sx >= wx1 && sx < wx2
        const inBills  = sx >= bx1 && sx < bx2

        if (inBills) {
          ctx.globalAlpha = alpha * 0.88
          ctx.fillStyle = `rgb(${Math.min(255,Math.round(cr*fade*1.28))},${Math.min(255,Math.round(cg2*fade*1.28))},${Math.min(255,Math.round(cb*fade*1.28))})`
          ctx.fillRect(sx, billsTop, 1, billsH)
          if (billsH > 4) {
            ctx.globalAlpha = alpha * 0.38; ctx.fillStyle = 'rgba(255,255,255,0.55)'
            ctx.fillRect(sx, billsTop + Math.round(billsH*0.22), 1, Math.max(1, Math.round(billsH*0.18)))
          }
        }
        if (inWallet) {
          const isEdge = sx === wx1 || sx === wx2 - 1
          const relX   = (sx - wx1) / Math.max(1, walletW - 1)
          ctx.globalAlpha = alpha
          ctx.fillStyle = `rgb(${Math.round(cr*fade*0.90)},${Math.round(cg2*fade*0.90)},${Math.round(cb*fade*0.90)})`
          ctx.fillRect(sx, walletTop, 1, foldY - walletTop)
          ctx.globalAlpha = alpha * 0.48; ctx.fillStyle = 'rgba(255,255,255,0.30)'
          ctx.fillRect(sx, walletTop + Math.round(walletH*0.12), 1, Math.max(1, Math.round(walletH*0.09)))
          ctx.globalAlpha = alpha
          ctx.fillStyle = `rgb(${Math.round(cr*fade*0.58)},${Math.round(cg2*fade*0.58)},${Math.round(cb*fade*0.58)})`
          ctx.fillRect(sx, foldY, 1, bottomY - foldY)
          ctx.globalAlpha = alpha * 0.72; ctx.fillStyle = 'rgba(0,0,0,0.60)'
          ctx.fillRect(sx, foldY-1, 1, 2)
          if (relX > 0.30 && relX < 0.70) {
            ctx.globalAlpha = alpha * 0.90; ctx.fillStyle = 'rgba(255,195,45,0.90)'
            ctx.fillRect(sx, claspY, 1, claspH)
          }
          if (isEdge) {
            ctx.globalAlpha = alpha * 0.62; ctx.fillStyle = 'rgba(0,0,0,0.72)'
            ctx.fillRect(sx, walletTop, 1, walletH)
          }
        }
      }
      ctx.globalAlpha = 1

      // Shared Freak wallet details: visor, energy core, belt and grounded feet.
      const centerZCol=Math.floor(scrX/stripW)
      if(centerZCol>=0&&centerZCol<strips&&tY<zBuffer[centerZCol]){
        ctx.globalAlpha=alpha
        const visorY=billsTop+Math.round(billsH*.34),visorW=Math.max(4,Math.round(billsW*.68))
        ctx.fillStyle='#071722';ctx.fillRect(scrX-Math.floor(visorW/2),visorY,visorW,Math.max(2,Math.round(billsH*.28)))
        ctx.fillStyle='#67e8f9';ctx.fillRect(scrX-Math.floor(visorW*.36),visorY+1,Math.max(2,Math.round(visorW*.72)),1)
        const shoulderY=walletTop+Math.round(walletH*.10),shoulderW=Math.max(2,Math.round(walletW*.12))
        ctx.fillStyle=`rgb(${Math.round(cr*fade*.48)},${Math.round(cg2*fade*.48)},${Math.round(cb*fade*.48)})`
        ctx.fillRect(wx1-shoulderW,shoulderY,shoulderW,Math.max(3,Math.round(walletH*.24)))
        ctx.fillRect(wx2,shoulderY,shoulderW,Math.max(3,Math.round(walletH*.24)))
        const coreW=Math.max(3,Math.round(walletW*.20)),coreH=Math.max(2,Math.round(walletH*.10))
        ctx.fillStyle='#06131c';ctx.fillRect(scrX-coreW,claspY-1,coreW*2,coreH+2)
        ctx.fillStyle='#facc15';ctx.fillRect(scrX-Math.floor(coreW*.55),claspY,Math.max(2,Math.round(coreW*1.1)),coreH)
        const beltY=walletTop+Math.round(walletH*.70)
        ctx.fillStyle='rgba(2,8,18,.82)';ctx.fillRect(wx1,beltY,walletW,Math.max(2,Math.round(walletH*.06)))
        const bootH=Math.max(2,Math.round(walletH*.09)),bootW=Math.max(3,Math.round(walletW*.28))
        ctx.fillStyle=`rgb(${Math.round(cr*fade*.30)},${Math.round(cg2*fade*.30)},${Math.round(cb*fade*.30)})`
        ctx.fillRect(scrX-Math.round(walletW*.34),bottomY-bootH,bootW,bootH)
        ctx.fillRect(scrX+Math.round(walletW*.06),bottomY-bootH,bootW,bootH)
        ctx.globalAlpha=1
      }

      // Freak Drill-Pick (same tool and swing timing as the local avatar)
      const pkZCol = Math.floor(scrX / stripW)
      if (pkZCol >= 0 && pkZCol < strips && tY < zBuffer[pkZCol]) {
        // The remote is seen from the front, so its anatomical right appears
        // on our screen-left (mirror relation between facing characters).
        const relativeFacing=Math.sin(remoteAngle-angle)
        const pickSide=relativeFacing>=0?-1:1
        const pkBX = scrX + pickSide*Math.round(walletW*0.54)
        const pkBY = Math.round(foldY + walletH * 0.05)
        const pkL  = Math.max(5, Math.round(walletH * 0.55))
        const remoteSwingAge = Date.now()-(swingAt||swingMapRef.current[w]||0)
        const remoteSwingT   = remoteSwingAge < SWING_DUR ? remoteSwingAge / SWING_DUR : 0
        const pkA=-Math.PI/2+pickSide*0.66+pickSide*Math.sin(remoteSwingT*Math.PI)*1.05
        drawFreakDrillPick(ctx,pkBX,pkBY,pkL,pkA,Math.max(.28,pkL/64),alpha*.9)
      }

      // Floor shadow ellipse (at actual floor level)
      if (tY < 8.0) {
        const sAlpha = Math.max(0, (8.0-tY)/8.0)*0.28
        const sw = Math.max(4, Math.round(walletW*0.85))
        const sh = Math.max(2, Math.round(sw*0.18))
        ctx.globalAlpha = sAlpha; ctx.fillStyle = '#000'
        ctx.beginPath()
        const shadowY=Math.min(H+30,Math.round(projectY(supportZ,tY)))
        ctx.ellipse(scrX,shadowY+sh*0.5,sw/2,sh,0,0,Math.PI*2)
        ctx.fill(); ctx.globalAlpha = 1
      }

      // Wallet label above bills
      if (tY < 10.0) {
        const lAlpha = Math.max(0, (10.0-tY)/10.0)*0.88
        const lSize  = Math.max(10, Math.round(13/Math.max(0.5, tY)))
        const pres   = (presence||{})[w]
        const pool   = pres?.poolCode
        ctx.globalAlpha = lAlpha * 0.45; ctx.fillStyle = '#000'
        ctx.font = `bold ${lSize}px monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
        const walletLabel = `${w.slice(0,6)}…${w.slice(-4)}${isBot ? ' (BOT)' : ''}`
        ctx.fillText(walletLabel, scrX+1, billsTop-1)
        ctx.globalAlpha = lAlpha; ctx.fillStyle = color
        ctx.fillText(walletLabel, scrX, billsTop-2)
        let nextLabelY = billsTop - 3 - lSize
        if (pool && tY < 7.0) {
          const pSize = Math.max(8, lSize-2)
          ctx.globalAlpha = lAlpha*0.75; ctx.font = `bold ${pSize}px monospace`
          ctx.fillStyle = '#f59e0b'
          ctx.fillText(`[${pool}]`, scrX, nextLabelY)
          nextLabelY -= pSize + 2
        }
        if (isBot && taskLabel && tY < 8.5) {
          const taskSize = Math.max(8,lSize-2)
          ctx.globalAlpha = lAlpha * .92
          ctx.font = `bold ${taskSize}px monospace`
          ctx.fillStyle = taskPhase === 'respawning' ? '#fb7185' : taskPhase === 'acting' ? '#facc15' : '#67e8f9'
          ctx.fillText(`[${taskLabel}]`, scrX, nextLabelY)
          nextLabelY -= taskSize + 2
        }
        const hp=Math.max(0,Math.min(100,Number(healthMapRef.current[w]??100)))
        const barW=Math.max(22,Math.min(86,walletW*1.15)),barH=Math.max(3,Math.min(7,walletH*.06))
        const barY=nextLabelY-barH-3
        ctx.globalAlpha=lAlpha;ctx.fillStyle='#24070d';ctx.fillRect(scrX-barW/2,barY,barW,barH)
        ctx.fillStyle=hp>60?'#4ade80':hp>25?'#facc15':'#fb7185'
        ctx.fillRect(scrX-barW/2,barY,barW*hp/100,barH)
        ctx.strokeStyle='rgba(255,255,255,.36)';ctx.lineWidth=.5;ctx.strokeRect(scrX-barW/2,barY,barW,barH)
        ctx.globalAlpha = 1
      }
    }

    // ── Wall face overlays — ONLY for mineable blocks, never for structural walls ──
    const fwdProjectedTop = projectY(BLOCK_TOP, fwdDist)
    const fwdProjectedBottom = projectY(0, fwdDist)
    const crosshairHitsFace = viewCenterY >= Math.min(fwdProjectedTop, fwdProjectedBottom)
      && viewCenterY <= Math.max(fwdProjectedTop, fwdProjectedBottom)
    const fwdIsObs = fwdCell?.isObstacle || validObstaclesRef.current?.has(`${fwdMy},${fwdMx}`)
    if (fwdIsObs) {
      // Structural wall: no labels, no hex, no prompts
    } else if (fwdFaceSolid && crosshairHitsFace) {
    const isMineWall = myWallet && fwdCell?.owner?.toLowerCase() === myWallet.toLowerCase()

    // Block title on wall face (medium distance)
    const fwdTitle = fwdCell
      ? (es ? (fwdCell.titleEs||fwdCell.titleEn||'') : (fwdCell.titleEn||fwdCell.titleEs||''))
      : ''
    if (fwdTitle && fwdDist < 2.0) {
      const a   = Math.min(0.82, Math.max(0.05, (2.0-fwdDist)/2.0))
      const wH  = Math.min(H*1.8, H*PROJ_DIST/Math.max(0.1,fwdDist))
      const fs  = Math.max(9, Math.round(13*PROJ_DIST/Math.max(0.5,fwdDist)))
      ctx.globalAlpha = a
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = fwdCell.color || C
      ctx.fillText(fwdTitle, W/2, (fwdProjectedTop + fwdProjectedBottom)/2 + wH*0.14)
      ctx.globalAlpha = 1
    }

    // Hex address label (scales with proximity)
    // Only draw when fwdCell has real data AND label position stays below the obstacle ceiling zone
    const fwdHex = fwdMx>=0&&fwdMy>=0&&fwdCell&&!fwdCell.isChainNode&&!fwdCell.isPortalNode
      ? (fwdCell.blockHex||gridToBlockHex(fwdMy,fwdMx))
      : null
    if (fwdHex && fwdDist < 2.0) {
      const a   = Math.max(0,(2.0-fwdDist)/2.0)*0.52
      const wH  = Math.min(H*1.8,H*PROJ_DIST/Math.max(0.1,fwdDist))
      const labelY = (fwdProjectedTop + fwdProjectedBottom)/2 - wH*0.32
      if (labelY > H * 0.12) {  // skip if label would land in the top 12% (obstacle ceiling zone)
        const fs  = Math.max(9,Math.round(14*PROJ_DIST/Math.max(0.3,fwdDist)))
        ctx.globalAlpha = a
        ctx.font = `bold ${fs}px monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = fwdCell.color || C
        ctx.fillText(fwdHex, W/2, labelY)
        ctx.globalAlpha = 1
      }
    }

    // Owner label on wall (near distance)
    if (fwdCell?.owner && fwdDist < 2.0) {
      const ownerText = isMineWall
        ? (es ? '[ TUYO ]' : '[ YOURS ]')
        : `[ ${fwdCell.owner.slice(0,6)}…${fwdCell.owner.slice(-4)} ]`
      const a   = Math.max(0, (2.0-fwdDist)/2.0)*0.68
      const wH  = Math.min(H*1.8,H*PROJ_DIST/Math.max(0.1,fwdDist))
      const fs  = Math.max(8, Math.round(11*PROJ_DIST/Math.max(0.4,fwdDist)))
      ctx.globalAlpha = a
      ctx.font = `${fs}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = fwdCell.color
      ctx.fillText(ownerText, W/2, (fwdProjectedTop + fwdProjectedBottom)/2 - wH*0.46)
      ctx.globalAlpha = 1
    }

    // Price tag on wall
    if (fwdCell?.priceEur > 0 && !fwdCell.owner && fwdDist < 2.0) {
      const a   = Math.max(0,(2.0-fwdDist)/2.0)*0.72
      const wH  = Math.min(H*1.8,H*PROJ_DIST/Math.max(0.1,fwdDist))
      const fs  = Math.max(9,Math.round(12*PROJ_DIST/Math.max(0.5,fwdDist)))
      ctx.globalAlpha = a
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fb923c'
      ctx.fillText(`${fwdCell.priceEur} EUR`, W/2, (fwdProjectedTop + fwdProjectedBottom)/2 + wH*0.30)
      ctx.globalAlpha = 1
    }

    // Inspect prompt when very close
    if (fwdDist < 0.9 && fwdCell) {
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      const isMineWall2 = myWallet && fwdCell.owner?.toLowerCase() === myWallet.toLowerCase()
      if (fwdCell.isChainNode) {
        ctx.fillStyle = '#ffd700cc'
        ctx.fillText(es ? '[ ↵ RESOLVER CADENA ]' : '[ ↵ SOLVE FORMULA CHAIN ]', W/2, viewCenterY+18)
      } else if (!fwdCell.owner && fwdCell.isMarket) {
        ctx.fillStyle = '#fb923ccc'
        ctx.fillText(es ? '[ ↵ COMPRAR NFTJI ]' : '[ ↵ BUY NFTJI ]', W/2, viewCenterY+18)
      } else if (isMineWall2 && fwdCell.isMarket) {
        ctx.fillStyle = '#4ade80cc'
        ctx.fillText(es ? '[ ↵ LIBERAR NFTJI ]' : '[ ↵ RESELL NFTJI ]', W/2, viewCenterY+18)
      } else if (!fwdCell.owner) {
        ctx.fillStyle = C + 'cc'
        ctx.fillText(es ? '[ ↵ MINAR BLOQUE ]' : '[ ↵ MINE BLOCK ]', W/2, viewCenterY+18)
      }
    }

    } // end: block-only overlays (not obstacles)

    // ── Crosshair — brightens and expands when in interaction range ───────────
    const hasTarget  = fwdMx >= 0 && fwdMy >= 0 && fwdCell !== null && crosshairHitsFace
    const inXHRange  = hasTarget && !fwdCell?.isObstacle && fwdDist <= INTERACT_DIST
    const xhBase     = fwdCell?.isChainNode ? '#ffd700' : (fwdCell?.owner ? fwdCell.color : C)
    const xhCol      = inXHRange ? xhBase+'ee' : C+'33'
    const xhLen      = inXHRange ? 12 : 9
    const xhGap      = inXHRange ? 2 : 3
    ctx.strokeStyle = xhCol; ctx.lineWidth = inXHRange ? 1.4 : 1
    ctx.beginPath()
    ctx.moveTo(W/2-xhLen-xhGap, viewCenterY); ctx.lineTo(W/2-xhGap, viewCenterY)
    ctx.moveTo(W/2+xhGap, viewCenterY);       ctx.lineTo(W/2+xhLen+xhGap, viewCenterY)
    ctx.moveTo(W/2, viewCenterY-xhLen-xhGap); ctx.lineTo(W/2, viewCenterY-xhGap)
    ctx.moveTo(W/2, viewCenterY+xhGap);       ctx.lineTo(W/2, viewCenterY+xhLen+xhGap)
    ctx.stroke()
    if (hasTarget) {
      ctx.fillStyle = xhCol
      ctx.beginPath(); ctx.arc(W/2, viewCenterY, inXHRange ? 2.5 : 1.5, 0, Math.PI*2); ctx.fill()
    }
    if (inXHRange) {
      ctx.globalAlpha = 0.18; ctx.strokeStyle = xhBase; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(W/2, viewCenterY, 22, 0, Math.PI*2); ctx.stroke()
      ctx.globalAlpha = 1
    }

    // ── Chain node compass (when within 13 cells, not facing it) ─────────────
    {
      const cnPos = chainNodePosRef.current
      const cnDX  = (cnPos.col+0.5) - px/CELL_SIZE
      const cnDY  = (cnPos.row+0.5) - py/CELL_SIZE
      const cnD   = Math.sqrt(cnDX*cnDX+cnDY*cnDY)
      if (cnD < 13 && !fwdCell?.isChainNode) {
        const cnA    = Math.atan2(cnDY, cnDX)
        const relA   = ((cnA - angle + Math.PI) % (2*Math.PI)) - Math.PI
        const prox   = Math.max(0, 1 - cnD/13)
        const cmpA   = 0.18 + prox * 0.52
        ctx.globalAlpha = cmpA
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#ffd700'
        ctx.textBaseline = 'middle'
        if (Math.abs(relA) > FOV/2 + 0.05) {
          // Off-screen: show directional arrow at screen edge
          ctx.textAlign = relA > 0 ? 'right' : 'left'
          ctx.fillText(`${relA > 0 ? '→' : '←'} ⬡ ${cnD.toFixed(1)}`, relA > 0 ? W-10 : 10, H*0.35)
        } else {
          // In FOV but not targeted: subtle below-crosshair label
          ctx.textAlign = 'center'
          ctx.fillText(`⬡ ${cnD.toFixed(1)}`, W/2, viewCenterY+32)
        }
        ctx.globalAlpha = 1; ctx.textBaseline = 'top'
      }
    }

    // ── Room entry notification ───────────────────────────────────────────────
    const notif = notifRef.current
    if (notif) {
      const elapsed=Date.now()-notif.startedAt, fadeMs=2800
      if (elapsed<fadeMs) {
        const t=elapsed/fadeMs
        const a=t<0.12?t/0.12:t<0.7?1:1-(t-0.7)/0.3
        ctx.globalAlpha=a
        ctx.font='bold 12px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'
        const tw=Math.min(ctx.measureText(notif.text).width+28,W*0.72)
        const bx=W/2-tw/2, by=viewCenterY-62, bh=24
        ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(bx,by,tw,bh)
        ctx.strokeStyle=notif.color; ctx.lineWidth=1; ctx.strokeRect(bx,by,tw,bh)
        ctx.fillStyle=notif.color; ctx.fillText(notif.text,W/2,by+bh/2)
        ctx.globalAlpha=1
      } else notifRef.current=null
    }

    // ── HUD: current room (right of chain stats panel, top-left area) ───────
    const curHex = curCell?.isChainNode||curCell?.isPortalNode ? null : (curCell?.blockHex || gridToBlockHex(gr,gc))
    ctx.textAlign='left'; ctx.textBaseline='top'
    ctx.fillStyle = C+'dd'; ctx.font='bold 12px monospace'
    if(curHex) ctx.fillText(curHex, 174, 10)
    if (curCell?.emoji) {
      ctx.font='12px serif'; ctx.fillText(curCell.emoji, 174, 24)
    }
    if (curCell?.owner) {
      const ownLabel = myWallet && curCell.owner.toLowerCase()===myWallet.toLowerCase()
        ? (es?'🔑 TUYO':'🔑 YOURS') : `${curCell.owner.slice(0,6)}…${curCell.owner.slice(-4)}`
      ctx.fillStyle = curCell.color+'cc'; ctx.font='11px monospace'
      ctx.fillText(ownLabel, 174, curCell.emoji ? 40 : 24)
    }


    // ── Facing block info HUD (top-right) — only within 2 cells ──────────────
    if (fwdDist <= 2.0) {
      const _isObsHUD = fwdCell?.isObstacle || validObstaclesRef.current?.has(`${fwdMy},${fwdMx}`)
      // Free market/NFTJI blocks only show the HUD when the player is very close (1.5 cells).
      // This prevents the top-right card from appearing for ambient NFTJI blocks all over the map.
      const _maxHudDist = (!_isObsHUD && fwdCell?.isMarket && !fwdCell?.owner) ? 1.5 : 2.0
      if ((_isObsHUD || fwdFaceSolid) && fwdDist <= _maxHudDist) {
        drawFacingHUD(ctx, W, H, fwdCell, fwdMx, fwdMy, myWallet, es, fwdDist, validObstaclesRef.current)
      }
    }

    // ── Local third-person wallet avatar ──────────────────────────────────
    const swE  = performance.now() - swingStartRef.current
    const swT  = swE < SWING_DUR ? swE / SWING_DUR : 0
    drawMineProgress(ctx, W, H, mineProgressRef.current, mineTypeRef.current)

    // ── Enemy in crosshair indicator ──────────────────────────────────────
    const enemy = enemyTargetRef.current
    if (enemy?.wallet) {
      const isTeam = enemy.isTeammate
      const isHead = enemy.hitZone === 'head'
      const ringCol = isTeam ? '#4ade80' : isHead ? '#facc15' : '#ef4444'
      ctx.globalAlpha = 0.55
      ctx.strokeStyle = ringCol; ctx.lineWidth = 1.5
      const xh = W/2, yh = H * HORIZON_RATIO
      const r2 = 18
      ctx.beginPath(); ctx.arc(xh, yh, r2, 0, Math.PI*2); ctx.stroke()
      ctx.globalAlpha = 0.40
      ctx.fillStyle = ringCol
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(isTeam ? '🛡' : isHead ? 'HEAD' : 'BODY', xh, yh + r2 + 3)
      ctx.globalAlpha = 1
    }

    // ── PvP hit flash (red screen vignette) ───────────────────────────────
    const flashAge = performance.now() - pvpFlashRef.current
    if (flashAge < 280) {
      const fa = (1 - flashAge / 280) * 0.28
      const rg = ctx.createRadialGradient(W/2,H/2,H*0.2, W/2,H/2,H*0.8)
      rg.addColorStop(0, 'rgba(0,0,0,0)')
      rg.addColorStop(1, `rgba(220,30,30,${fa.toFixed(3)})`)
      ctx.globalAlpha = 1
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, W, H)
    }

    // ── Critical hit flash (gold screen vignette + CRIT! text) ────────────
    const critAge = performance.now() - critFlashRef.current
    if (critAge < 420) {
      const ca = Math.max(0, 1 - critAge / 420)
      const cg = ctx.createRadialGradient(W/2,H/2,H*0.05, W/2,H/2,H*0.65)
      cg.addColorStop(0, `rgba(255,220,0,${(ca*0.22).toFixed(3)})`)
      cg.addColorStop(1, `rgba(200,90,0,${(ca*0.35).toFixed(3)})`)
      ctx.globalAlpha = 1
      ctx.fillStyle = cg
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = ca
      ctx.font = `bold ${Math.round(16 + ca * 6)}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffd700'
      ctx.fillText('💥 CRIT!', W/2, H * HORIZON_RATIO - 58 - (1-ca)*18)
      ctx.globalAlpha = 1
    }

    // ── PvP gain popup ("+X EUR") ─────────────────────────────────────────
    const gain = pvpGainRef.current
    if (gain) {
      const ga = (performance.now() - gain.at) / 1200
      if (ga < 1) {
        ctx.globalAlpha = 1 - ga
        ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#4ade80'
        ctx.fillText(gain.text, W/2, H * HORIZON_RATIO - 40 - ga*20)
        ctx.globalAlpha = 1
      } else pvpGainRef.current = null
    }

    drawMinimap(ctx,gr,gc,angle,cellMap,presence,myIdentity,W,H,chainNodePosRef.current,validObstaclesRef.current)
    drawOnlineList(ctx,W,H,presence,myIdentity,pvpStolenRef.current)
    const walletDock = drawWalletDock(
      ctx,W,H,myNftjisRef.current,healthMapRef.current[myIdentity]??100,es,Boolean(myWallet)
    )
    drawThirdPersonPlayer(ctx,W,H,colorFromAddress(myIdentity||'local-player'),swT,walkDistRef.current,H-18)
    drawChainStats(ctx,W,H,chainStatsRef.current,es,(walletDock?.bottom||8)+6)
  }, [])

  useEffect(()=>{ renderRef.current=renderFrame },[renderFrame])

  // Canvas resize
  useEffect(()=>{
    const canvas=canvasRef.current, container=containerRef.current
    if (!canvas||!container) return
    const resize=()=>{
      const {width,height}=container.getBoundingClientRect()
      const cssW = Math.max(1, Math.round(width))
      const cssH = Math.max(1, Math.round(height))
      const pixels=cssW*cssH
      // Local-frustum culling leaves enough headroom to avoid the visibly
      // coarse 1x fallback on wide screens.
      const dprCap=pixels>1600000?1.1:1.3
      const dpr = Math.min(dprCap,Math.max(1,window.devicePixelRatio||1))
      canvas.dataset.dpr = String(dpr)
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      zBufferRef.current=null
      renderRef.current?.()
    }
    resize()
    const ro=new ResizeObserver(resize); ro.observe(container)
    return ()=>ro.disconnect()
  },[])

  useEffect(()=>{ renderRef.current?.() },[cellMap,presenceMap])

  // Keyboard
  useEffect(()=>{
    const dn=(e)=>{
      // Don't capture game keys while the user is typing in an overlay input
      const tag = document.activeElement?.tagName
      if(tag==='INPUT'||tag==='TEXTAREA') return
      const k=keysRef.current
      if(e.key==='w'||e.key==='W'||e.key==='ArrowUp')   {k.w=true;e.preventDefault()}
      if(e.key==='s'||e.key==='S'||e.key==='ArrowDown') {k.s=true;e.preventDefault()}
      if(e.key==='a'||e.key==='A')                        k.a=true
      if(e.key==='d'||e.key==='D')                        k.d=true
      if(e.key==='q'||e.key==='Q'||e.key==='ArrowLeft') {k.q=true;e.preventDefault()}
      if(e.key==='e'||e.key==='E'||e.key==='ArrowRight'){k.e=true;e.preventDefault()}
      if(e.key==='Shift') k.shift=true
      if(e.key==='Enter'){
        const fData=facingDataRef.current||{}
        const inRange=fData.dist==null||fData.dist<=INTERACT_DIST
        if(inRange){
          if(fData.cell?.isChainNode){
            onChainSolveOpenRef.current?.()
          } else if(fData.cell?.isPortalNode){
            const url=fData.cell.navUrl
            if(url) onWantNavRef.current?.(url)
          } else {
            const url=actionUrlRef.current
            if(url) onWantNavRef.current?.(url)
          }
        }
        e.preventDefault()
      }
      if(e.key===' '||e.code==='Space'){
        if(!keysRef.current.space){  // fire once per physical press, not on key-hold repeat
          keysRef.current.space=true
          const _p=playerRef.current
          if(_p.jumps<MAX_JUMPS){ _p.vz=Math.max(0,_p.vz)+JUMP_VZ; _p.jumps++ }
        }
        e.preventDefault()
      }
    }
    const up=(e)=>{
      const k=keysRef.current
      if(e.key==='w'||e.key==='W'||e.key==='ArrowUp')    k.w=false
      if(e.key==='s'||e.key==='S'||e.key==='ArrowDown')  k.s=false
      if(e.key==='a'||e.key==='A')                        k.a=false
      if(e.key==='d'||e.key==='D')                        k.d=false
      if(e.key==='q'||e.key==='Q'||e.key==='ArrowLeft')  k.q=false
      if(e.key==='e'||e.key==='E'||e.key==='ArrowRight') k.e=false
      if(e.key==='Shift') k.shift=false
      if(e.key===' '||e.code==='Space')                   k.space=false
    }
    const reset=()=>{
      for(const key of Object.keys(keysRef.current)) keysRef.current[key]=false
      velocityRef.current={x:0,y:0}
    }
    window.addEventListener('keydown',dn); window.addEventListener('keyup',up); window.addEventListener('blur',reset)
    return ()=>{ window.removeEventListener('keydown',dn); window.removeEventListener('keyup',up); window.removeEventListener('blur',reset) }
  },[])

  // Desktop FPS look uses Pointer Lock; touch keeps drag-to-look.
  useEffect(()=>{
    const onLock=()=>setPointerLocked(document.pointerLockElement===canvasRef.current)
    const onMouseMove=(e)=>{
      if(document.pointerLockElement!==canvasRef.current) return
      const sens=0.00175
      playerRef.current.angle += e.movementX*sens
      playerRef.current.pitch = Math.max(-MAX_PITCH,Math.min(MAX_PITCH,playerRef.current.pitch+e.movementY*sens))
      renderRef.current?.()
    }
    document.addEventListener('pointerlockchange',onLock)
    document.addEventListener('mousemove',onMouseMove)
    return ()=>{ document.removeEventListener('pointerlockchange',onLock); document.removeEventListener('mousemove',onMouseMove) }
  },[])

  // Pointer drag → rotate, tap → pickaxe swing
  const handlePointerDown = useCallback((e)=>{
    if(e.pointerType==='mouse'){
      if(document.pointerLockElement!==canvasRef.current){ canvasRef.current?.requestPointerLock?.(); return }
      if(performance.now()-swingStartRef.current>SWING_DUR){
        swingStartRef.current=performance.now(); swingEpochRef.current=Date.now(); hitDoneRef.current=false
      }
      return
    }
    canvasRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, type: e.pointerType, moved: 0 }
  },[])
  const handlePointerMove = useCallback((e)=>{
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    dragRef.current.x = e.clientX
    dragRef.current.y = e.clientY
    dragRef.current.moved = (dragRef.current.moved||0) + Math.abs(dx) + Math.abs(dy)
    const sens = dragRef.current.type === 'touch' ? 0.0038 : 0.0019
    playerRef.current.angle += dx * sens
    playerRef.current.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, playerRef.current.pitch + dy * sens))
    renderRef.current?.()
  },[])
  const handlePointerUp = useCallback(()=>{
    if (dragRef.current && (dragRef.current.moved||0) < 8) {
      // Tap/click with minimal movement → swing pickaxe
      if (performance.now()-swingStartRef.current > SWING_DUR) {
        swingStartRef.current = performance.now()
        swingEpochRef.current = Date.now()
        hitDoneRef.current = false
      }
    }
    dragRef.current = null
  },[])

  // Game loop
  useEffect(()=>{
    const loop=()=>{
      // Schedule next frame FIRST so the loop survives any exception in the body
      animRef.current=requestAnimationFrame(loop)
      const k=keysRef.current, p=playerRef.current
      const nowMs=performance.now()
      const dt=lastFrameRef.current ? Math.min(0.05,(nowMs-lastFrameRef.current)/1000) : 1/60
      lastFrameRef.current=nowMs
      let needsRender=false

      if(k.q){p.angle-=TURN_SPD*dt;needsRender=true}
      if(k.e){p.angle+=TURN_SPD*dt;needsRender=true}

      const joy=joystickRef.current
      const fwd=(k.w?1:0)-(k.s?1:0)-joy.y, str=(k.d?1:0)-(k.a?1:0)+joy.x
      const inputLen=Math.hypot(fwd,str)||1
      const targetSpeed=k.shift?SPRINT_SPD:MOVE_SPD
      const targetVX=(Math.cos(p.angle)*(fwd/inputLen)+Math.cos(p.angle+Math.PI/2)*(str/inputLen))*targetSpeed
      const targetVY=(Math.sin(p.angle)*(fwd/inputLen)+Math.sin(p.angle+Math.PI/2)*(str/inputLen))*targetSpeed
      const blend=1-Math.exp(-MOVE_ACCEL*dt)
      const vel=velocityRef.current
      vel.x+=(targetVX-vel.x)*blend; vel.y+=(targetVY-vel.y)*blend
      if(!fwd&&!str&&Math.hypot(vel.x,vel.y)<0.5){vel.x=0;vel.y=0}
      // Physical collision repulsion: push away from nearby players (no health damage)
      for(const [w,remote] of remoteVisualsRef.current.entries()){
        if(w.toLowerCase()===(presenceKeyRef.current||myWalletRef.current||'').toLowerCase()) continue
        if(Math.abs((Number(remote.z)||0)-p.z)>.85) continue
        const repX=p.x/CELL_SIZE-remote.gx, repY=p.y/CELL_SIZE-remote.gy
        const repD=Math.hypot(repX,repY)
        if(repD<AVATAR_R*2&&repD>.01){
          const overlap=(AVATAR_R*2-repD)/(AVATAR_R*2)
          const bump=80*overlap
          vel.x+=(repX/repD)*bump; vel.y+=(repY/repD)*bump
          // For anonymous players: broadcast a push so their client also moves
          if(w.startsWith('anon-')){
            const throttle=collisionPushThrottleRef.current
            const lastPush=throttle.get(w)||0
            if(Date.now()-lastPush>300){
              throttle.set(w,Date.now())
              onCollisionPushRef.current?.({ key:w, dx:-repX/repD, dy:-repY/repD })
            }
          }
        }
      }
      const movedDist=Math.hypot(vel.x,vel.y)*dt
      if(movedDist>0.001){
        const nx=p.x+vel.x*dt
        const ny=p.y+vel.y*dt
        const R=PLAYER_R*CELL_SIZE
        const inBX=nx>R&&nx<WORLD_W-R, inBY=ny>R&&ny<WORLD_H-R
        const ngx=nx/CELL_SIZE, ngy=ny/CELL_SIZE
        const cgx=p.x/CELL_SIZE, cgy=p.y/CELL_SIZE
        const cm=cellMapRef.current, obs=validObstaclesRef.current
        const avatarBlocked=(gx,gy)=>{
          for(const [w,remote] of remoteVisualsRef.current){
            if(w.toLowerCase()===(presenceKeyRef.current||myWalletRef.current||'').toLowerCase()) continue
            if(Math.abs((Number(remote.z)||0)-p.z)>.85) continue
            const nextDist=Math.hypot(gx-remote.gx,gy-remote.gy)
            const currentDist=Math.hypot(p.x/CELL_SIZE-remote.gx,p.y/CELL_SIZE-remote.gy)
            if(nextDist<AVATAR_R*2&&nextDist<currentDist) return true
          }
          return false
        }
        // Full move, else wall-slide. Mining blocks can be crossed from their
        // top, while taller structural walls remain solid at jump height.
        if(inBX&&inBY&&!hitsSolidWall(ngx,ngy,cm,obs,p.z)&&!avatarBlocked(ngx,ngy)){ p.x=nx; p.y=ny }
        else{
          if(inBX&&!hitsSolidWall(ngx,cgy,cm,obs,p.z)&&!avatarBlocked(ngx,cgy)) p.x=nx
          if(inBY&&!hitsSolidWall(cgx,ngy,cm,obs,p.z)&&!avatarBlocked(cgx,ngy)) p.y=ny
        }
        walkDistRef.current+=movedDist
        needsRender=true

        // Footstep every ~10 movement frames regardless of CELL_SIZE
        const steps=Math.floor(walkDistRef.current/FOOTSTEP_DIST)
        if(steps!==stepCountRef.current){stepCountRef.current=steps;playStep(audioCtxRef)}

        const {row:newRow,col:newCol}=worldToGrid(p.x,p.y)
        const last=lastCellRef.current
        if(newRow!==last.row||newCol!==last.col){
          lastCellRef.current={row:newRow,col:newCol}
          onPositionChange?.(newRow,newCol)
          // no mid-screen popup on cell change — top-left HUD already shows current hex
        }
      }

      // ── Vertical physics (jump / gravity) ────────────────────────────────
      {
        // Multi-point footprint check: center + 4 cardinal offsets at PLAYER_R
        let supportHeight = 0
        for(const [dr,dc] of [[0,0],[PLAYER_R,0],[-PLAYER_R,0],[0,PLAYER_R],[0,-PLAYER_R]]){
          const bk=`${Math.floor(p.y/CELL_SIZE+dr)},${Math.floor(p.x/CELL_SIZE+dc)}`
          if(validObstaclesRef.current.has(bk)) supportHeight=Math.max(supportHeight,OBSTACLE_TOP)
          else if(cellMapRef.current.has(bk)) supportHeight=Math.max(supportHeight,BLOCK_TOP)
        }
        const floorZ = supportHeight&&p.z>=supportHeight ? supportHeight : 0
        if(p.z > floorZ || p.vz > 0){
          p.vz -= GRAVITY_A*dt
          const nz = p.z + p.vz*dt
          if(nz <= floorZ){
            p.z = floorZ; p.vz = 0; p.jumps = 0   // land on floor or block top
          } else {
            p.z = nz
          }
          needsRender = true
        }
      }

      // Replicate the full avatar state. This also runs while stationary so
      // mouse look, jumps and pickaxe swings remain visible to every client.
      {
        const now=Date.now()
        const nextState={
          gx:p.x/CELL_SIZE,gy:p.y/CELL_SIZE,z:p.z,
          angle:p.angle,pitch:p.pitch,swingAt:swingEpochRef.current,
        }
        const prev=lastSentStateRef.current
        const changed=!prev
          || Math.hypot(nextState.gx-prev.gx,nextState.gy-prev.gy)>0.004
          || Math.abs(nextState.z-prev.z)>0.004
          || Math.abs(nextState.angle-prev.angle)>0.008
          || Math.abs(nextState.pitch-prev.pitch)>0.008
          || nextState.swingAt!==prev.swingAt
        // 6-7 updates/sec remains smooth after interpolation while cutting
        // Realtime fan-out almost in half. Idle heartbeats are deliberately rare.
        if(now-lastRealtimeRef.current>150&&(changed||now-(prev?.sentAt||0)>2500)){
          lastRealtimeRef.current=now
          lastSentStateRef.current={...nextState,sentAt:now}
          onPositionRealtimeRef.current?.(nextState.gx,nextState.gy,nextState)
        }
      }

      // ── Enemy sprite targeting ─────────────────────────────────────────────
      const camGX = p.x / CELL_SIZE, camGY = p.y / CELL_SIZE
      let closestEnemy = null, closestDist = Infinity
      const myW = myWalletRef.current
      const myIdentity = presenceKeyRef.current||myW
      for (const [w, pres] of remoteVisualsRef.current.entries()) {
        const isMe = w.toLowerCase() === (myIdentity || '').toLowerCase()
        if (isMe) continue
        const sgx = pres.gx ?? ((pres.col ?? 0) + 0.5)
        const sgy = pres.gy ?? ((pres.row ?? 0) + 0.5)
        const rx = sgx - camGX, ry = sgy - camGY
        const tY = Math.cos(p.angle)*rx + Math.sin(p.angle)*ry
        if (tY < 0.15 || tY > INTERACT_DIST) continue
        const tX = -Math.sin(p.angle)*rx + Math.cos(p.angle)*ry
        const targetBaseZ = Number(pres.z) || 0
        const aimZ = p.z + CAMERA_EYE_Z - tY * Math.tan(p.pitch || 0)
        const relativeAimZ = aimZ - targetBaseZ
        const hitZone = relativeAimZ >= 0.56 && relativeAimZ <= 0.84
          ? 'head'
          : relativeAimZ >= 0 && relativeAimZ < 0.56
            ? 'body'
            : null
        if (!hitZone) continue
        const halfWidth = hitZone === 'head' ? 0.16 : 0.29
        if (Math.abs(tX) > halfWidth) continue
        const enemyPool    = presenceRef.current[w]?.poolCode || null
        const myPool       = myPoolCodeRef.current
        const isTeammate   = !!(myPool && enemyPool && myPool === enemyPool)
        if (tY < closestDist) {
          closestDist = tY
          closestEnemy = { wallet: w, dist: tY, isAnon: w.startsWith('anon-'), isTeammate, hitZone }
        }
      }
      enemyTargetRef.current = closestEnemy

      // Facing detection + action URL + mine type update
      const {cell:fc,mx:fmx,my:fmy,perpDist:fcDist}=castRay(p.x,p.y,p.angle,cellMapRef.current,validObstaclesRef.current)
      const newKey=`${fmy},${fmx}`
      facingDataRef.current={mx:fmx,my:fmy,cell:fc,dist:fcDist}
      if(newKey!==facingKeyRef.current){
        facingKeyRef.current=newKey
        // Reset progress when target changes
        mineProgressRef.current=0; mineTargetRef.current=null
        if(fmx>=0&&fmy>=0){
          if(!fc?.isObstacle) onFacingChange?.(fmy,fmx,fc,fcDist)
          if(fc?.isObstacle){
            actionUrlRef.current=null; mineTypeRef.current='empty'
          } else if(fc){
            if(fc.isChainNode){
              actionUrlRef.current=null
              mineTypeRef.current=fcDist<=INTERACT_DIST?'chain':'empty'
            } else if(fc.isPortalNode){
              actionUrlRef.current=fc.navUrl||null
              mineTypeRef.current='portal'
            } else {
              const hex=fc.blockHex||gridToBlockHex(fmy,fmx)
              const myW=myWalletRef.current
              const ownerIsMe=myW&&fc.owner?.toLowerCase()===myW
              if(!fc.owner){
                if(fc.isMarket){
                  actionUrlRef.current=`/relaying?command=${encodeURIComponent(`/buy ${hex}`)}`
                  mineTypeRef.current='nftji'
                } else {
                  actionUrlRef.current=`/relaying?command=${encodeURIComponent(`/mine block ${hex}`)}`
                  mineTypeRef.current='mine'
                }
              } else if(ownerIsMe&&fc.isMarket){
                actionUrlRef.current=`/relaying?command=${encodeURIComponent(`/resell ${hex}`)}`
                mineTypeRef.current='nftji'
              } else {
                actionUrlRef.current=null; mineTypeRef.current='empty'
              }
            }
          } else {
            actionUrlRef.current=null; mineTypeRef.current='empty'
          }
          // Disable action URL if block is beyond interaction range
          if(fcDist > INTERACT_DIST) actionUrlRef.current=null
        } else {
          actionUrlRef.current=null; mineTypeRef.current='empty'
        }
        needsRender=true
      }

      // ── Swing hit detection ─────────────────────────────────────────────────
      const swingElapsed=performance.now()-swingStartRef.current
      const swinging=swingElapsed<SWING_DUR
      if(swinging) needsRender=true
      if(swinging&&swingElapsed/SWING_DUR>=0.45&&!hitDoneRef.current){
        hitDoneRef.current=true
        const myWallet = myWalletRef.current
        const enemy = enemyTargetRef.current

        if(enemy?.wallet && myWallet && !myWallet.startsWith('anon-') && !enemy.isTeammate){
          // ── PvP hit ──────────────────────────────────────────────────────
          playPickHit(audioCtxRef,'nftji')
          pvpFlashRef.current = performance.now()

          Promise.resolve(onPvpHitRef.current?.({
            attacker:myWallet,victim:enemy.wallet,victimIsAnon:enemy.isAnon,hitZone:enemy.hitZone,
          }))
            .then(result=>{
              if(!result?.ok) return
              if(result.critical||result.headshot) critFlashRef.current=performance.now()
              const activeCurrency=currencyRef.current
              const moneyKey=`stolen_${String(activeCurrency).toLowerCase()}`
              const money=Number(result[moneyKey])||0
              const moneySymbol={EUR:'EUR',USD:'USD',CNY:'CNY'}[activeCurrency]||activeCurrency
              const hit=result.headshot?'🎯 HEADSHOT':result.critical?'💥 CRIT':'⚔ HIT'
              pvpGainRef.current={
                text:result.killed?`💀 KILL  ${hit}`:`${hit} -${result.damage} HP${money>0?` +${money.toFixed(2)} ${moneySymbol}`:''}`,
                at:performance.now(),
              }
            })

        } else {
          // ── Block mine hit ───────────────────────────────────────────────
          const {mx,my}=facingDataRef.current
          const tk=mx>=0&&my>=0?`${my},${mx}`:null
          if(tk!==mineTargetRef.current){mineProgressRef.current=0;mineTargetRef.current=tk}
          if(!tk||mineTypeRef.current==='empty'){
            playPickHit(audioCtxRef,'empty')
          } else if(mineTypeRef.current==='chain'){
            // Central chain terminal: one hit opens the formula card.
            playPickHit(audioCtxRef,'nftji')
            playPickHit(audioCtxRef,'complete')
            onChainSolveOpenRef.current?.()
          } else if(mineTypeRef.current==='portal'){
            // Portal: 1-hit navigation
            playPickHit(audioCtxRef,'nftji')
            playPickHit(audioCtxRef,'complete')
            const url=actionUrlRef.current
            if(url) setTimeout(()=>onWantNavRef.current?.(url),120)
          } else {
            mineProgressRef.current=Math.min(1,mineProgressRef.current+1/HITS_NEEDED)
            playPickHit(audioCtxRef,mineTypeRef.current)
            if(mineProgressRef.current>=1){
              playPickHit(audioCtxRef,'complete')
              mineProgressRef.current=0
              const url=actionUrlRef.current
              if(url) setTimeout(()=>onWantNavRef.current?.(url),120)
            }
          }
        }
        needsRender=true
      }
      if(!swinging) hitDoneRef.current=false

      if(notifRef.current&&(Date.now()-notifRef.current.startedAt)<2800) needsRender=true
      // Keep rendering while any remote wallet swing animation is still playing
      const now2=Date.now()
      for(const t of Object.values(swingMapRef.current||{})){
        if(now2-t<SWING_DUR){needsRender=true;break}
      }
      // Always render when remote players are present so their movement is visible
      const hasRemotes = Object.keys(presenceRef.current||{}).some(
        w => w.toLowerCase() !== (presenceKeyRef.current||myWalletRef.current||'').toLowerCase()
      )
      const ambientDue=hasRemotes&&nowMs-lastAmbientRenderRef.current>33
      if(needsRender||ambientDue){
        if(ambientDue) lastAmbientRenderRef.current=nowMs
        renderRef.current?.()
      }
    }
    lastFrameRef.current=0
    animRef.current=requestAnimationFrame(loop)
    return ()=>{ cancelAnimationFrame(animRef.current); lastFrameRef.current=0 }
  },[onPositionChange,onFacingChange])

  const updateJoystick=useCallback((clientX,clientY)=>{
    const rect=joystickPadRef.current?.getBoundingClientRect()
    if(!rect)return
    const radius=rect.width*.34
    let dx=clientX-(rect.left+rect.width/2),dy=clientY-(rect.top+rect.height/2)
    const dist=Math.hypot(dx,dy)
    if(dist>radius){dx=dx/dist*radius;dy=dy/dist*radius}
    const dead=.12
    let x=dx/radius,y=dy/radius
    if(Math.hypot(x,y)<dead){x=0;y=0}
    joystickRef.current.x=x;joystickRef.current.y=y
    if(joystickKnobRef.current)joystickKnobRef.current.style.transform=`translate(${dx}px,${dy}px)`
  },[])
  const stopJoystick=useCallback((e)=>{
    if(e&&joystickRef.current.pointerId!==null&&e.pointerId!==joystickRef.current.pointerId)return
    joystickRef.current={x:0,y:0,pointerId:null}
    if(joystickKnobRef.current)joystickKnobRef.current.style.transform='translate(0px,0px)'
  },[])

  return (
    <div ref={containerRef} style={{width:'100%',height:'100%',position:'relative',background:'#020610'}}>
      <canvas ref={canvasRef} tabIndex={0} aria-label={es?'Vista 3D de minería. Haz clic para capturar el ratón.':'3D mining view. Click to capture the mouse.'}
        style={{display:'block',width:'100%',height:'100%',outline:'none',touchAction:'none'}}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {/* Mobile analog movement pad */}
      <div ref={joystickPadRef} className="mm3-touch-controls" style={{
        position:'absolute',
        bottom:'calc(112px + env(safe-area-inset-bottom, 0px))',
        left:12,
        width:112,height:112,borderRadius:56,display:'flex',alignItems:'center',justifyContent:'center',
        background:'radial-gradient(circle,rgba(34,211,238,.11),rgba(2,8,18,.62))',
        border:'1px solid rgba(34,211,238,.25)',boxShadow:'inset 0 0 20px rgba(34,211,238,.08)',
        pointerEvents:'auto',userSelect:'none',touchAction:'none',WebkitTapHighlightColor:'transparent',
      }}
        onPointerDown={(e)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);joystickRef.current.pointerId=e.pointerId;updateJoystick(e.clientX,e.clientY)}}
        onPointerMove={(e)=>{if(joystickRef.current.pointerId===e.pointerId)updateJoystick(e.clientX,e.clientY)}}
        onPointerUp={stopJoystick} onPointerCancel={stopJoystick}
      >
        <div ref={joystickKnobRef} style={{
          width:46,height:46,borderRadius:23,background:'rgba(34,211,238,.22)',
          border:'1px solid rgba(103,232,249,.55)',boxShadow:'0 0 16px rgba(34,211,238,.18)',
          pointerEvents:'none',willChange:'transform',
        }}/>
        <span style={{
          position:'absolute',bottom:9,left:0,right:0,textAlign:'center',
          color:'#67e8f977',font:'bold 8px monospace',letterSpacing:'0.12em',pointerEvents:'none',
        }}>{es?'MOVER':'MOVE'}</span>
      </div>

      {/* Mobile jump button */}
      <div className="mm3-touch-controls" style={{
        position:'absolute',
        bottom:'calc(124px + env(safe-area-inset-bottom, 0px))',
        right:12,
        pointerEvents:'auto',
      }}>
        <button
          onPointerDown={(e)=>{
            e.preventDefault()
            const jp=playerRef.current
            if(jp.jumps<MAX_JUMPS){ jp.vz=Math.max(0,jp.vz)+JUMP_VZ; jp.jumps++ }
          }}
          onPointerUp={(e)=>e.preventDefault()}
          onPointerLeave={(e)=>e.preventDefault()}
          style={{
            width:72,height:72,background:'rgba(34,211,238,0.12)',
            border:'1px solid #22d3ee44',borderRadius:36,color:'#22d3eedd',
            fontSize:'1.5rem',cursor:'pointer',display:'flex',flexDirection:'column',gap:1,
            alignItems:'center',justifyContent:'center',
            userSelect:'none',fontFamily:'monospace',touchAction:'none',
            WebkitTapHighlightColor:'transparent',
          }}
        ><span aria-hidden="true">↑</span><span style={{fontSize:8,fontWeight:700,letterSpacing:'0.1em'}}>{es?'SALTAR':'JUMP'}</span></button>
      </div>
    </div>
  )
}
