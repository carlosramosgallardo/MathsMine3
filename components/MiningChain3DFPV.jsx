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
const MOVE_SPD      = 47     // world units / second (~1.2 cells/sec)
const MOVE_ACCEL    = 11
const TURN_SPD      = 1.35   // radians / second
const HORIZON_RATIO = 0.50
const PLAYER_R      = 0.20   // collision radius in grid units (1 unit = 1 cell)
const PLAYER_BODY_H = 1.02   // physical body height for bridges and overhangs
const AVATAR_R      = 0.30
const FOOTSTEP_DIST = CELL_SIZE * 0.42       // footstep cadence
const SWING_DUR     = 340    // ms per pickaxe swing
const HITS_NEEDED   = 5      // swings to complete mining action
const INTERACT_DIST = 2.0    // grid cells — max distance for block interaction
const VISUAL_RANGE  = 18     // far plane in cells; physics still uses the full map
const TOP_RANGE     = 14     // keep nearby elevated structures visually complete
const FLOOR_GRID_RANGE = 12  // distant grid lines merge into unstable horizon bands
const RADAR_RANGE   = 18     // square local map using the same camera frustum
const CHAIN_NODE_ROW = 4     // fallback; runtime position comes from cellMap
const CHAIN_NODE_COL = 4
// Jump: a player can mount mining blocks, but structural walls stay impassable.
const JUMP_VZ   = 5.7        // jump impulse (grid units / second)
const GRAVITY_A = 13.5       // gravity (grid units / second²)
const BLOCK_TOP = 1.0        // interactive/mining block height in grid units
const OBSTACLE_TOP = 2.35    // above the maximum single-jump apex
const BRIDGE_BOTTOM = 1.42   // enough clearance for a wallet walking below
const BRIDGE_TOP = 1.82      // unreachable from the floor without stairs
const STAIR_HEIGHTS = [0.58, 1.16, 1.74]
const MAX_STAIRCASES = 22
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

function obstacleTop(data) {
  const height = Number(data?.height)
  return Number.isFinite(height) && height > 0 ? height : OBSTACLE_TOP
}

function obstacleBottom(data) {
  const bottom = Number(data?.bottom)
  return Number.isFinite(bottom) && bottom > 0 ? bottom : 0
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

  // ─── Inner world — extra maze density for defined corridors ───────────────────
  // NW sub-quadrant L-pair
  ['4,6',   { base:W_DARK,  label:'WALL' }],
  ['4,7',   { base:W_DARK,  label:'WALL' }],
  ['6,5',   { base:W_SLATE, label:'WALL' }],
  ['6,6',   { base:W_SLATE, label:'WALL' }],
  // NE sub-quadrant L-pair
  ['4,19',  { base:W_DARK,  label:'WALL' }],
  ['4,20',  { base:W_DARK,  label:'WALL' }],
  ['6,20',  { base:W_SLATE, label:'WALL' }],
  ['6,21',  { base:W_SLATE, label:'WALL' }],
  // SW sub-quadrant L-pair
  ['21,5',  { base:W_DARK,  label:'WALL' }],
  ['21,6',  { base:W_DARK,  label:'WALL' }],
  ['23,5',  { base:W_SLATE, label:'WALL' }],
  ['23,6',  { base:W_SLATE, label:'WALL' }],
  // SE sub-quadrant L-pair
  ['21,20', { base:W_DARK,  label:'WALL' }],
  ['21,21', { base:W_DARK,  label:'WALL' }],
  ['23,20', { base:W_SLATE, label:'WALL' }],
  ['23,21', { base:W_SLATE, label:'WALL' }],
  // N/S center-approach gatekeepers (extend existing sandstone chokes)
  ['6,13',  { base:W_SAND,  label:'WALL' }],
  ['6,14',  { base:W_SAND,  label:'WALL' }],
  ['21,13', { base:W_SAND,  label:'WALL' }],
  ['21,14', { base:W_SAND,  label:'WALL' }],
  // W/E center corridor gate posts
  ['13,6',  { base:W_STONE, label:'WALL' }],
  ['14,6',  { base:W_STONE, label:'WALL' }],
  ['13,21', { base:W_STONE, label:'WALL' }],
  ['14,21', { base:W_STONE, label:'WALL' }],
  // Mid-quadrant approach definition (creates chokepoints mid-way)
  ['12,5',  { base:W_STONE, label:'WALL' }],
  ['12,6',  { base:W_STONE, label:'WALL' }],
  ['12,21', { base:W_STONE, label:'WALL' }],
  ['12,22', { base:W_STONE, label:'WALL' }],
  ['15,5',  { base:W_STONE, label:'WALL' }],
  ['15,6',  { base:W_STONE, label:'WALL' }],
  ['15,21', { base:W_STONE, label:'WALL' }],
  ['15,22', { base:W_STONE, label:'WALL' }],
  // Diagonal pillar set — breaks up the open quadrant diagonals
  ['9,9',   { base:W_SAND,  label:'WALL' }],
  ['9,18',  { base:W_SAND,  label:'WALL' }],
  ['18,9',  { base:W_SAND,  label:'WALL' }],
  ['18,18', { base:W_SAND,  label:'WALL' }],

  // ─── Inner zone bridge network — traversable elevated paths ──────────────────
  // Bridge 1: E-W deck at row 8, joins (8,10-11) wall pair to (8,16-17) wall pair
  ['8,12',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['8,13',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['8,14',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['8,15',  { base:W_DARK, label:'WALL', height:1.74 }],
  // Bridge 1 approach from south (col 13)
  ['9,13',  { base:W_DARK, label:'WALL', height:1.16 }],
  ['10,13', { base:W_DARK, label:'WALL', height:0.58 }],
  // Bridge 1 approach from north (col 12)
  ['7,12',  { base:W_DARK, label:'WALL', height:1.16 }],
  ['6,12',  { base:W_DARK, label:'WALL', height:0.58 }],

  // Bridge 2: E-W deck at row 19, joins (19,10-11) to (19,16-17)
  ['19,12', { base:W_DARK, label:'WALL', height:1.74 }],
  ['19,13', { base:W_DARK, label:'WALL', height:1.74 }],
  ['19,14', { base:W_DARK, label:'WALL', height:1.74 }],
  ['19,15', { base:W_DARK, label:'WALL', height:1.74 }],
  // Bridge 2 approach from north (col 13)
  ['18,13', { base:W_DARK, label:'WALL', height:1.16 }],
  ['17,13', { base:W_DARK, label:'WALL', height:0.58 }],
  // Bridge 2 approach from south (col 15)
  ['20,15', { base:W_DARK, label:'WALL', height:1.16 }],
  ['21,15', { base:W_DARK, label:'WALL', height:0.58 }],

  // Bridge 3: N-S deck at col 8, fills gap rows 12-15 between (11,8) and (16,8)
  ['12,8',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['13,8',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['14,8',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['15,8',  { base:W_DARK, label:'WALL', height:1.74 }],
  // Bridge 3 approach from east (row 13)
  ['13,9',  { base:W_DARK, label:'WALL', height:1.16 }],
  ['13,10', { base:W_DARK, label:'WALL', height:0.58 }],

  // Bridge 4: N-S deck at col 19, fills gap rows 12-15 between (11,19) and (16,19)
  ['12,19', { base:W_DARK, label:'WALL', height:1.74 }],
  ['13,19', { base:W_DARK, label:'WALL', height:1.74 }],
  ['15,19', { base:W_DARK, label:'WALL', height:1.74 }],
  // Bridge 4 approach from west (row 12)
  ['12,18', { base:W_DARK, label:'WALL', height:1.16 }],
  ['12,17', { base:W_DARK, label:'WALL', height:0.58 }],
  // Bridge 4 second approach (row 15)
  ['15,18', { base:W_DARK, label:'WALL', height:1.16 }],
  ['15,17', { base:W_DARK, label:'WALL', height:0.58 }],

  // ─── Inner zone — extra dense labyrinth walls (all OBSTACLE_TOP) ─────────────
  // Outer-approach blockers that force winding paths to N/S/E/W entrances
  ['3,5',   { base:W_DARK,  label:'WALL' }],
  ['3,6',   { base:W_DARK,  label:'WALL' }],
  ['3,20',  { base:W_DARK,  label:'WALL' }],
  ['3,21',  { base:W_DARK,  label:'WALL' }],
  ['24,5',  { base:W_DARK,  label:'WALL' }],
  ['24,6',  { base:W_DARK,  label:'WALL' }],
  ['24,20', { base:W_DARK,  label:'WALL' }],
  ['24,21', { base:W_DARK,  label:'WALL' }],
  // E-W inner approach gates
  ['7,4',   { base:W_SLATE, label:'WALL' }],
  ['7,5',   { base:W_SLATE, label:'WALL' }],
  ['7,21',  { base:W_SLATE, label:'WALL' }],
  ['7,22',  { base:W_SLATE, label:'WALL' }],
  ['20,4',  { base:W_SLATE, label:'WALL' }],
  ['20,5',  { base:W_SLATE, label:'WALL' }],
  ['20,22', { base:W_SLATE, label:'WALL' }],
  ['20,23', { base:W_SLATE, label:'WALL' }],
  // Axial approach choke extensions
  ['3,13',  { base:W_STONE, label:'WALL' }],
  ['3,14',  { base:W_STONE, label:'WALL' }],
  ['24,13', { base:W_STONE, label:'WALL' }],
  ['24,14', { base:W_STONE, label:'WALL' }],
  ['13,3',  { base:W_STONE, label:'WALL' }],
  ['14,3',  { base:W_STONE, label:'WALL' }],
  ['13,24', { base:W_STONE, label:'WALL' }],
  ['14,24', { base:W_STONE, label:'WALL' }],

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

function addRetroStructures(valid, reserved, cellMap) {
  const keyOf=(row,col)=>`${row},${col}`
  const routeFree=(row,col)=>row>1&&row<ROWS-2&&col>1&&col<COLS-2&&!cellMap.has(keyOf(row,col))
  const findCrossing=(starts,isGoal,directions)=>{
    const queue=[],parents=new Map()
    for(const start of starts){
      const key=keyOf(start.row,start.col)
      if(!routeFree(start.row,start.col)||parents.has(key)) continue
      parents.set(key,null);queue.push(start)
    }
    let goal=null
    for(let cursor=0;cursor<queue.length;cursor++){
      const current=queue[cursor]
      if(isGoal(current)){goal=current;break}
      for(const [dr,dc] of directions){
        const next={row:current.row+dr,col:current.col+dc}
        const key=keyOf(next.row,next.col)
        if(!routeFree(next.row,next.col)||parents.has(key)) continue
        parents.set(key,current);queue.push(next)
      }
    }
    if(!goal) return []
    const path=[]
    for(let current=goal;current;current=parents.get(keyOf(current.row,current.col))) path.push(current)
    return path.reverse()
  }
  const centerOut=(size)=>Array.from({length:size},(_,index)=>{
    const offset=Math.ceil(index/2)*(index%2?1:-1)
    return Math.floor(size/2)+offset
  }).filter(value=>value>=2&&value<=size-3)

  const horizontal=findCrossing(
    centerOut(ROWS).map(row=>({row,col:2})),
    ({col})=>col===COLS-3,
    [[0,1],[1,0],[-1,0],[0,-1]],
  )
  const vertical=findCrossing(
    centerOut(COLS).map(col=>({row:2,col})),
    ({row})=>row===ROWS-3,
    [[1,0],[0,1],[0,-1],[-1,0]],
  )
  const routes=[horizontal,vertical].filter(path=>path.length)
  const routeKeys=new Set(routes.flatMap(path=>path.map(({row,col})=>keyOf(row,col))))

  // Clear pre-existing decorative obstacles from the calculated crossings and
  // replace them with one continuous raised network.
  for(const key of routeKeys) valid.delete(key)
  for(const [routeIndex,path] of routes.entries()){
    path.forEach(({row,col},index)=>{
      const key=keyOf(row,col)
      valid.set(key,chainObstacle(key,{
        base:routeIndex?[28,104,98]:[34,82,104],glow:[34,211,238],kind:'hash',
        label:routeIndex?'NORTH-SOUTH BRIDGE':'EAST-WEST BRIDGE',
        bottom:BRIDGE_BOTTOM,height:BRIDGE_TOP,
        isStructure:true,isRoute:true,routeIndex,
      }))
    })
  }

  // High side walls turn the platforms into readable corridors. Regular gaps
  // and landmark safety zones remain open as entrances and exits.
  routes.forEach((path,routeIndex)=>path.forEach((cell,index)=>{
    const previous=path[Math.max(0,index-1)],next=path[Math.min(path.length-1,index+1)]
    const dr=Math.sign(next.row-previous.row),dc=Math.sign(next.col-previous.col)
    const isGate=index<3||index>path.length-4||index%11===5
    for(const [wr,wc] of [[cell.row-dc,cell.col+dr],[cell.row+dc,cell.col-dr]]){
      const key=keyOf(wr,wc)
      if(!routeFree(wr,wc)||routeKeys.has(key)||reserved.has(key)) continue
      if(isGate){valid.delete(key);continue}
      valid.set(key,chainObstacle(key,{
        base:[58,35,78],glow:[217,70,239],kind:'consensus',label:'ROUTE LIMIT',
        height:2.75,isStructure:true,isRouteWall:true,routeIndex,
      }))
    }
  }))

  // Deliberate stair access. The bridge cannot be mounted from ground level:
  // players must find one of these entrances on the minimap and climb it.
  const stairHeights=[1.36,.90,.45]
  routes.forEach((path,routeIndex)=>{
    const accessIndexes=[5,16,27,38,path.length-6].filter((value,index,list)=>
      value>2&&value<path.length-3&&list.indexOf(value)===index
    )
    for(const index of accessIndexes){
      const cell=path[index]
      const previous=path[index-1],next=path[index+1]
      const dr=Math.sign(next.row-previous.row),dc=Math.sign(next.col-previous.col)
      const sides=[[-dc,dr],[dc,-dr]]
      let built=false
      for(const [sr,sc] of sides){
        const stairs=stairHeights.map((_height,step)=>({
          row:cell.row+sr*(step+1),col:cell.col+sc*(step+1),step,
        }))
        const clear=stairs.every(({row,col})=>
          routeFree(row,col)&&!routeKeys.has(keyOf(row,col))&&!reserved.has(keyOf(row,col))
        )
        if(!clear) continue
        for(const {row,col,step} of stairs){
          const key=keyOf(row,col)
          valid.set(key,chainObstacle(key,{
            base:[96,78,48],glow:[250,204,21],kind:'ledger',label:'BRIDGE ACCESS',
            height:stairHeights[step],isStructure:true,isRouteStair:true,routeIndex,
          }))
        }
        built=true
        break
      }
      if(!built) continue
    }
  })
}

function circleTouchesCell(gx, gy, row, col, radius = PLAYER_R) {
  const closestX = Math.max(col, Math.min(gx, col + 1))
  const closestY = Math.max(row, Math.min(gy, row + 1))
  const dx = gx - closestX
  const dy = gy - closestY
  return dx * dx + dy * dy < radius * radius
}

function solidTopAt(row, col, cellMap, obsSet) {
  const key = `${row},${col}`
  const obstacle = obsSet?.get?.(key)
  if (obstacle) return obstacleTop(obstacle)
  return cellMap?.has(key) ? BLOCK_TOP : 0
}

function solidSpanAt(row, col, cellMap, obsSet) {
  const key=`${row},${col}`
  const obstacle=obsSet?.get?.(key)
  if(obstacle) return {bottom:obstacleBottom(obstacle),top:obstacleTop(obstacle)}
  if(cellMap?.has(key)) return {bottom:0,top:BLOCK_TOP}
  return null
}

// Circular player footprint against complete solid cells. Checking the whole
// body, rather than only its centre, prevents clipping into corners and walls.
function hitsSolidWall(gx, gy, cellMap, obsSet, playerZ = 0) {
  const minRow = Math.floor(gy - PLAYER_R)
  const maxRow = Math.floor(gy + PLAYER_R)
  const minCol = Math.floor(gx - PLAYER_R)
  const maxCol = Math.floor(gx + PLAYER_R)
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const span=solidSpanAt(row,col,cellMap,obsSet)
      const overlapsHeight=span&&playerZ<span.top-.04&&playerZ+PLAYER_BODY_H>span.bottom+.04
      if(overlapsHeight&&circleTouchesCell(gx,gy,row,col)) return true
    }
  }
  return false
}

function supportHeightAt(gx, gy, playerZ, cellMap, obsSet) {
  let height = 0
  const radius = PLAYER_R * 0.82
  for (let row = Math.floor(gy - radius); row <= Math.floor(gy + radius); row++) {
    for (let col = Math.floor(gx - radius); col <= Math.floor(gx + radius); col++) {
      const top = solidTopAt(row, col, cellMap, obsSet)
      if (top && playerZ >= top - 0.04 && circleTouchesCell(gx, gy, row, col, radius)) {
        height = Math.max(height, top)
      }
    }
  }
  return height
}

function ceilingBottomAt(gx,gy,playerZ,cellMap,obsSet){
  let ceiling=Infinity
  const radius=PLAYER_R*.82
  for(let row=Math.floor(gy-radius);row<=Math.floor(gy+radius);row++){
    for(let col=Math.floor(gx-radius);col<=Math.floor(gx+radius);col++){
      const span=solidSpanAt(row,col,cellMap,obsSet)
      if(span?.bottom>playerZ+PLAYER_BODY_H-.04&&circleTouchesCell(gx,gy,row,col,radius)){
        ceiling=Math.min(ceiling,span.bottom)
      }
    }
  }
  return Number.isFinite(ceiling)?ceiling:0
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
  // Unified fog rate across all surface types. Side 0 (E/W faces) full brightness,
  // side 1 (N/S faces) 72% to simulate directional ambient light.
  const sideMul = side === 1 ? 0.72 : 1.0
  const fog = Math.max(0.12, 1 - dist * 0.058)
  if (cell?.isObstacle) {
    const [r,g,b] = cell.base || [40,25,65]
    const f = sideMul * fog
    return [Math.round(r*f), Math.round(g*f), Math.round(b*f)]
  }
  if (cell?.isChainNode) {
    const pulse = 0.60 + Math.sin(Date.now() / 300) * 0.40
    const f = sideMul * Math.max(0.18, 1 - dist * 0.058) * pulse
    return [Math.round(255 * f), Math.round(180 * f), 0]
  }
  if (cell?.isPortalNode) {
    const [pr, pg, pb] = hexToRgb(cell.color || C)
    const pulse = 0.55 + Math.sin(Date.now() / 400) * 0.45
    const f = sideMul * Math.max(0.18, 1 - dist * 0.058) * pulse
    return [Math.round(pr * f), Math.round(pg * f), Math.round(pb * f)]
  }
  let base
  if (cell?.owner) {
    const isMe = myWallet && cell.owner.toLowerCase() === myWallet.toLowerCase()
    if (isMe) {
      base = [60, 200, 230]
    } else {
      const [r,g,b] = hexToRgb(cell.color)
      base = [Math.min(255,r*1.15|0), Math.min(255,g*1.15|0), Math.min(255,b*1.15|0)]
    }
  } else if (cell?.isMarket) {
    base = [200, 110, 20]
  } else if (cell) {
    base = [30, 60, 130]
  } else {
    base = [10, 18, 42]
  }
  const [r,g,b] = base
  const f = sideMul * fog
  return [Math.round(r*f), Math.round(g*f), Math.round(b*f)]
}

function worldToGrid(wx, wy) {
  return { row: Math.floor(wy / CELL_SIZE), col: Math.floor(wx / CELL_SIZE) }
}

// ── DDA through complete solid cells ─────────────────────────────────────────
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
    const cell = cellMap.get(key) || null
    if (!cell) continue  // Empty corridor: ray passes through
    return {perpDist, cell, side, mx, my, hit:true}
  }
  return {perpDist:maxDist, cell:null, side:0, mx:-1, my:-1, hit:false}
}

// Returns several solid faces along one ray. Rendering these back-to-front
// lets a tall nearby structure remain visible above a shorter foreground one.
function castRayLayers(wx, wy, angle, cellMap, obsSet, maxDist = VISUAL_RANGE) {
  const px = wx / CELL_SIZE, py = wy / CELL_SIZE
  const dx = Math.cos(angle), dy = Math.sin(angle)
  let mx = Math.floor(px), my = Math.floor(py)
  const sx = dx>0?1:-1, sy = dy>0?1:-1
  const ddx = Math.abs(dx)<1e-7?1e30:Math.abs(1/dx)
  const ddy = Math.abs(dy)<1e-7?1e30:Math.abs(1/dy)
  let sdx = (dx<0?px-mx:mx+1-px)*ddx
  let sdy = (dy<0?py-my:my+1-py)*ddy
  let side=0, perpDist=0
  const hits=[]
  let highestNearTop=0

  for(let step=0;step<Math.ceil(maxDist*2.2);step++){
    if(sdx<sdy){sdx+=ddx;mx+=sx;side=0;perpDist=sdx-ddx}
    else{sdy+=ddy;my+=sy;side=1;perpDist=sdy-ddy}
    perpDist=Math.max(.05,perpDist)
    if(perpDist>maxDist||mx<0||mx>=COLS||my<0||my>=ROWS) break
    const key=`${my},${mx}`
    const obstacle=obsSet?.get?.(key)||null
    if(obstacle){
      const cell={isObstacle:true,...obstacle}
      const top=obstacleTop(cell)
      if(top>highestNearTop+.01){hits.push({perpDist,cell,side,mx,my,hit:true});highestNearTop=top}
      continue
    }
    const cell=cellMap.get(key)||null
    if(cell&&BLOCK_TOP>highestNearTop+.01){
      hits.push({perpDist,cell,side,mx,my,hit:true})
      highestNearTop=BLOCK_TOP
    }
  }
  return hits
}

// ── Minimap ───────────────────────────────────────────────────────────────────
function minimapSize(W) {
  return W < 600 ? Math.min(W * 0.44, 128) : Math.min(176, W * 0.22)
}

function drawMinimap(ctx, gr, gc, angle, cellMap, presenceMap, myWallet, W, H, chainNodePos, validObs, gx, gy) {
  const isMobile = W < 600
  const SZ = minimapSize(W)
  const MX = W - SZ - 6
  const MY = 8

  // Local centered view — show VIEW_R cells in every direction from player
  const VIEW_R = 11
  const CS = SZ / (VIEW_R * 2)
  const camX = gx ?? (gc + .5), camY = gy ?? (gr + .5)

  // Pixel coords relative to player center
  const mapX = (col) => MX + (col - camX + VIEW_R) * CS
  const mapY = (row) => MY + (row - camY + VIEW_R) * CS
  const pvx = MX + VIEW_R * CS   // player is always at map center
  const pvy = MY + VIEW_R * CS

  const inCameraView = (row,col,pad=0) => {
    const vx=col-camX,vy=row-camY
    const dist=Math.hypot(vx,vy)
    if(dist<=2.15+pad) return true
    if(dist>RADAR_RANGE+pad) return false
    const rel=Math.atan2(Math.sin(Math.atan2(vy,vx)-angle),Math.cos(Math.atan2(vy,vx)-angle))
    return Math.abs(rel)<=FOV/2+.035+pad*.01
  }
  const visibleFromCamera = (row,col,pad=0) => {
    if(!inCameraView(row,col,pad)) return false
    const vx=col-camX,vy=row-camY
    const dist=Math.hypot(vx,vy)
    if(dist<=2.15+pad) return true
    const ray=castRay(camX*CELL_SIZE,camY*CELL_SIZE,Math.atan2(vy,vx),cellMap,validObs,Math.min(RADAR_RANGE,dist))
    return !ray.hit||ray.perpDist>=dist-.35
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

  // Vision cone rays (capped to local view radius)
  const visionEdge=[]
  const visionRays=isMobile?24:36
  for(let i=0;i<=visionRays;i++){
    const rayAngle=angle-FOV/2+(i/visionRays)*FOV
    const ray=castRay(camX*CELL_SIZE,camY*CELL_SIZE,rayAngle,cellMap,validObs,Math.min(RADAR_RANGE,VIEW_R))
    const rayDist=Math.min(VIEW_R,ray.perpDist+.04)
    visionEdge.push({
      x:mapX(camX+Math.cos(rayAngle)*rayDist),
      y:mapY(camY+Math.sin(rayAngle)*rayDist),
    })
  }

  // Render only cells within local window — each cell is now ~8px wide, obstacles readable
  const r0=Math.max(0,Math.floor(camY-VIEW_R)), r1=Math.min(ROWS,Math.ceil(camY+VIEW_R+1))
  const c0=Math.max(0,Math.floor(camX-VIEW_R)), c1=Math.min(COLS,Math.ceil(camX+VIEW_R+1))
  for (let r=r0;r<r1;r++) for (let c=c0;c<c1;c++) {
    const key = `${r},${c}`
    const cell = cellMap.get(key)
    const obs  = validObs?.get(key) || null
    const seen = inCameraView(r+.5,c+.5)
    if (obs?.isRouteStair) {
      ctx.fillStyle='rgba(250,204,21,.98)'
    } else if (obs?.isRoute) {
      ctx.fillStyle = obs.routeIndex ? 'rgba(45,212,191,.96)' : 'rgba(34,211,238,.96)'
    } else if (obs?.isRouteWall) {
      ctx.fillStyle = 'rgba(126,34,206,.88)'
    } else if (obs) {
      const [or,og,ob] = obs.base
      ctx.fillStyle = seen ? `rgba(${or>>1},${og>>1},${ob>>1},0.92)` : `rgba(${or>>2},${og>>2},${ob>>2},0.48)`
    } else if (cell?.owner) {
      ctx.fillStyle = seen ? cell.color+'99' : '#101827'
    } else if (cell?.isMarket) {
      ctx.fillStyle = seen ? (cell.owner ? '#4ade8044' : '#fb923c55') : '#0d1522'
    } else if (cell?.isChainNode) {
      ctx.fillStyle = seen ? '#ffd70033' : '#0d1522'
    } else if (cell && !cell.isPortalNode) {
      ctx.fillStyle = seen ? '#0e1e2e' : '#09111d'
    } else {
      ctx.fillStyle = seen ? '#07101d' : '#03070d'
    }
    ctx.fillRect(mapX(c), mapY(r), Math.ceil(CS), Math.ceil(CS))
    if(obs?.isRouteStair){
      ctx.fillStyle='rgba(255,255,255,.92)'
      ctx.fillRect(mapX(c)+CS*.28,mapY(r)+CS*.28,CS*.44,CS*.44)
    } else if(obs?.isRoute){
      ctx.fillStyle='rgba(224,255,255,.82)'
      const marker=Math.max(1,CS*.18)
      ctx.fillRect(mapX(c)+CS*.5-marker*.5,mapY(r)+CS*.5-marker*.5,marker,marker)
    } else if(obs?.isRouteWall){
      ctx.strokeStyle='rgba(232,121,249,.72)';ctx.lineWidth=.7
      ctx.strokeRect(mapX(c)+.5,mapY(r)+.5,Math.max(1,CS-1),Math.max(1,CS-1))
    }
    const isMyBlock = seen && cell?.owner && myWallet && cell.owner.toLowerCase() === myWallet.toLowerCase()
    if (isMyBlock) {
      ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 0.7
      ctx.strokeRect(mapX(c)+0.5, mapY(r)+0.5, Math.max(1,Math.ceil(CS)-1), Math.max(1,Math.ceil(CS)-1))
    }
  }

  // NFTJI block markers — only those visible in local window
  for (const [key, cell] of cellMap) {
    if (!cell?.isMarket) continue
    const [rr, cc] = key.split(',').map(Number)
    if (Math.abs(rr - camY) > VIEW_R + .5 || Math.abs(cc - camX) > VIEW_R + .5) continue
    const obs = validObs?.get(key)
    if (obs) continue
    const mx2 = mapX(cc + 0.5), my2 = mapY(rr + 0.5)
    const ds = Math.max(1.2, CS * 0.36)
    ctx.save()
    ctx.translate(mx2, my2); ctx.rotate(Math.PI / 4)
    ctx.fillStyle = cell.owner ? '#4ade80cc' : '#fb923ccc'
    ctx.fillRect(-ds, -ds, ds*2, ds*2)
    ctx.restore()
    if(cell.emoji) drawMapEmoji(cell.emoji,mx2,my2,cell.owner?'#4ade80':'#fb923c','square')
  }

  // Vision cone fill
  ctx.fillStyle='rgba(34,211,238,.045)'
  ctx.beginPath();ctx.moveTo(pvx,pvy)
  for(const point of visionEdge)ctx.lineTo(point.x,point.y)
  ctx.closePath();ctx.fill()

  // Chain node: draw in-place if in view, edge arrow if outside
  const cnPos = chainNodePos || { row: CHAIN_NODE_ROW, col: CHAIN_NODE_COL }
  const cnInView = Math.abs(cnPos.row - camY) <= VIEW_R && Math.abs(cnPos.col - camX) <= VIEW_R
  if (cnInView) {
    const cnPulse = 0.55 + Math.sin(Date.now() / 600) * 0.45
    const cnx = mapX(cnPos.col + 0.5), cny = mapY(cnPos.row + 0.5)
    const armLen = CS * 2.8, gapR = CS * 0.85
    ctx.globalAlpha = cnPulse * 0.28
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.arc(cnx, cny, CS * 2.1, 0, Math.PI*2); ctx.stroke()
    ctx.globalAlpha = Math.max(0.55, cnPulse)
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(cnx-gapR, cny); ctx.lineTo(cnx-armLen, cny)
    ctx.moveTo(cnx+gapR, cny); ctx.lineTo(cnx+armLen, cny)
    ctx.moveTo(cnx, cny-gapR); ctx.lineTo(cnx, cny-armLen)
    ctx.moveTo(cnx, cny+gapR); ctx.lineTo(cnx, cny+armLen)
    ctx.stroke()
    ctx.globalAlpha = Math.max(0.70, cnPulse)
    ctx.fillStyle = '#ffd700'
    ctx.save(); ctx.translate(cnx, cny); ctx.rotate(Math.PI / 4)
    const ds = CS * 0.52
    ctx.fillRect(-ds, -ds, ds*2, ds*2)
    ctx.restore()
    ctx.globalAlpha = 1
  } else {
    // Edge arrow toward chain node
    const edgePulse = 0.55 + Math.sin(Date.now() / 600) * 0.45
    const a = Math.atan2(cnPos.row - camY, cnPos.col - camX)
    const edge = SZ * 0.46
    const ax = pvx + Math.cos(a) * edge, ay = pvy + Math.sin(a) * edge
    ctx.save(); ctx.globalAlpha = Math.max(0.5, edgePulse)
    ctx.fillStyle = '#ffd700'
    ctx.translate(ax, ay); ctx.rotate(a)
    ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-3.5,-2.8); ctx.lineTo(-3.5,2.8); ctx.closePath(); ctx.fill()
    ctx.restore(); ctx.globalAlpha = 1
  }

  // Portal nodes — in local view only; edge arrow otherwise
  for (const [key, cell] of cellMap) {
    if (!cell?.isPortalNode) continue
    const [rr, cc] = key.split(',').map(Number)
    const inLocalView = Math.abs(rr - camY) <= VIEW_R + .5 && Math.abs(cc - camX) <= VIEW_R + .5
    if (inLocalView) {
      const px2 = mapX(cc + 0.5), py2 = mapY(rr + 0.5)
      const pPulse = 0.60 + Math.sin(Date.now() / 500 + cc * 0.4) * 0.40
      ctx.globalAlpha = Math.max(0.55, pPulse) * 0.9
      ctx.fillStyle = cell.color || C
      ctx.beginPath(); ctx.arc(px2, py2, Math.max(2, CS * 0.75), 0, Math.PI*2); ctx.fill()
      drawMapEmoji(cell.emoji||'◆',px2,py2,cell.color||C,'circle')
      ctx.globalAlpha = 1
    } else {
      const a = Math.atan2(rr - camY, cc - camX)
      const edge = SZ * 0.44
      const ax = pvx + Math.cos(a) * edge, ay = pvy + Math.sin(a) * edge
      ctx.save(); ctx.globalAlpha = 0.50
      ctx.fillStyle = cell.color || C
      ctx.translate(ax, ay); ctx.rotate(a)
      ctx.beginPath(); ctx.moveTo(4,0); ctx.lineTo(-3,-2); ctx.lineTo(-3,2); ctx.closePath(); ctx.fill()
      ctx.restore(); ctx.globalAlpha = 1
    }
  }

  // ── Wallet markers — rendered last so they always appear on top ───────────────
  const nowMs = Date.now()
  for (const [w,p] of Object.entries(presenceMap||{})) {
    if (p.row==null && p.gy==null) continue
    const isMe = w.toLowerCase()===(myWallet||'').toLowerCase()
    if(isMe) continue
    const isBot = Boolean(p.isBot)
    const dotGX = p.gx ?? ((p.col??0) + 0.5)
    const dotGY = p.gy ?? ((p.row??0) + 0.5)
    const col = colorFromAddress(w)
    const heading = Number(p.angle)||0

    const vx = dotGX - camX, vy = dotGY - camY
    const walletDist = Math.hypot(vx, vy)
    const relAngle = Math.atan2(Math.sin(Math.atan2(vy,vx)-angle), Math.cos(Math.atan2(vy,vx)-angle))
    const inFOV = walletDist <= 2.5 || Math.abs(relAngle) <= FOV/2 + 0.12
    const inView = inFOV && visibleFromCamera(dotGY, dotGX, 1)
    const pulse = 0.5 + Math.sin(nowMs/680 + dotGX*1.9 + dotGY*1.3) * 0.5
    const inLocalView = Math.abs(vx) <= VIEW_R + .5 && Math.abs(vy) <= VIEW_R + .5

    ctx.save()

    if (!inLocalView) {
      // Edge arrow for out-of-range wallets
      const a = Math.atan2(vy, vx)
      const edge = SZ * 0.43
      const ax = pvx + Math.cos(a) * edge, ay = pvy + Math.sin(a) * edge
      ctx.globalAlpha = 0.28 + pulse * 0.14
      ctx.fillStyle = col
      ctx.translate(ax, ay); ctx.rotate(a)
      ctx.beginPath(); ctx.moveTo(3.5,0); ctx.lineTo(-2.5,-2); ctx.lineTo(-2.5,2); ctx.closePath(); ctx.fill()
      ctx.restore()
      continue
    }

    const dx = mapX(dotGX), dy = mapY(dotGY)

    if (isBot) {
      // ── BOT: square + crosshair ──────────────────────────────────────────────
      const baseAlpha = inView ? 0.95 : inFOV ? 0.60 : 0.35
      const bs = Math.max(3.2, CS * 0.90)
      ctx.globalAlpha = baseAlpha
      if (inView) {
        ctx.strokeStyle = col + Math.round((0.28+pulse*0.48)*255).toString(16).padStart(2,'0')
        ctx.lineWidth = 0.8
        ctx.strokeRect(dx-bs-1.8, dy-bs-1.8, (bs+1.8)*2, (bs+1.8)*2)
      }
      ctx.fillStyle = col + (inView ? '50' : '20')
      ctx.fillRect(dx-bs, dy-bs, bs*2, bs*2)
      ctx.strokeStyle = col + (inView ? 'ff' : '77')
      ctx.lineWidth = inView ? 0.9 : 0.6
      ctx.strokeRect(dx-bs, dy-bs, bs*2, bs*2)
      ctx.lineWidth = 0.7
      ctx.beginPath()
      ctx.moveTo(dx-bs*0.5, dy); ctx.lineTo(dx+bs*0.5, dy)
      ctx.moveTo(dx, dy-bs*0.5); ctx.lineTo(dx, dy+bs*0.5)
      ctx.stroke()
      if (inView) {
        ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(dx,dy)
        ctx.lineTo(dx+Math.cos(heading)*CS*2.2, dy+Math.sin(heading)*CS*2.2)
        ctx.stroke()
      }
    } else {
      // ── HUMAN WALLET: three-tier freak design ─────────────────────────────
      const r = Math.max(2.0, CS * 0.70)

      if (inView) {
        ctx.globalAlpha = 0.94
        const ringR = r + 2.2 + pulse * 1.4
        ctx.strokeStyle = col + Math.round((0.18+pulse*0.52)*255).toString(16).padStart(2,'0')
        ctx.lineWidth = 1.1
        ctx.beginPath(); ctx.arc(dx, dy, ringR, 0, Math.PI*2); ctx.stroke()
        ctx.fillStyle = col
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.48)'
        ctx.beginPath(); ctx.arc(dx-r*0.22, dy-r*0.22, r*0.36, 0, Math.PI*2); ctx.fill()
        ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(dx,dy)
        ctx.lineTo(dx+Math.cos(heading)*CS*2.1, dy+Math.sin(heading)*CS*2.1)
        ctx.stroke()

      } else if (inFOV) {
        ctx.globalAlpha = 0.60
        ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 1.1
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI*2); ctx.stroke()
        ctx.fillStyle = col + '2a'
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI*2); ctx.fill()
        ctx.strokeStyle = col + '66'; ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.arc(dx, dy, r+1.8, 0, Math.PI*0.9); ctx.stroke()
        ctx.beginPath(); ctx.arc(dx, dy, r+1.8, Math.PI, Math.PI*1.9); ctx.stroke()

      } else {
        ctx.globalAlpha = 0.42 + pulse * 0.08
        const dr = Math.max(1.8, r * 0.80)
        ctx.strokeStyle = col + 'bb'; ctx.lineWidth = 0.9
        ctx.beginPath()
        ctx.moveTo(dx, dy-dr); ctx.lineTo(dx+dr, dy)
        ctx.lineTo(dx, dy+dr); ctx.lineTo(dx-dr, dy)
        ctx.closePath(); ctx.stroke()
        ctx.fillStyle = col + '28'
        ctx.beginPath()
        ctx.moveTo(dx, dy-dr); ctx.lineTo(dx+dr, dy)
        ctx.lineTo(dx, dy+dr); ctx.lineTo(dx-dr, dy)
        ctx.closePath(); ctx.fill()
        ctx.fillStyle = col + '99'
        ctx.beginPath(); ctx.arc(dx, dy, dr*0.30, 0, Math.PI*2); ctx.fill()
      }
    }

    // Short wallet label for nearby wallets (desktop only)
    if (!isMobile && walletDist < 7.5) {
      const labelFade = Math.max(0, 1 - walletDist/7.5) * (inView ? 0.88 : 0.44)
      ctx.globalAlpha = labelFade
      const lSize = Math.max(5.5, Math.min(7.5, CS * 1.55))
      ctx.font = `bold ${lSize}px monospace`
      ctx.fillStyle = col
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      const label = isBot ? 'BOT' : w.slice(2, 6)
      const markerR = isBot ? Math.max(3.2, CS*0.90) : Math.max(2.0, CS*0.70)
      ctx.fillText(label, dx, dy + markerR + 1.2)
    }

    ctx.restore()
  }

  // ── Local player marker: rendered absolutely last — always on top ─────────────
  {
    const selfPulse = 0.62 + Math.sin(Date.now()/520) * 0.38
    const sr = Math.max(2.4, CS * 0.78)
    ctx.globalAlpha = selfPulse * 0.55
    ctx.strokeStyle = C; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(pvx, pvy, sr+2.8+selfPulse*1.2, 0, Math.PI*2); ctx.stroke()
    ctx.globalAlpha = 0.96
    ctx.fillStyle = C
    ctx.beginPath(); ctx.arc(pvx, pvy, sr, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.60)'
    ctx.beginPath(); ctx.arc(pvx-sr*0.22, pvy-sr*0.22, sr*0.34, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle = C + 'dd'; ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(pvx, pvy)
    ctx.lineTo(pvx+Math.cos(angle)*CS*2.5, pvy+Math.sin(angle)*CS*2.5)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  ctx.restore()
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
  const baseX = W * (mobile ? 0.82 : 0.76)
  const baseY = H + 20 * scale + bob
  // Thrust hand toward crosshair (W/2, H*HORIZON_RATIO) during swing
  const handX = baseX - swing * (baseX - W*0.52) * 0.65
  const handY = baseY - swing * (baseY - H*HORIZON_RATIO) * 0.50
  const [r,g,b] = hexToRgb(color || C)

  ctx.save()
  ctx.globalAlpha = 0.96
  ctx.strokeStyle = `rgb(${Math.round(r*.62)},${Math.round(g*.62)},${Math.round(b*.62)})`
  ctx.lineWidth = Math.max(12, 18*scale); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(W + 18, H + 18); ctx.lineTo(handX, handY); ctx.stroke()

  // Weapon always aimed toward crosshair; thrust extends length at apex
  const pickA = Math.atan2(H*HORIZON_RATIO - handY, W*0.50 - handX)
  const pickL = (108 + swing*26) * scale
  drawFreakUsbPen(ctx,handX,handY,pickL,pickA,scale)
  ctx.restore()
}

function drawFreakUsbPen(ctx,handX,handY,length,angle,scale=1,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;ctx.lineCap='round'
  const nx=-Math.sin(angle),ny=Math.cos(angle)
  const tipX=handX+Math.cos(angle)*length,tipY=handY+Math.sin(angle)*length
  // Grip (first 30%)
  const gX=handX+Math.cos(angle)*length*.30,gY=handY+Math.sin(angle)*length*.30
  ctx.strokeStyle='#060d17';ctx.lineWidth=Math.max(4.5,7*scale)
  ctx.beginPath();ctx.moveTo(handX,handY);ctx.lineTo(gX,gY);ctx.stroke()
  // Grip rings
  ctx.strokeStyle='#22d3ee';ctx.lineWidth=Math.max(0.8,1.1*scale)
  const rh=Math.max(2.8,4.2*scale)
  ;[.07,.15,.23].forEach(t=>{
    const rx=handX+Math.cos(angle)*length*t,ry=handY+Math.sin(angle)*length*t
    ctx.beginPath();ctx.moveTo(rx-nx*rh,ry-ny*rh);ctx.lineTo(rx+nx*rh,ry+ny*rh);ctx.stroke()
  })
  // Fuchsia node at grip end
  ctx.fillStyle='#d946ef'
  ctx.beginPath();ctx.arc(gX,gY,Math.max(1.4,2.2*scale),0,Math.PI*2);ctx.fill()
  // Shaft (30-88%)
  const sX=handX+Math.cos(angle)*length*.88,sY=handY+Math.sin(angle)*length*.88
  ctx.strokeStyle='#0c2030';ctx.lineWidth=Math.max(2,3*scale)
  ctx.beginPath();ctx.moveTo(gX,gY);ctx.lineTo(sX,sY);ctx.stroke()
  // Cyan highlight stripe
  ctx.save();ctx.globalAlpha*=.55;ctx.strokeStyle='#22d3ee';ctx.lineWidth=Math.max(.5,.75*scale)
  ctx.beginPath();ctx.moveTo(gX+nx*1.5,gY+ny*1.5);ctx.lineTo(sX+nx*1.5,sY+ny*1.5);ctx.stroke()
  ctx.restore()
  // USB Type-A head
  const hLen=Math.max(6,9*scale),hW=Math.max(3.5,5*scale)
  ctx.save();ctx.translate(tipX,tipY);ctx.rotate(angle)
  ctx.fillStyle='#b0c4d4';ctx.fillRect(0,-hW/2,hLen,hW)
  ctx.strokeStyle='#4d6880';ctx.lineWidth=Math.max(.4,.6*scale);ctx.strokeRect(0,-hW/2,hLen,hW)
  ctx.fillStyle='#050f18';ctx.fillRect(hLen*.08,-hW*.22,hLen*.84,hW*.44)
  ctx.fillStyle='#facc15';[.18,.42,.66].forEach(t=>ctx.fillRect(hLen*t,-hW*.15,hLen*.13,hW*.30))
  ctx.restore()
  // Tip glow
  ctx.save();ctx.globalAlpha*=.75;ctx.fillStyle='#22d3ee'
  ctx.beginPath();ctx.arc(tipX,tipY,Math.max(1.8,2.8*scale),0,Math.PI*2);ctx.fill()
  ctx.globalAlpha*=.30;ctx.strokeStyle='#22d3ee';ctx.lineWidth=Math.max(.4,.7*scale)
  ctx.beginPath();ctx.arc(tipX,tipY,Math.max(3.5,5*scale),0,Math.PI*2);ctx.stroke()
  ctx.restore()
  ctx.restore()
}

function drawThirdPersonPlayer(ctx,W,H,color,swingT,walkDist,dockTop){
  const mobile=W<640,scale=mobile ? .76 : Math.max(.86,Math.min(1.1,H/590))
  const bodyW=66*scale,bodyH=76*scale,headW=43*scale,headH=28*scale
  const bob=Math.sin(walkDist*.18)*2.2*scale
  // Keep the camera reticle centered while composing the local wallet slightly
  // left. At the strike apex the drill-pick crosses the reticle instead of the
  // avatar covering both the sight and the impact point.
  const cx=W/2-(mobile?12:18)*scale
  const bottomY=(dockTop??(H-18))+bob,bodyTop=bottomY-bodyH,headTop=bodyTop-headH+4*scale
  const [r,g,b]=hexToRgb(color||C)
  const localLiftL=walkDist>0.1?Math.round(Math.sin(walkDist*.16)*2.2*scale):0
  const localLiftR=walkDist>0.1?Math.round(Math.sin(walkDist*.16+Math.PI)*2.2*scale):0
  ctx.save();ctx.globalAlpha=.98
  ctx.fillStyle=`rgb(${r*.35|0},${g*.35|0},${b*.35|0})`;ctx.strokeStyle=color||C;ctx.lineWidth=1.2
  ctx.fillRect(cx-bodyW*.42,bodyTop,bodyW*.84,bodyH);ctx.strokeRect(cx-bodyW*.42,bodyTop,bodyW*.84,bodyH)
  ctx.fillStyle=`rgb(${r*.48|0},${g*.48|0},${b*.48|0})`
  ctx.fillRect(cx-bodyW*.54,bodyTop+9*scale,bodyW*.12,bodyH*.28);ctx.fillRect(cx+bodyW*.42,bodyTop+9*scale,bodyW*.12,bodyH*.28)
  ctx.fillStyle=`rgba(${r},${g},${b},.38)`;ctx.fillRect(cx-bodyW*.35,bodyTop+8,bodyW*.7,7*scale)
  ctx.fillStyle='#09131d';ctx.fillRect(cx-bodyW*.25,bodyTop+bodyH*.29,bodyW*.5,bodyH*.22)
  ctx.strokeStyle='#67e8f966';ctx.strokeRect(cx-bodyW*.25,bodyTop+bodyH*.29,bodyW*.5,bodyH*.22)
  ctx.fillStyle='#facc15';ctx.fillRect(cx-5*scale,bodyTop+bodyH*.34,10*scale,7*scale)
  ctx.fillStyle='#071019';ctx.fillRect(cx-bodyW*.42,bodyTop+bodyH*.70,bodyW*.84,6*scale)
  ctx.fillStyle=`rgb(${r*.28|0},${g*.28|0},${b*.28|0})`;ctx.fillRect(cx-bodyW*.34,bottomY-9*scale-localLiftL,bodyW*.25,9*scale);ctx.fillRect(cx+bodyW*.09,bottomY-9*scale-localLiftR,bodyW*.25,9*scale)
  ctx.fillStyle=`rgb(${Math.min(255,r*.82+35)|0},${Math.min(255,g*.82+35)|0},${Math.min(255,b*.82+35)|0})`
  ctx.fillRect(cx-headW/2,headTop,headW,headH);ctx.strokeRect(cx-headW/2,headTop,headW,headH)
  ctx.fillStyle='#071722';ctx.fillRect(cx-headW*.36,headTop+headH*.28,headW*.72,headH*.34)
  ctx.fillStyle='#67e8f9';ctx.fillRect(cx-headW*.28,headTop+headH*.36,headW*.56,2*scale)
  ctx.fillStyle=color||C;ctx.fillRect(cx-4*scale,headTop-5*scale,8*scale,5*scale)
  const handX=cx+bodyW*.47,handY=bodyTop+bodyH*.43
  ctx.strokeStyle=`rgb(${r*.72|0},${g*.72|0},${b*.72|0})`;ctx.lineWidth=6*scale;ctx.lineCap='round'
  ctx.beginPath();ctx.moveTo(cx+bodyW*.34,bodyTop+bodyH*.28);ctx.lineTo(handX,handY);ctx.stroke()
  // Thrust toward crosshair: rest is pulled back 0.72rad from target direction
  const sProg3 = Math.sin(swingT*Math.PI)
  const toTarget3 = Math.atan2(H*HORIZON_RATIO - handY, W/2 - handX)
  const pickA = toTarget3 + (1 - sProg3) * 0.72
  const pickL = (64 + sProg3*16) * scale
  drawFreakUsbPen(ctx,handX,handY,pickL,pickA,scale)
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
  const keysRef      = useRef({w:false,s:false,a:false,d:false,q:false,e:false,space:false})
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
  const walkStateRef         = useRef({})
  const myPoolCodeRef        = useRef(myPoolCode || null)
  // Precomputed from cellMap: Map<key,{base,label}> of currently active obstacles
  const validObstaclesRef   = useRef(new Map(OBSTACLE_MAP))
  const chainNodePosRef     = useRef({ row: CHAIN_NODE_ROW, col: CHAIN_NODE_COL })
  // Anon collision push
  const onCollisionPushRef      = useRef(onCollisionPush)
  const collisionPushThrottleRef = useRef(new Map())
  // Skill system
  const critChanceRef       = useRef(0)
  const speedRef            = useRef(MOVE_SPD)
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
  // NFTJI skills: ❤️ → +5% crit chance · ⚔️ (sq-atk) → +10% movement speed
  useEffect(()=>{
    const nfts = myNftjis || []
    critChanceRef.current = nfts.some(n => n.emoji === '❤️') ? 0.05 : 0
    speedRef.current      = nfts.some(n => n.emoji === '⚔️') ? MOVE_SPD * 1.10 : MOVE_SPD
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

    // Authored traversal landmarks get first choice of genuinely empty space;
    // procedural maze walls then fill only what remains.
    addRetroStructures(valid,reserved,cellMap)

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

    // Build a small number of deterministic staircases beside isolated tall
    // obstacles. Each cube is a real collision/support surface, so players can
    // reach the roof through three normal jumps without adding moving geometry.
    let staircases = 0
    const directions = [[1,0],[0,1],[-1,0],[0,-1]]
    const tallObstacles = [...valid.entries()].sort(([a],[b]) => a.localeCompare(b))
    for (const [anchorKey, anchor] of tallObstacles) {
      if (staircases >= MAX_STAIRCASES) break
      if (anchor?.isStair || anchor?.isStructure) continue
      const [anchorRow, anchorCol] = anchorKey.split(',').map(Number)
      const directionOffset = Math.abs(anchorRow * 19 + anchorCol * 23) % directions.length
      let placed = false
      for (let d = 0; d < directions.length && !placed; d++) {
        const [dr,dc] = directions[(d + directionOffset) % directions.length]
        const cells = [1,2,3].map(distance => ({
          row: anchorRow + dr * distance,
          col: anchorCol + dc * distance,
          key: `${anchorRow + dr * distance},${anchorCol + dc * distance}`,
        }))
        const clear = cells.every(({row,col,key}) =>
          row > 1 && row < MM3_BLOCK_GRID_ROWS - 1 &&
          col > 1 && col < MM3_BLOCK_GRID_COLS - 1 &&
          !reserved.has(key) && !valid.has(key) && !cellMap.has(key)
        )
        if (!clear) continue
        for (let index = 0; index < cells.length; index++) {
          const {key} = cells[index]
          const height = STAIR_HEIGHTS[STAIR_HEIGHTS.length - 1 - index]
          valid.set(key, {
            ...anchor,
            height,
            isStair:true,
            label:'CHAIN STEP',
            glow:anchor.glow || [34,211,238],
          })
        }
        staircases++
        placed = true
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
    const tanHalfFov=Math.tan(FOV/2)
    const minVerticalSlope=(viewCenterY-H)/projectionScale
    const maxVerticalSlope=viewCenterY/projectionScale
    const cameraPlanes=[
      v=>v.depth-.16,
      v=>v.depth*tanHalfFov+v.lateral,
      v=>v.depth*tanHalfFov-v.lateral,
      v=>v.vertical-v.depth*minVerticalSlope,
      v=>v.depth*maxVerticalSlope-v.vertical,
    ]
    const clipCameraPolygon=(vertices)=>{
      let polygon=vertices
      for(const distanceToPlane of cameraPlanes){
        if(polygon.length<3) return []
        const out=[]
        for(let i=0;i<polygon.length;i++){
          const a=polygon[i],b=polygon[(i+1)%polygon.length]
          const da=distanceToPlane(a),db=distanceToPlane(b)
          const aIn=da>=0,bIn=db>=0
          if(aIn) out.push(a)
          if(aIn!==bIn){
            const t=da/(da-db)
            out.push({
              lateral:a.lateral+(b.lateral-a.lateral)*t,
              depth:a.depth+(b.depth-a.depth)*t,
              vertical:a.vertical+(b.vertical-a.vertical)*t,
            })
          }
        }
        polygon=out
      }
      return polygon
    }
    const screenVertex=v=>({
      x:W/2+v.lateral*horizontalProjection/v.depth,
      y:viewCenterY-v.vertical*projectionScale/v.depth,
    })
    const projectSegment=(a,b)=>{
      let va=cameraVertex(...a),vb=cameraVertex(...b)
      for(const distanceToPlane of cameraPlanes){
        const da=distanceToPlane(va),db=distanceToPlane(vb)
        if(da<0&&db<0) return null
        if((da<0)!==(db<0)){
          const t=da/(da-db)
          const mid={
            lateral:va.lateral+(vb.lateral-va.lateral)*t,
            depth:va.depth+(vb.depth-va.depth)*t,
            vertical:va.vertical+(vb.vertical-va.vertical)*t,
          }
          if(da<0) va=mid; else vb=mid
        }
      }
      return [screenVertex(va),screenVertex(vb),Math.min(va.depth,vb.depth)]
    }

    // Atmospheric tint from current room
    const {row:gr,col:gc} = worldToGrid(px,py)
    const viewMinRow=Math.max(0,gr-VISUAL_RANGE)
    const viewMaxRow=Math.min(ROWS-1,gr+VISUAL_RANGE)
    const viewMinCol=Math.max(0,gc-VISUAL_RANGE)
    const viewMaxCol=Math.min(COLS-1,gc+VISUAL_RANGE)
    const gridMinRow=Math.max(0,gr-FLOOR_GRID_RANGE)
    const gridMaxRow=Math.min(ROWS-1,gr+FLOOR_GRID_RANGE)
    const gridMinCol=Math.max(0,gc-FLOOR_GRID_RANGE)
    const gridMaxCol=Math.min(COLS-1,gc+FLOOR_GRID_RANGE)
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
      if(validObstaclesRef.current.has(key)) return obstacleTop(validObstaclesRef.current.get(key))
      if(cellMap.has(key)) return BLOCK_TOP
      return 0
    }
    ctx.save()
    ctx.beginPath(); ctx.rect(0, Math.max(0, sceneSplitY - 1), W, H); ctx.clip()
    ctx.globalAlpha=.12;ctx.strokeStyle=C;ctx.lineWidth=1;ctx.beginPath()
    for(let c=gridMinCol;c<=gridMaxCol+1;c++){
      const seg=projectSegment([c,gridMinRow,0],[c,gridMaxRow+1,0]); if(!seg) continue
      const [a,b,d]=seg; if(d>FLOOR_GRID_RANGE) continue
      ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)
    }
    for(let r=gridMinRow;r<=gridMaxRow+1;r++){
      const seg=projectSegment([gridMinCol,r,0],[gridMaxCol+1,r,0]); if(!seg) continue
      const [a,b,d]=seg; if(d>FLOOR_GRID_RANGE) continue
      ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)
    }
    ctx.stroke()
    ctx.restore()
    ctx.globalAlpha=1

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
      const verts=clipCameraPolygon([
        cameraVertex(c,r,topHeight),cameraVertex(c+1,r,topHeight),
        cameraVertex(c+1,r+1,topHeight),cameraVertex(c,r+1,topHeight),
      ])
      if(verts.length<3) continue
      const points=verts.map(screenVertex)
      const area=Math.abs(points.reduce((sum,point,index)=>{
        const next=points[(index+1)%points.length]
        return sum+point.x*next.y-next.x*point.y
      },0))*.5
      const minY=Math.min(...points.map(point=>point.y))
      const maxY=Math.max(...points.map(point=>point.y))
      const minX=Math.min(...points.map(point=>point.x))
      const maxX=Math.max(...points.map(point=>point.x))
      const projectedWidth=maxX-minX
      const projectedHeight=maxY-minY
      if(!Number.isFinite(area)||area<0.5||area>W*H*.72) continue
      const depth=verts.reduce((sum,v)=>sum+v.depth,0)/verts.length
      if(depth>3&&projectedWidth>projectedHeight*22) continue
      // Smooth fade for nearly edge-on tops instead of hard cutoff
      const edgeAlpha=projectedHeight<5?projectedHeight/5:1
      const areaAlpha=area<4?area/4:1
      tops.push({r,c,points,depth,topHeight,area,alpha:edgeAlpha*areaAlpha})
    }
    tops.sort((a,b)=>b.depth-a.depth)
    for(const top of tops){
      const key=`${top.r},${top.c}`,obs=validObstaclesRef.current.get(key),cell=cellMap.get(key)
      const base=obs?.base||(cell?.color?hexToRgb(cell.color):cell?.isChainNode?[220,170,25]:[48,82,142])
      // Top faces receive overhead light: brighter than side faces (side=0 at 1.0x, side=1 at 0.72x)
      const light=Math.max(.55,1-top.depth*.022)
      const topMul=obs?1.08:1.22  // obstacle tops slightly brighter, block tops clearly brighter
      const [tr,tg,tb]=[Math.min(255,Math.round(base[0]*light*topMul)),Math.min(255,Math.round(base[1]*light*topMul)),Math.min(255,Math.round(base[2]*light*topMul))]
      ctx.save()
      ctx.globalAlpha=top.alpha??1
      ctx.fillStyle=`rgb(${tr},${tg},${tb})`
      ctx.strokeStyle=top.area>10?'rgba(220,240,255,.28)':'rgba(220,240,255,.12)';ctx.lineWidth=1
      ctx.beginPath();ctx.moveTo(top.points[0].x,top.points[0].y)
      for(let i=1;i<top.points.length;i++)ctx.lineTo(top.points[i].x,top.points[i].y)
      ctx.closePath();ctx.fill();ctx.stroke()
      if(top.depth<7&&top.area>20){
        const a=projectSegment([top.c+.5,top.r,top.topHeight+.003],[top.c+.5,top.r+1,top.topHeight+.003])
        const b=projectSegment([top.c,top.r+.5,top.topHeight+.003],[top.c+1,top.r+.5,top.topHeight+.003])
        ctx.strokeStyle='rgba(0,0,0,.18)';ctx.beginPath()
        if(a){ctx.moveTo(a[0].x,a[0].y);ctx.lineTo(a[1].x,a[1].y)}
        if(b){ctx.moveTo(b[0].x,b[0].y);ctx.lineTo(b[1].x,b[1].y)}
        ctx.stroke()
      }
      ctx.restore()
    }

    // Pre-compute forward cell
    const {mx:fwdMx,my:fwdMy,cell:fwdCell,perpDist:fwdDist} = castRay(px,py,angle,cellMap,validObstaclesRef.current)
    const fwdFaceSolid=Boolean(fwdCell)

    // Collect cells with emoji visible on any wall face
    const visibleWalls = new Map()

    // ── Wall strips + build zBuffer ───────────────────────────────────────────
    for (let col=0; col<strips; col++){
      const ra = angle - FOV/2 + (col+0.5)*FOV/strips
      const layers=castRayLayers(px,py,ra,cellMap,validObstaclesRef.current,VISUAL_RANGE)
      const nearest=layers[0]
      zBuffer[col]=nearest?nearest.perpDist*Math.cos(ra-angle):VISUAL_RANGE
      for(let layerIndex=layers.length-1;layerIndex>=0;layerIndex--){
      const {perpDist,cell,side,mx:hitMx,my:hitMy}=layers[layerIndex]
      const dist=perpDist*Math.cos(ra-angle)
      const wallTop = cell?.isObstacle ? obstacleTop(cell) : BLOCK_TOP
      const wallBase = cell?.isObstacle ? obstacleBottom(cell) : 0
      const projectedTop = projectY(wallTop, dist)
      const projectedBottom = projectY(wallBase, dist)
      const rawTop=Math.min(projectedTop,projectedBottom)
      const rawBottom=Math.max(projectedTop,projectedBottom)
      if(!Number.isFinite(rawTop)||!Number.isFinite(rawBottom)||rawBottom<0||rawTop>H) continue
      const wTop=Math.max(0,Math.floor(rawTop))
      const wallBottom=Math.min(H,Math.ceil(rawBottom))
      const wallH=wallBottom-wTop
      if(wallH<1) continue

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
        // Top edge: bright highlight where the top face meets the side face
        if (wallH > 6) {
          const hlH = Math.max(2, Math.round(wallH*0.08))
          ctx.fillStyle = 'rgba(255,255,255,0.22)'
          ctx.fillRect(col*stripW, wTop, stripW, hlH)
        }
        // Bottom AO: contact shadow where block sits on the floor
        const edgeH = Math.max(2, Math.round(wallH*0.10))
        ctx.fillStyle = 'rgba(0,0,0,0.32)'
        ctx.fillRect(col*stripW, wTop+wallH-edgeH, stripW, edgeH)
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
        w, tX, tY, dist, gx: sgx, gy: sgy, z:remoteZ, supportZ,
        angle:Number(pres.angle)||0, swingAt:Number(pres.swingAt)||0,
        isBot:Boolean(pres.isBot), taskLabel:pres.taskLabel||null, taskPhase:pres.taskPhase||null,
        color: colorFromAddress(w),
      })
    }
    sprites.sort((a,b) => b.dist - a.dist)

    for (const { w, tX, tY, gx, gy, z:remoteZ, supportZ, angle:remoteAngle, swingAt, isBot, taskLabel, taskPhase, color } of sprites) {
      const groundCamera = cameraPoint(0, tY)
      if (groundCamera.rotatedDepth <= 0.05) continue
      const scrX = Math.round(W/2 + tX*horizontalProjection/groundCamera.rotatedDepth)
      const [cr,cg2,cb] = hexToRgb(color)
      const fade  = Math.max(0.32, 1 - tY*0.038)
      const alpha = Math.min(0.98, Math.max(0.12, 1.0 - tY*0.028))

      // Walk state: detect server-side position change to enable foot animation
      const wsEntry = walkStateRef.current[w] || (walkStateRef.current[w] = { gx, gy, lastMove: 0 })
      if (Math.abs(gx - wsEntry.gx) > 0.005 || Math.abs(gy - wsEntry.gy) > 0.005) {
        wsEntry.gx = gx; wsEntry.gy = gy; wsEntry.lastMove = Date.now()
      }
      const isWalking = (Date.now() - wsEntry.lastMove) < 600
      const walkPhase = isWalking ? Date.now() / 280 + (w.charCodeAt(2) || 0) * 0.7 : 0
      const liftL = isWalking ? Math.round(Math.sin(walkPhase) * 2) : 0
      const liftR = isWalking ? Math.round(Math.sin(walkPhase + Math.PI) * 2) : 0

      // Use 2D floor distance (tY) for scale so all players at the same distance
      // appear identically sized regardless of pitch angle.
      const stableDepth = Math.max(0.72, tY)
      const cellScale = projectionScale / stableDepth
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
        ctx.fillRect(scrX-Math.round(walletW*.34),bottomY-bootH-liftL,bootW,bootH)
        ctx.fillRect(scrX+Math.round(walletW*.06),bottomY-bootH-liftR,bootW,bootH)
        ctx.globalAlpha=1
      }

      // Freak USB Pen (same tool and swing timing as the local avatar)
      const pkZCol = Math.floor(scrX / stripW)
      if (pkZCol >= 0 && pkZCol < strips && tY < zBuffer[pkZCol]) {
        // The remote is seen from the front, so its anatomical right appears
        // on our screen-left (mirror relation between facing characters).
        const relativeFacing=Math.sin(remoteAngle-angle)
        const pickSide=relativeFacing>=0?-1:1
        const pkBX = scrX + pickSide*Math.round(walletW*0.54)
        const pkBY = Math.round(foldY + walletH * 0.05)
        const remoteSwingAge = Date.now()-(swingAt||swingMapRef.current[w]||0)
        const remoteSwingT   = remoteSwingAge < SWING_DUR ? remoteSwingAge / SWING_DUR : 0
        const rsProg = Math.sin(remoteSwingT*Math.PI)
        // At rest: weapon angled back from viewer; at apex: points at viewer's crosshair
        const pkAbase = Math.atan2(H*HORIZON_RATIO - pkBY, W/2 - pkBX)
        const pkA = pkAbase + (1 - rsProg) * pickSide * 0.72
        const pkL = Math.max(5, Math.round(walletH * (0.55 + rsProg*0.12)))
        drawFreakUsbPen(ctx,pkBX,pkBY,pkL,pkA,Math.max(.28,pkL/64),alpha*.9)
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
    // Use the actual wall top height so the crosshair activates across the full obstacle face
    const fwdWallTopH = fwdCell?.isObstacle ? obstacleTop(fwdCell) : BLOCK_TOP
    const fwdWallBottomH = fwdCell?.isObstacle ? obstacleBottom(fwdCell) : 0
    const fwdProjectedTop = projectY(fwdWallTopH, fwdDist)
    const fwdProjectedBottom = projectY(fwdWallBottomH, fwdDist)
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

    drawMinimap(ctx,gr,gc,angle,cellMap,presence,myIdentity,W,H,chainNodePosRef.current,validObstaclesRef.current,px/CELL_SIZE,py/CELL_SIZE)
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
      const targetSpeed=speedRef.current
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
        const supportHeight = supportHeightAt(
          p.x/CELL_SIZE,
          p.y/CELL_SIZE,
          p.z,
          cellMapRef.current,
          validObstaclesRef.current,
        )
        const floorZ = supportHeight&&p.z>=supportHeight ? supportHeight : 0
        if(p.z > floorZ || p.vz > 0){
          p.vz -= GRAVITY_A*dt
          let nz = p.z + p.vz*dt
          const ceilingBottom=ceilingBottomAt(
            p.x/CELL_SIZE,p.y/CELL_SIZE,p.z,
            cellMapRef.current,validObstaclesRef.current,
          )
          if(p.vz>0&&ceilingBottom&&nz+PLAYER_BODY_H>=ceilingBottom){
            nz=ceilingBottom-PLAYER_BODY_H-.02
            p.vz=0
          }
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

      // ── Enemy sprite targeting (screen-space, zoom-invariant) ─────────────
      const camGX = p.x / CELL_SIZE, camGY = p.y / CELL_SIZE
      let closestEnemy = null, closestDist = Infinity
      const myW = myWalletRef.current
      const myIdentity = presenceKeyRef.current||myW
      // Derive canvas dimensions — same formula as the draw function so the
      // crosshair check uses the identical coordinate system.
      const _cvs = canvasRef.current
      const _dpr = _cvs ? (Number(_cvs.dataset.dpr) || 1) : 1
      const _W   = _cvs ? Math.round(_cvs.width  / _dpr) : 640
      const _H   = _cvs ? Math.round(_cvs.height / _dpr) : 400
      const _projScale  = _H * PROJ_DIST
      const _hProj      = _W / (2 * Math.tan(FOV / 2))
      const _viewCY     = _H * HORIZON_RATIO
      const _pitch      = p.pitch || 0
      const _cosP = Math.cos(_pitch), _sinP = Math.sin(_pitch)
      const _cx = _W / 2, _cy = _viewCY   // crosshair screen position
      for (const [w, pres] of remoteVisualsRef.current.entries()) {
        const isMe = w.toLowerCase() === (myIdentity || '').toLowerCase()
        if (isMe) continue
        const sgx = pres.gx ?? ((pres.col ?? 0) + 0.5)
        const sgy = pres.gy ?? ((pres.row ?? 0) + 0.5)
        const rx = sgx - camGX, ry = sgy - camGY
        const tY = Math.cos(p.angle)*rx + Math.sin(p.angle)*ry
        if (tY < 0.15 || tY > INTERACT_DIST) continue
        const tX = -Math.sin(p.angle)*rx + Math.cos(p.angle)*ry
        // Project the sprite to screen-space using the same math as the renderer.
        const remoteZ = Number(pres.z) || 0
        const verticalGap=Math.abs(remoteZ-p.z)
        if(verticalGap>.90||Math.hypot(tY,verticalGap)>INTERACT_DIST) continue
        const relZ    = remoteZ - (p.z + CAMERA_EYE_Z)
        const rotV    = relZ * _cosP + tY * _sinP
        const rotD    = tY  * _cosP - relZ * _sinP
        if (rotD <= 0.05) continue
        const scrX    = Math.round(_cx + tX * _hProj / rotD)
        const bottomY = Math.min(_H+30, Math.round(_viewCY - rotV * _projScale / rotD))
        const sScale  = Math.min(_projScale / Math.max(0.72, tY), 150)
        const walletH = Math.round(sScale * 0.58)
        const walletW = Math.round(sScale * 0.50)
        const billsH  = Math.round(sScale * 0.20)
        const walletTop = bottomY - walletH
        const billsTop  = walletTop - billsH
        // Horizontal: crosshair must be within sprite width (+10% tolerance)
        if (Math.abs(_cx - scrX) > walletW * 0.60) continue
        // Vertical: determine zone from screen Y of crosshair vs sprite bands
        const hitZone = _cy >= billsTop && _cy <= walletTop ? 'head'
                      : _cy >  walletTop && _cy <= bottomY  ? 'body'
                      : null
        if (!hitZone) continue
        const enemyPool  = presenceRef.current[w]?.poolCode || null
        const myPool     = myPoolCodeRef.current
        const isTeammate = !!(myPool && enemyPool && myPool === enemyPool)
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
