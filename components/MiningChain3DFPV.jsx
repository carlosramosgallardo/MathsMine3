'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { colorFromAddress } from '@/lib/wallet-colors'
import { MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS, gridToBlockHex, MM3_BLOCK_REQUIREMENT_BY_HEX, doesGlobalValueMeetRequirement } from '@/lib/mm3-block-chain'
import supabase from '@/lib/supabaseClient'
import { groupPresenceEntries } from '@/lib/presence-display'
import {
  CRYPTO_COLOSSEUM_BOUNDS,
  MINING_CHAIN_NODE_POSITION,
  MINING_WORLD_COLS,
  MINING_WORLD_ROWS,
} from '@/lib/mining-world-layout'

const ROWS = MINING_WORLD_ROWS   // double the inner mining grid for free walking space
const COLS = MINING_WORLD_COLS
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
const PLAYER_R      = 0.28   // collision radius in grid units — matches visual avatar half-width so body doesn't clip walls
const PLAYER_BODY_H = 1.02   // physical body height for bridges and overhangs
const AVATAR_R      = 0.30
const FOOTSTEP_DIST = CELL_SIZE * 0.42       // footstep cadence
const SWING_DUR     = 340    // ms per USB staff swing
const HITS_NEEDED   = 5      // swings to complete mining action
const INTERACT_DIST       = 1.3   // grid cells — max distance for block interaction
// The chain node fills a solid cell, so PLAYER_R keeps the player's centre at
// least 0.78 cells from its centre. Use the regular hit range so it is reachable.
const CHAIN_INTERACT_DIST = INTERACT_DIST
const PVP_HIT_RANGE   = 1.3  // grid cells — max distance to land a PvP hit (shorter = harder to spam, easier to dodge)
const PVP_SIGHT_RANGE = 2.5  // grid cells — wider cone: enemy visible in crosshair but out of hit range → MISS
const VISUAL_RANGE  = 18     // far plane in cells; physics still uses the full map
const FLOOR_GRID_RANGE = 12  // distant grid lines merge into unstable horizon bands
const RADAR_RANGE   = 18     // square local map using the same camera frustum
const CHAIN_NODE_ROW = MINING_CHAIN_NODE_POSITION.row
const CHAIN_NODE_COL = MINING_CHAIN_NODE_POSITION.col
// Jump: a player can mount mining blocks, but structural walls stay impassable.
const JUMP_VZ   = 5.7        // jump impulse (grid units / second)
const GRAVITY_A = 13.5       // gravity (grid units / second²)
const BLOCK_TOP = 0.50       // fallback height for mining blocks (50 % — keeps them jumpable)
const OBSTACLE_TOP = 2.35    // above the maximum single-jump apex
const BRIDGE_BOTTOM = 1.42   // enough clearance for a wallet walking below
const BRIDGE_TOP = 1.82      // unreachable from the floor without stairs
const STAIR_HEIGHTS = [0.58, 1.16, 1.74]
const MAX_STAIRCASES = 22
const MAX_JUMPS = 1
const REMOTE_AVATAR_VISUAL_SCALE = .48
const REMOTE_AVATAR_MODEL_HEIGHT = 1.10
const ORGANIC_SHAPES = new Set(['ramp','sphere','tree'])
const COLOSSEUM_STAND_BASE_TOPS = [1.00,1.32,1.64]
const COLOSSEUM_SEAT_HEIGHT = .18
const COLOSSEUM_STAND_TOPS = COLOSSEUM_STAND_BASE_TOPS.map(top=>top+COLOSSEUM_SEAT_HEIGHT)

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
  // Explicit landmark/structure materials win over the deterministic fallback.
  return { ...material, ...data }
}

function obstacleTop(data) {
  const height = Number(data?.height)
  return Number.isFinite(height) && height > 0 ? height : OBSTACLE_TOP
}

function blockTop(cell,row=0,col=0) {
  if(!cell) return 0
  if(cell.isPortalNode||cell.isChainNode) return 1.0
  const raw=String(cell.blockHex||gridToBlockHex(row,col)||'').replace('#','')
  const index=Number.parseInt(raw,16)
  if(!Number.isFinite(index)) return cell.isMarket?0.58:BLOCK_TOP
  // The immutable #hex selects a visual/physical tier without changing chain identity.
  // All heights kept below the jump apex (~1.20 u) so the player can vault any block.
  const tier=Math.abs((index*17+row*7+col*11)%8)
  if(tier<2) return 0.50
  if(tier<6) return 0.69
  return 0.84
}

function obstacleBottom(data) {
  const bottom = Number(data?.bottom)
  return Number.isFinite(bottom) && bottom > 0 ? bottom : 0
}

function blocksGround(data) {
  return obstacleBottom(data) < PLAYER_BODY_H - .04
}

function isOrganicShape(data) {
  return ORGANIC_SHAPES.has(data?.shape)
}

function rampHeightAt(data,gx,gy,row,col) {
  const fx=Math.max(0,Math.min(1,gx-col)),fy=Math.max(0,Math.min(1,gy-row))
  const progress=data?.direction==='west'?1-fx:data?.direction==='south'?fy:data?.direction==='north'?1-fy:fx
  return obstacleBottom(data)+Math.max(0,obstacleTop(data)-obstacleBottom(data))*progress
}

function circleTouchesRoundObstacle(gx,gy,row,col,obstacle,playerRadius=PLAYER_R) {
  const radius=Number(obstacle?.radius)||(obstacle?.shape==='tree' ? .25 : .34)
  return Math.hypot(gx-(col+.5),gy-(row+.5))<radius+playerRadius
}

function makeColosseumStandEntries() {
  const entries=[]
  const seatCoords=[23,24,25,29,30,31]
  for(let tier=0;tier<3;tier++){
    const low=22-tier,high=32+tier,height=COLOSSEUM_STAND_TOPS[tier]
    const data={
      base:W_SAND,label:'ARENA STAND',height,
      visualHeight:COLOSSEUM_STAND_BASE_TOPS[tier],isArenaStand:true,
    }
    for(const coord of seatCoords){
      entries.push([`${low},${coord}`,data],[`${high},${coord}`,data])
      entries.push([`${coord},${low}`,data],[`${coord},${high}`,data])
    }
  }
  return entries
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

  // ─── Inner zone — bridges with single step-stone access each side ───────────
  // One h=0.58 step per bridge side: from that height the jump apex (~1.78) just
  // clears the 1.74 deck.  No double-step stacks — those were creating narrow
  // corridors that trapped the player.

  // Bridge 1: E-W at row 8
  ['8,12',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['8,13',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['8,14',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['8,15',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['9,13',  { base:W_DARK, label:'WALL', height:0.58 }],  // S step
  ['7,14',  { base:W_DARK, label:'WALL', height:0.58 }],  // N step

  // Bridge 2: E-W at row 19
  ['19,12', { base:W_DARK, label:'WALL', height:1.74 }],
  ['19,13', { base:W_DARK, label:'WALL', height:1.74 }],
  ['19,14', { base:W_DARK, label:'WALL', height:1.74 }],
  ['19,15', { base:W_DARK, label:'WALL', height:1.74 }],
  ['18,14', { base:W_DARK, label:'WALL', height:0.58 }],  // N step
  ['20,13', { base:W_DARK, label:'WALL', height:0.58 }],  // S step

  // Bridge 3: N-S at col 8
  ['12,8',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['13,8',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['14,8',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['15,8',  { base:W_DARK, label:'WALL', height:1.74 }],
  ['13,9',  { base:W_DARK, label:'WALL', height:0.58 }],  // E step
  ['14,7',  { base:W_DARK, label:'WALL', height:0.58 }],  // W step

  // Bridge 4: N-S at col 19 (skips row 14 — existing W_SAND wall there)
  ['12,19', { base:W_DARK, label:'WALL', height:1.74 }],
  ['13,19', { base:W_DARK, label:'WALL', height:1.74 }],
  ['15,19', { base:W_DARK, label:'WALL', height:1.74 }],
  ['13,18', { base:W_DARK, label:'WALL', height:0.58 }],  // W step
  ['12,20', { base:W_DARK, label:'WALL', height:0.58 }],  // E step

  // Sub-quadrant landmark pylons — single isolated cells, no wall clusters
  ['7,7',   { base:W_SLATE, label:'WALL' }],
  ['7,20',  { base:W_SLATE, label:'WALL' }],
  ['20,7',  { base:W_SLATE, label:'WALL' }],
  ['20,20', { base:W_SLATE, label:'WALL' }],

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
  ['22,37',  { base:W_STONE, label:'WALL' }],
  ['22,38',  { base:W_STONE, label:'WALL' }],
  ['22,44',  { base:W_STONE, label:'WALL' }],
  ['22,45',  { base:W_STONE, label:'WALL' }],
  ['22,50',  { base:W_STONE, label:'WALL' }],
  ['22,51',  { base:W_STONE, label:'WALL' }],
  ['22,52',  { base:W_STONE, label:'WALL' }],
  ['24,36',  { base:W_DARK, label:'WALL' }],
  ['24,37',  { base:W_DARK, label:'WALL' }],
  ['24,38',  { base:W_DARK, label:'WALL' }],
  ['24,43',  { base:W_DARK, label:'WALL' }],
  ['24,44',  { base:W_DARK, label:'WALL' }],
  ['24,50',  { base:W_DARK, label:'WALL' }],
  ['24,51',  { base:W_DARK, label:'WALL' }],
  // Band 6 (rows 25-27)
  ['25,39',  { base:W_SLATE, label:'WALL' }],
  ['25,40',  { base:W_SLATE, label:'WALL' }],
  ['25,46',  { base:W_SLATE, label:'WALL' }],
  ['25,47',  { base:W_SLATE, label:'WALL' }],
  ['25,53',  { base:W_SLATE, label:'WALL' }],
  ['25,54',  { base:W_SLATE, label:'WALL' }],
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
  ['31,4',   { base:W_DARK, label:'WALL' }],
  ['31,5',   { base:W_DARK, label:'WALL' }],
  ['31,10',  { base:W_DARK, label:'WALL' }],
  ['31,11',  { base:W_DARK, label:'WALL' }],
  ['31,16',  { base:W_DARK, label:'WALL' }],
  ['31,17',  { base:W_DARK, label:'WALL' }],
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
  ['23,36',  { base:W_SLATE, label:'WALL' }],
  ['23,37',  { base:W_SLATE, label:'WALL' }],
  ['23,42',  { base:W_SLATE, label:'WALL' }],
  ['23,43',  { base:W_SLATE, label:'WALL' }],
  ['23,49',  { base:W_SLATE, label:'WALL' }],
  ['23,50',  { base:W_SLATE, label:'WALL' }],
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
  ['32,4',   { base:W_STONE, label:'WALL' }],
  ['32,5',   { base:W_STONE, label:'WALL' }],
  ['32,10',  { base:W_STONE, label:'WALL' }],
  ['32,11',  { base:W_STONE, label:'WALL' }],
  ['32,15',  { base:W_STONE, label:'WALL' }],
  ['32,16',  { base:W_STONE, label:'WALL' }],
  ['32,21',  { base:W_STONE, label:'WALL' }],
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
  ['28,33',  { base:W_DARK,  label:'WALL' }],
  ['28,40',  { base:W_DARK,  label:'WALL' }],
  ['28,41',  { base:W_DARK,  label:'WALL' }],
  ['28,48',  { base:W_DARK,  label:'WALL' }],
  ['28,49',  { base:W_DARK,  label:'WALL' }],
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

  // ─── CRYPTO COLOSSEUM — PvP arena centered on chain node (27,27) ─────────────
  // Square perimeter at rows 22,32 / cols 22,32.  Arena floor rows 23-31, cols 23-31 cleared.
  // Entrance gaps 3 cells wide (centered on row/col 27): rows 26-28 or cols 26-28.
  // Inner ring height=1.1 → barely jump-clearable (apex ≈ 1.20).  Pylons height=2.2.
  // Gate pillars height=2.0 flank each entrance just outside the ring.

  // Corner pylons — imposing dark towers at the four arena corners
  ['22,22', { base:W_DARK, label:'ARENA PYLON', height:2.2 }],
  ['22,32', { base:W_DARK, label:'ARENA PYLON', height:2.2 }],
  ['32,22', { base:W_DARK, label:'ARENA PYLON', height:2.2 }],
  ['32,32', { base:W_DARK, label:'ARENA PYLON', height:2.2 }],

  // Three solid, climbable seating tiers with four three-cell entrances.
  ...makeColosseumStandEntries(),

  // Gate pillars — flank each entrance just outside the ring (override any existing entry)
  ['21,25', { base:W_DARK, label:'ARENA GATE', height:2.0 }],
  ['21,29', { base:W_DARK, label:'ARENA GATE', height:2.0 }],
  ['33,25', { base:W_DARK, label:'ARENA GATE', height:2.0 }],
  ['33,29', { base:W_DARK, label:'ARENA GATE', height:2.0 }],
  ['25,21', { base:W_DARK, label:'ARENA GATE', height:2.0 }],
  ['29,21', { base:W_DARK, label:'ARENA GATE', height:2.0 }],
  ['25,33', { base:W_DARK, label:'ARENA GATE', height:2.0 }],
  ['29,33', { base:W_DARK, label:'ARENA GATE', height:2.0 }],
])

function addColosseumBridge(valid) {
  const centerX=MINING_CHAIN_NODE_POSITION.col+.5
  const centerZ=MINING_CHAIN_NODE_POSITION.row+.5
  for(let row=18;row<=37;row++){
    for(let col=18;col<=37;col++){
      const distance=Math.hypot(col+.5-centerX,row+.5-centerZ)
      if(distance<7.45||distance>8.55) continue
      const key=`${row},${col}`
      valid.set(key,chainObstacle(key,{
        base:[34,82,104],glow:[34,211,238],kind:'hash',label:'COLOSSEUM RING',
        bottom:BRIDGE_BOTTOM,height:BRIDGE_TOP,
        isStructure:true,isRoute:true,isColosseumBridge:true,
      }))
    }
  }

  const stairHeights=[.45,.90,1.36]
  for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    stairHeights.forEach((height,index)=>{
      const distance=5+index
      const row=MINING_CHAIN_NODE_POSITION.row+dr*distance
      const col=MINING_CHAIN_NODE_POSITION.col+dc*distance
      const key=`${row},${col}`
      valid.set(key,chainObstacle(key,{
        base:[96,78,48],glow:[250,204,21],kind:'ledger',label:'RING ACCESS',
        height,isStructure:true,isRouteStair:true,isColosseumAccess:true,
      }))
    })
  }
}

function addRetroStructures(valid, reserved, cellMap) {
  const keyOf=(row,col)=>`${row},${col}`
  const routeFree=(row,col)=>row>1&&row<ROWS-2&&col>1&&col<COLS-2&&!cellMap.has(keyOf(row,col))&&!reserved.has(keyOf(row,col))
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
  addColosseumBridge(valid)
}

function addDenseMaze(valid,reserved,cellMap){
  const materials=[
    {base:W_DARK,label:'MAZE WALL'},
    {base:W_SLATE,label:'MAZE WALL'},
    {base:W_STONE,label:'MAZE WALL'},
    {base:W_SAND,label:'MAZE WALL'},
  ]
  const place=(row,col,data)=>{
    const key=`${row},${col}`
    if(row<2||row>=ROWS-2||col<2||col>=COLS-2) return
    if(reserved.has(key)||cellMap.has(key)||valid.has(key)) return
    valid.set(key,chainObstacle(key,{...data,isMaze:true}))
  }

  // Four architectural districts. Long empty avenues alternate with compact
  // wall runs, gateway pylons and occasional courtyards, producing a believable
  // place instead of a uniform obstacle field.
  const districts=[
    {r0:3,r1:25,c0:3,c1:25,axis:'h'},
    {r0:3,r1:25,c0:30,c1:52,axis:'v'},
    {r0:30,r1:52,c0:3,c1:25,axis:'v'},
    {r0:30,r1:52,c0:30,c1:52,axis:'h'},
  ]
  districts.forEach((district,districtIndex)=>{
    const horizontal=district.axis==='h'
    const lanes=horizontal
      ? [district.r0+5,district.r0+13]
      : [district.c0+5,district.c0+13]
    lanes.forEach((lane,laneIndex)=>{
      const start=horizontal?district.c0:district.r0
      const end=horizontal?district.c1:district.r1
      for(let cursor=start;cursor<=end;cursor++){
        const local=cursor-start
        // Wide gates every 8 cells keep sightlines and circulation legible.
        if(local%9<3) continue
        const row=horizontal?lane:cursor,col=horizontal?cursor:lane
        place(row,col,{...materials[(districtIndex+laneIndex)%materials.length],height:2.15+laneIndex*.25,isArchitecture:true})
      }
    })

    // Paired pylons mark district entrances and intersections.
    const pylons=horizontal
      ? [[district.r0+4,district.c0+3],[district.r0+6,district.c0+3],[district.r0+12,district.c1-3],[district.r0+14,district.c1-3]]
      : [[district.r0+3,district.c0+4],[district.r0+3,district.c0+6],[district.r1-3,district.c0+12],[district.r1-3,district.c0+14]]
    pylons.forEach(([row,col],index)=>place(row,col,{
      base:index%2?[38,88,76]:[42,82,104],glow:[34,211,238],kind:'data',
      label:'CHAIN PYLON',height:2.7,isArchitecture:true,isPylon:true,
    }))
  })

  // Irregular ruin compounds fill otherwise empty pockets with L-shaped walls,
  // staggered towers and small courtyards. Patterns rotate per anchor so the
  // four districts do not feel stamped from the same template.
  const ruinPatterns=[
    [[0,0],[1,0],[2,0],[2,1],[2,2],[0,3],[1,3]],
    [[0,0],[0,1],[0,2],[1,2],[2,2],[3,0],[3,1]],
    [[0,0],[1,0],[1,1],[1,2],[2,2],[3,2],[3,3]],
    [[0,1],[1,1],[2,1],[2,2],[2,3],[0,3],[3,0]],
  ]
  const anchors=[[5,5],[5,19],[5,34],[8,47],[17,8],[18,34],[32,5],[34,19],[32,34],[35,47],[46,7],[46,34],[48,47]]
  anchors.forEach(([baseRow,baseCol],compoundIndex)=>{
    const pattern=ruinPatterns[compoundIndex%ruinPatterns.length]
    pattern.forEach(([dr,dc],partIndex)=>place(baseRow+dr,baseCol+dc,{
      base:partIndex%3===0?[48,64,78]:[66,70,78],
      glow:partIndex%3===0?[34,211,238]:[103,232,249],
      kind:partIndex%3===0?'data':'hash',label:'CHAIN RUIN',
      height:partIndex%4===0?2.8:2.05+(partIndex%2)*.35,
      isArchitecture:true,isRuin:true,
    }))
  })
}

function addOrganicObstacles(valid,reserved,cellMap){
  const free=(row,col,clearance=0)=>{
    if(row<2||row>=ROWS-2||col<2||col>=COLS-2) return false
    for(let dr=-clearance;dr<=clearance;dr++) for(let dc=-clearance;dc<=clearance;dc++){
      const key=`${row+dr},${col+dc}`
      if(reserved.has(key)||cellMap.has(key)||valid.has(key)) return false
    }
    return true
  }

  // Each quadrant gets its own palette so environments look distinct.
  // 0=Genesis(NW), 1=DataVault(NE), 2=Legacy(SW), 3=Nexus(SE)
  const zoneOf=(row,col)=>(row<28&&col<28)?0:(row<28?1:(col<28?2:3))
  const rampStyle =[
    {base:[48,72,82], glow:[34,211,238], kind:'data',      label:'GENESIS RAMP'  },
    {base:[52,78,112],glow:[103,232,249],kind:'hash',      label:'VAULT RAMP'    },
    {base:[108,92,62],glow:[250,204,21], kind:'ledger',    label:'LEGACY RAMP'   },
    {base:[78,42,102],glow:[217,70,239], kind:'consensus', label:'NEXUS RAMP'    },
  ]
  const sphereStyle=[
    {base:[38,62,72], glow:[34,211,238], kind:'data',      label:'GENESIS NODE'  },
    {base:[42,82,122],glow:[103,232,249],kind:'hash',      label:'DATA ORB'      },
    {base:[98,82,52], glow:[250,204,21], kind:'ledger',    label:'CHAIN STONE'   },
    {base:[88,52,112],glow:[217,70,239], kind:'consensus', label:'VOTE ORB'      },
  ]
  const treeStyle =[
    {base:[42,68,72], glow:[34,211,238], kind:'data',      label:'HASH TREE'     },
    {base:[46,78,108],glow:[103,232,249],kind:'hash',      label:'VAULT SPIRE'   },
    {base:[92,78,48], glow:[250,180,21], kind:'ledger',    label:'RUIN PILLAR'   },
    {base:[82,46,108],glow:[217,70,239], kind:'consensus', label:'NEXUS SPIRE'   },
  ]

  const candidates=[]
  for(let row=4;row<ROWS-4;row+=3) for(let col=4;col<COLS-4;col+=3){
    const score=Math.abs((row*73+col*41+row*col*11)%997)
    candidates.push({row,col,score})
  }
  candidates.sort((a,b)=>a.score-b.score)
  const totals={ramp:0,sphere:0,tree:0}
  const limits={ramp:12,sphere:14,tree:12}
  for(const {row,col,score} of candidates){
    const shape=score%5<2?'ramp':score%5===2?'sphere':'tree'
    if(totals[shape]>=limits[shape]||!free(row,col)) continue
    const key=`${row},${col}`
    const z=zoneOf(row,col)
    if(shape==='ramp'){
      valid.set(key,chainObstacle(key,{
        ...rampStyle[z],shape,
        direction:['east','south','west','north'][score%4],
        height:.82,bottom:0,radius:.46,isOrganic:true,
      }))
    }else if(shape==='sphere'){
      valid.set(key,chainObstacle(key,{
        ...sphereStyle[z],shape,height:.76,radius:.34,isOrganic:true,
      }))
    }else{
      valid.set(key,chainObstacle(key,{
        ...treeStyle[z],shape,height:2.05,radius:.25,isOrganic:true,
      }))
    }
    totals[shape]++
    if(Object.keys(totals).every(name=>totals[name]>=limits[name])) break
  }
}

function ensureInteractiveConnectivity(valid,cellMap){
  const keyOf=(row,col)=>`${row},${col}`
  const parse=key=>key.split(',').map(Number)
  const directions=[[1,0],[-1,0],[0,1],[0,-1]]
  const heapPush=(heap,node)=>{
    heap.push(node)
    for(let index=heap.length-1;index>0;){
      const parent=(index-1)>>1
      if(heap[parent].cost<=node.cost) break
      heap[index]=heap[parent];index=parent;heap[index]=node
    }
  }
  const heapPop=heap=>{
    const first=heap[0],last=heap.pop()
    if(heap.length&&last){
      heap[0]=last
      for(let index=0;;){
        const left=index*2+1,right=left+1
        if(left>=heap.length) break
        const child=right<heap.length&&heap[right].cost<heap[left].cost?right:left
        if(heap[index].cost<=heap[child].cost) break
        ;[heap[index],heap[child]]=[heap[child],heap[index]];index=child
      }
    }
    return first
  }
  const passable=(row,col)=>{
    const key=keyOf(row,col),obstacle=valid.get(key)
    return row>0&&row<ROWS-1&&col>0&&col<COLS-1&&!cellMap.has(key)&&(!obstacle||!blocksGround(obstacle))
  }
  const approaches=[]
  for(const key of cellMap.keys()){
    const [row,col]=parse(key)
    const candidates=directions.map(([dr,dc])=>({row:row+dr,col:col+dc,key:keyOf(row+dr,col+dc)}))
      .filter(({row:r,col:c})=>r>0&&r<ROWS-1&&c>0&&c<COLS-1&&!cellMap.has(keyOf(r,c)))
    if(candidates.length) approaches.push(candidates)
  }
  let seed=approaches.flat().find(({row,col})=>passable(row,col))||null
  if(!seed){
    for(let row=1;row<ROWS-1&&!seed;row++) for(let col=1;col<COLS-1;col++){
      if(passable(row,col)){seed={row,col};break}
    }
  }
  if(!seed) return

  const flood=()=>{
    const seen=new Set(),queue=[]
    if(passable(seed.row,seed.col)){seen.add(keyOf(seed.row,seed.col));queue.push(seed)}
    for(let cursor=0;cursor<queue.length;cursor++){
      const current=queue[cursor]
      for(const [dr,dc] of directions){
        const row=current.row+dr,col=current.col+dc,key=keyOf(row,col)
        if(seen.has(key)||!passable(row,col)) continue
        seen.add(key);queue.push({row,col})
      }
    }
    return seen
  }

  let reachable=flood()
  for(const candidates of approaches){
    if(candidates.some(({key})=>reachable.has(key))) continue
    // Dijkstra with a low cost for open cells and a higher cost for removable
    // maze walls. Structural routes/stairs remain immutable.
    const queue=[],costs=new Map(),parents=new Map()
    for(const key of reachable){
      const [row,col]=parse(key),node={row,col,cost:0}
      costs.set(key,0);heapPush(queue,node)
    }
    let target=null
    while(queue.length){
      const current=heapPop(queue),currentKey=keyOf(current.row,current.col)
      if(current.cost!==costs.get(currentKey)) continue
      if(candidates.some(({key})=>key===currentKey)){target=current;break}
      for(const [dr,dc] of directions){
        const row=current.row+dr,col=current.col+dc,key=keyOf(row,col)
        if(row<=0||row>=ROWS-1||col<=0||col>=COLS-1||cellMap.has(key)) continue
        const obstacle=valid.get(key)
        if(obstacle?.isStructure&&blocksGround(obstacle)) continue
        const nextCost=current.cost+(obstacle&&blocksGround(obstacle)?5:1)
        if(nextCost>=(costs.get(key)??Infinity)) continue
        costs.set(key,nextCost);parents.set(key,currentKey);heapPush(queue,{row,col,cost:nextCost})
      }
    }
    if(!target) continue
    for(let key=keyOf(target.row,target.col);key&&!reachable.has(key);key=parents.get(key)){
      if(valid.has(key)&&!valid.get(key)?.isStructure) valid.delete(key)
    }
    reachable=flood()
  }
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
  if (obstacle) return isOrganicShape(obstacle) ? 0 : obstacleTop(obstacle)
  return cellMap?.has(key) ? blockTop(cellMap.get(key),row,col) : 0
}

function solidSpanAt(row, col, cellMap, obsSet) {
  const key=`${row},${col}`
  const obstacle=obsSet?.get?.(key)
  if(obstacle&&!isOrganicShape(obstacle)) return {bottom:obstacleBottom(obstacle),top:obstacleTop(obstacle)}
  if(cellMap?.has(key)) return {bottom:0,top:blockTop(cellMap.get(key),row,col)}
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
      const obstacle=obsSet?.get?.(`${row},${col}`)
      if(obstacle?.shape==='sphere'||obstacle?.shape==='tree'){
        const top=obstacleTop(obstacle)
        if(playerZ<top-.04&&circleTouchesRoundObstacle(gx,gy,row,col,obstacle)) return true
        continue
      }
      if(obstacle?.shape==='ramp'){
        if(circleTouchesCell(gx,gy,row,col)){
          const localTop=rampHeightAt(obstacle,gx,gy,row,col)
          if(localTop>playerZ+.24) return true
        }
        continue
      }
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
      const obstacle=obsSet?.get?.(`${row},${col}`)
      if(obstacle?.shape==='ramp'&&circleTouchesCell(gx,gy,row,col,radius)){
        const localTop=rampHeightAt(obstacle,gx,gy,row,col)
        if(playerZ>=localTop-.24) height=Math.max(height,localTop)
        continue
      }
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

// Find the nearest free cell to (targetRow, targetCol) using BFS spiral.
// Used when restoring a saved position that ended up inside a procedural wall.
function findNearestFreeCell(targetRow, targetCol, cellMap, validObs) {
  const maxRadius = 12
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue // only shell
        const r = targetRow + dr
        const c = targetCol + dc
        if (r < 1 || r >= ROWS - 1 || c < 1 || c >= COLS - 1) continue
        const k = `${r},${c}`
        if (!cellMap.has(k) && !validObs.has(k)) return { row: r, col: c }
      }
    }
  }
  return findRandomFreeCell(cellMap, validObs)
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const c = (hex || '#000').replace('#', '').padStart(6, '0')
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)]
}

function wallRgb(cell, dist, side, myWallet) {
  // Directional light plus blue atmospheric perspective. Blending into the
  // scene colour preserves silhouettes much better than multiplying to black.
  const sideMul = side === 1 ? 0.72 : 1.0
  const visibility = Math.max(0.18, 1 - dist * 0.047)
  const fogColor=[8,18,42]
  const finish=([r,g,b],emissive=0)=>{
    const lit=[r*sideMul,g*sideMul,b*sideMul]
    const fogMix=Math.max(0,Math.min(.78,1-visibility-emissive))
    return lit.map((value,index)=>Math.round(value*(1-fogMix)+fogColor[index]*fogMix))
  }
  if (cell?.isObstacle) {
    return finish(cell.base || [40,25,65],cell.isRoute?.12:0)
  }
  if (cell?.isChainNode) {
    const pulse = 0.60 + Math.sin(Date.now() / 300) * 0.40
    return finish([255*pulse,180*pulse,0],.28)
  }
  if (cell?.isPortalNode) {
    const [pr, pg, pb] = hexToRgb(cell.color || C)
    const pulse = 0.55 + Math.sin(Date.now() / 400) * 0.45
    return finish([pr*pulse,pg*pulse,pb*pulse],.24)
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
    base = [255, 195, 50]   // bright gold — block with NFTJI (purchasable)
  } else if (cell) {
    base = [55, 115, 245]   // bright blue — free mineable block (no NFTJI)
  } else {
    base = [10, 18, 42]
  }
  return finish(base, cell?.isMarket ? .25 : cell && !cell.owner ? .14 : cell?.owner ? .08 : 0)
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
    if(obsData?.shape==='ramp') continue
    if(obsData?.shape==='sphere'||obsData?.shape==='tree'){
      const cx=mx+.5,cy=my+.5,radius=Number(obsData.radius)||.3
      const along=(cx-px)*dx+(cy-py)*dy
      const lateralSq=(cx-px)*(cx-px)+(cy-py)*(cy-py)-along*along
      if(along>0&&lateralSq<radius*radius){
        const hitDist=Math.max(.05,along-Math.sqrt(radius*radius-lateralSq))
        return {perpDist:hitDist,cell:{isObstacle:true,...obsData},side,mx,my,hit:true}
      }
      continue
    }
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
      if(isOrganicShape(obstacle)) continue
      const cell={isObstacle:true,...obstacle}
      const top=obstacleTop(cell)
      if(top>highestNearTop+.01){hits.push({perpDist,cell,side,mx,my,hit:true});highestNearTop=top}
      continue
    }
    const cell=cellMap.get(key)||null
    const cellTop=cell?blockTop(cell,my,mx):0
    if(cell&&cellTop>highestNearTop+.01){
      hits.push({perpDist,cell,side,mx,my,hit:true})
      highestNearTop=cellTop
    }
  }
  return hits
}

// ── Minimap ───────────────────────────────────────────────────────────────────
function minimapSize(W) {
  return W < 600 ? Math.min(W * 0.48, 150) : Math.min(220, W * 0.24)
}

function drawMinimap(ctx, gr, gc, angle, cellMap, presenceMap, myWallet, W, H, chainNodePos, validObs, gx, gy, staticCacheRef, dpr=1) {
  const isMobile = W < 600
  const SZ = minimapSize(W)
  const MX = W - SZ - 6
  const MY = 8
  const CS = SZ / COLS
  const mapX = (col) => MX + col * CS
  const mapY = (row) => MY + row * CS
  const now = Date.now()
  const myId = (myWallet || '').toLowerCase()

  const drawMapEmoji = (emoji, x, y, color, shape = 'circle') => {
    const fontSize = isMobile ? 7.5 : 9
    const radius = fontSize * .62
    ctx.save()
    ctx.shadowColor = color || C
    ctx.shadowBlur = 4
    ctx.fillStyle = 'rgba(1,7,14,.94)'
    ctx.strokeStyle = color || C
    ctx.lineWidth = 1
    ctx.beginPath()
    if (shape === 'square') ctx.rect(x - radius, y - radius, radius * 2, radius * 2)
    else ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji",serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(emoji || '◆', x, y + .25)
    ctx.restore()
  }

  const drawPlayerArrow = (worldX, worldY, heading, color, isMe = false, isBot = false) => {
    const x = mapX(worldX)
    const y = mapY(worldY)
    const size = isMe ? (isMobile ? 6.5 : 7.8) : (isMobile ? 5.2 : 6.2)
    const pulse = .72 + Math.sin(now / 420 + worldX * .8 + worldY) * .18
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Number(heading) || 0)
    ctx.globalAlpha = 1
    // Double-pass glow: wide soft halo first, then sharp inner glow
    ctx.shadowColor = color
    ctx.shadowBlur = isMe ? 28 : 18
    ctx.fillStyle = color
    ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(255,255,255,.92)'
    ctx.lineWidth = isMe ? 1.6 : 1.2
    ctx.beginPath()
    ctx.moveTo(size * 1.12, 0)
    ctx.lineTo(-size * .62, size * .58)
    ctx.lineTo(-size * .28, 0)
    ctx.lineTo(-size * .62, -size * .58)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = isMe ? 12 : 7
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = isBot ? '#facc15' : '#ffffff'
    ctx.beginPath()
    ctx.arc(-size * .10, 0, Math.max(1, size * .22), 0, Math.PI * 2)
    ctx.fill()
    if (isMe) {
      ctx.globalAlpha = pulse
      ctx.shadowColor = '#facc15'
      ctx.shadowBlur = 10
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(0, 0, size * 1.45, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      // Subtle ring for remote players too so they pop against the map
      ctx.globalAlpha = .55
      ctx.shadowColor = color
      ctx.shadowBlur = 8
      ctx.strokeStyle = color
      ctx.lineWidth = .9
      ctx.beginPath()
      ctx.arc(0, 0, size * 1.38, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  const cached=staticCacheRef?.current
  const cacheHit=cached&&cached.cellMap===cellMap&&cached.validObs===validObs&&cached.myId===myId&&cached.sz===SZ&&cached.dpr===dpr
  if(cacheHit){
    ctx.drawImage(cached.canvas,MX-2,MY-2,SZ+4,SZ+4)
  }else{
    ctx.fillStyle = 'rgba(1,6,14,.96)'
    ctx.fillRect(MX - 2, MY - 2, SZ + 4, SZ + 4)
    ctx.strokeStyle = C + '66'
    ctx.lineWidth = 1
    ctx.strokeRect(MX - 2, MY - 2, SZ + 4, SZ + 4)
  }

  ctx.save()
  ctx.beginPath()
  ctx.rect(MX, MY, SZ, SZ)
  ctx.clip()

  if(!cacheHit){

  const half = SZ / 2
  ctx.fillStyle = 'rgba(46,86,118,.13)'
  ctx.fillRect(MX, MY, half, half)
  ctx.fillStyle = 'rgba(173,117,55,.12)'
  ctx.fillRect(MX + half, MY, half, half)
  ctx.fillStyle = 'rgba(68,151,190,.13)'
  ctx.fillRect(MX, MY + half, half, half)
  ctx.fillStyle = 'rgba(157,48,31,.13)'
  ctx.fillRect(MX + half, MY + half, half, half)

  ctx.strokeStyle = 'rgba(67,194,220,.08)'
  ctx.lineWidth = .5
  for (let n = 7; n < COLS; n += 7) {
    ctx.beginPath()
    ctx.moveTo(mapX(n), MY)
    ctx.lineTo(mapX(n), MY + SZ)
    ctx.moveTo(MX, mapY(n))
    ctx.lineTo(MX + SZ, mapY(n))
    ctx.stroke()
  }

  for (const [key, obstacle] of validObs || []) {
    const [row, col] = key.split(',').map(Number)
    const x = mapX(col)
    const y = mapY(row)
    const inset = Math.max(.12, CS * .12)
    let fill = 'rgba(105,132,154,.22)'
    if (obstacle.isRouteStair) fill = 'rgba(226,190,88,.30)'
    else if (obstacle.isRoute) fill = 'rgba(82,176,184,.25)'
    else if (obstacle.isRouteWall) fill = 'rgba(130,83,157,.22)'
    else if (obstacle.shape === 'ramp') fill = 'rgba(104,177,190,.25)'
    else if (obstacle.shape === 'sphere') fill = 'rgba(151,94,169,.23)'
    else if (obstacle.shape === 'tree') fill = 'rgba(73,151,116,.23)'
    else if (Array.isArray(obstacle.base)) {
      const [r, g, b] = obstacle.base
      fill = `rgba(${r},${g},${b},.18)`
    }
    ctx.fillStyle = fill
    if (obstacle.shape === 'sphere' || obstacle.shape === 'tree') {
      ctx.beginPath()
      ctx.arc(mapX(col + .5), mapY(row + .5), Math.max(.75, CS * .34), 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillRect(x + inset, y + inset, Math.max(.65, CS - inset * 2), Math.max(.65, CS - inset * 2))
    }
  }

  for (const [key, cell] of cellMap) {
    if (cell?.isPortalNode || cell?.isMarket || cell?.isChainNode) continue
    const [row, col] = key.split(',').map(Number)
    const x = mapX(col)
    const y = mapY(row)
    const owned = Boolean(cell?.owner)
    ctx.fillStyle = owned ? (cell.color || '#38bdf8') + 'b8' : 'rgba(72,139,172,.50)'
    ctx.fillRect(x + CS * .18, y + CS * .18, Math.max(.8, CS * .64), Math.max(.8, CS * .64))
    if (owned && myId && cell.owner?.toLowerCase() === myId) {
      ctx.strokeStyle = 'rgba(255,255,255,.78)'
      ctx.lineWidth = .55
      ctx.strokeRect(x + CS * .12, y + CS * .12, Math.max(1, CS * .76), Math.max(1, CS * .76))
    }
  }

  for (const [key, cell] of cellMap) {
    if (!cell?.isMarket) continue
    const [row, col] = key.split(',').map(Number)
    const color = cell.owner ? '#4ade80' : '#fb923c'
    drawMapEmoji(cell.emoji || '◆', mapX(col + .5), mapY(row + .5), color, 'square')
  }

  for (const [key, cell] of cellMap) {
    if (!cell?.isPortalNode) continue
    const [row, col] = key.split(',').map(Number)
    drawMapEmoji(cell.emoji || '◆', mapX(col + .5), mapY(row + .5), cell.color || C, 'circle')
  }

  let chainDrawn = false
  for (const [key, cell] of cellMap) {
    if (!cell?.isChainNode) continue
    const [row, col] = key.split(',').map(Number)
    drawMapEmoji(cell.emoji || '⬡', mapX(col + .5), mapY(row + .5), '#facc15', 'circle')
    chainDrawn = true
  }
  if (!chainDrawn && chainNodePos) {
    drawMapEmoji('⬡', mapX(chainNodePos.col + .5), mapY(chainNodePos.row + .5), '#facc15', 'circle')
  }

    if(staticCacheRef){
      const cacheCanvas=document.createElement('canvas')
      cacheCanvas.width=Math.max(1,Math.round((SZ+4)*dpr))
      cacheCanvas.height=Math.max(1,Math.round((SZ+4)*dpr))
      const cacheCtx=cacheCanvas.getContext('2d')
      cacheCtx.drawImage(
        ctx.canvas,
        Math.round((MX-2)*dpr),Math.round((MY-2)*dpr),cacheCanvas.width,cacheCanvas.height,
        0,0,cacheCanvas.width,cacheCanvas.height,
      )
      staticCacheRef.current={canvas:cacheCanvas,cellMap,validObs,myId,sz:SZ,dpr}
    }
  }

  for (const [wallet, player] of Object.entries(presenceMap || {})) {
    if (player.row == null && player.gy == null) continue
    const identity = wallet.toLowerCase()
    if (identity === myId) continue
    const pgx = player.gx ?? ((player.col ?? 0) + .5)
    const pgy = player.gy ?? ((player.row ?? 0) + .5)
    if (player.isDead) {
      // Dead player: draw skull on minimap instead of direction arrow
      const mx = mapX(pgx), my = mapY(pgy)
      ctx.save()
      ctx.font = `${Math.max(7, Math.round(CS * 0.7))}px "Apple Color Emoji","Segoe UI Emoji",serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.globalAlpha = 0.82
      ctx.fillText('\u{1F480}', mx, my)
      ctx.restore()
      continue
    }
    drawPlayerArrow(
      pgx, pgy,
      Number(player.angle) || 0,
      colorFromAddress(wallet),
      false,
      Boolean(player.isBot),
    )
  }

  drawPlayerArrow(gx ?? (gc + .5), gy ?? (gr + .5), angle, C, true, false)
  ctx.restore()
}

// ── Facing block HUD (top-right info card) ────────────────────────────────────
function drawFacingHUD(ctx, W, H, fwdCell, fwdMx, fwdMy, myWallet, es, dist, obsMap, chainStatsBottom = 72, mineProgress = 0, playerLevel = 0, globalMm3 = 0) {
  if (fwdMx < 0 || fwdMy < 0 || fwdMx >= COLS || fwdMy >= ROWS) return

  // Double-check: use both cell flag and obsMap to catch any desync
  const isObs = fwdCell?.isObstacle || obsMap?.has(`${fwdMy},${fwdMx}`)
  const CARD_PW = 164
  const CARD_PX = 6
  const CARD_PY = chainStatsBottom + 4
  if (isObs) {
    const lines = [
      { text: es ? 'PARED' : 'WALL', size: 12, weight: 'bold', col: '#90a0b0' },
      { text: es ? '· no interactivo' : '· non-interactive', size: 10, col: '#445566' },
    ]
    const lineH=15, padX=9, padY=7, ph=lines.length*lineH+padY*2
    const pw=CARD_PW, px=CARD_PX, py=CARD_PY
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
    const _pw = CARD_PW, _px = CARD_PX, _py = CARD_PY
    ctx.globalAlpha = 0.90; ctx.fillStyle = '#010709'; ctx.fillRect(_px, _py, _pw, _ph); ctx.globalAlpha = 1
    ctx.lineWidth = 1; ctx.strokeStyle = col + '55'; ctx.strokeRect(_px, _py, _pw, _ph)
    ctx.fillStyle = col + '77'; ctx.fillRect(_px, _py, 2, _ph)
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    for (let i = 0; i < pLines.length; i++) {
      const l = pLines[i]
      ctx.font = `${l.weight || 'normal'} ${l.size}px monospace`
      ctx.fillStyle = l.col
      ctx.fillText(l.text, _px + _padX, _py + _padY + i * _lineH, _pw - _padX * 2)
    }
    return
  }

  if (fwdCell?.isChainNode) {
    const inRange = dist != null && dist <= CHAIN_INTERACT_DIST
    const col = fwdCell.color || '#ffd700'
    const title = es ? (fwdCell.titleEs || 'NODO CENTRAL') : (fwdCell.titleEn || 'CENTRAL NODE')
    const lines = [
      { text: `${fwdCell.emoji || '⬡'}  ${title}`, size: 13, weight: 'bold', col },
      { text: es ? 'Terminal estático de la cadena' : 'Static chain terminal', size: 10, col: '#8b7f52' },
      inRange
        ? { text: es ? '⛏ 5 golpes · Resolver cadena' : '⛏ 5 hits · Solve chain formula', size: 10, col: col + 'cc' }
        : { text: es ? '· acércate muy cerca para interactuar' : '· get very close to interact', size: 9, col: col + '55' },
    ]
    const lineH=16,padX=9,padY=8,ph=lines.length*lineH+padY*2,pw=CARD_PW,px=CARD_PX,py=CARD_PY
    ctx.globalAlpha=.9;ctx.fillStyle='#010709';ctx.fillRect(px,py,pw,ph);ctx.globalAlpha=1
    ctx.strokeStyle=col+'55';ctx.strokeRect(px,py,pw,ph);ctx.fillStyle=col+'77';ctx.fillRect(px,py,2,ph)
    ctx.textAlign='left';ctx.textBaseline='top'
    lines.forEach((line,i)=>{ctx.font=`${line.weight||'normal'} ${line.size}px monospace`;ctx.fillStyle=line.col;ctx.fillText(line.text,px+padX,py+padY+i*lineH,pw-padX*2)})
    return
  }

  const hex   = fwdCell?.blockHex || gridToBlockHex(fwdMy, fwdMx)
  const title = fwdCell
    ? (es ? (fwdCell.titleEs || fwdCell.titleEn || '') : (fwdCell.titleEn || fwdCell.titleEs || ''))
    : ''
  const owner  = fwdCell?.owner || null
  const isMine = myWallet && owner?.toLowerCase() === myWallet.toLowerCase()
  const color  = fwdCell?.color || C
  const isAnon = !myWallet || myWallet.startsWith('anon-')

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
    lines.push({ text: es ? '○ Bloque NFTJI' : '○ NFTJI block', size: 11, col: '#5b8aa3' })
    lines.push({ text: es ? '  ataque · defensa PvP' : '  attack · defense PvP', size: 9, col: '#3a6a80' })
  } else if (fwdCell) {
    lines.push({ text: es ? '○ Sin reclamar' : '○ Unclaimed', size: 11, col: '#5b7890' })
  } else {
    lines.push({ text: es ? '○ Sin reclamar' : '○ Unclaimed', size: 11, col: '#5b7890' })
  }

  if (fwdCell?.priceEur > 0) {
    lines.push({ text: `${fwdCell.priceEur} EUR`, size: 11, weight: 'bold', col: '#fb923c' })
  }

  if (dist != null && !fwdCell?.isObstacle) {
    const distCol = dist <= INTERACT_DIST ? '#4ade8077' : '#3d5a6a'
    lines.push({ text: `${dist.toFixed(1)} cells`, size: 9, col: distCol })
  }

  // Mining requirements derived from block position
  if (!owner) {
    const req = MM3_BLOCK_REQUIREMENT_BY_HEX.get(hex)
    if (req) {
      const hasLvl = playerLevel >= req.minLevel
      const lvlCol = isAnon ? '#4a6a7a' : hasLvl ? '#4ade8099' : '#fb718599'
      lines.push({ text: `  lvl ≥ ${req.minLevel}`, size: 9, col: lvlCol })
      if (req.requiredMm3 !== 0) {
        const hasMm3 = doesGlobalValueMeetRequirement(globalMm3, req.requiredMm3)
        const mm3Col = hasMm3 ? '#4ade8099' : '#fb718599'
        const sign = req.requiredMm3 > 0 ? '≥' : '≤'
        lines.push({ text: `  mm3 ${sign} ${Number(req.requiredMm3).toFixed(2)}`, size: 9, col: mm3Col })
      }
    }
  }

  if (!owner) {
    const inRange = dist == null || dist <= INTERACT_DIST
    if (fwdCell?.isChainNode) {
      lines.push(inRange
        ? { text: es ? '↵ · Resolver cadena' : '↵ · Solve formula chain', size: 10, col: '#ffd700cc' }
        : { text: es ? '· acercarse para interactuar' : '· move closer to interact', size: 9, col: '#ffd70055' })
    } else if (fwdCell?.isMarket) {
      // NFTJI block — buy via relaying
      lines.push(inRange
        ? { text: es ? `↵ /buy ${hex}` : `↵ /buy ${hex}`, size: 10, col: '#fb923ccc' }
        : { text: es ? '· acercarse para comprar' : '· move closer to buy', size: 9, col: '#fb923c55' })
      lines.push({ text: es ? '  vía Relaying (1 slot/día)' : '  via Relaying (1 slot/day)', size: 9, col: '#fb923c55' })
      if (isAnon) {
        lines.push({ text: es ? '⚠ Wallet requerida' : '⚠ Wallet required', size: 9, col: '#f59e0b99' })
      }
    } else {
      // Regular mineable block
      if (mineProgress > 0) {
        const done = Math.round(mineProgress * HITS_NEEDED)
        lines.push({ text: es ? `⛏ ${done}/${HITS_NEEDED} golpes` : `⛏ ${done}/${HITS_NEEDED} hits`, size: 9, col: C + 'bb' })
      } else {
        lines.push({ text: es ? `⛏ ${HITS_NEEDED} golpes · /mine block` : `⛏ ${HITS_NEEDED} hits · /mine block`, size: 9, col: '#3a6a7a' })
      }
      lines.push(inRange
        ? { text: es ? '↵ · Minar bloque' : '↵ · Mine block', size: 10, col: C + 'cc' }
        : { text: es ? '· acercarse para minar' : '· move closer to mine', size: 9, col: C + '55' })
      lines.push({ text: es ? '  vía Relaying (1 slot/día)' : '  via Relaying (1 slot/day)', size: 9, col: C + '44' })
      if (isAnon) {
        lines.push({ text: es ? '⚠ Wallet requerida' : '⚠ Wallet required', size: 9, col: '#f59e0b99' })
      }
    }
  } else if (owner && fwdCell?.isMarket) {
    const isMineWall = myWallet && owner.toLowerCase() === myWallet.toLowerCase()
    if (isMineWall) {
      lines.push({ text: es ? `↵ /resell ${hex}` : `↵ /resell ${hex}`, size: 10, col: '#4ade80cc' })
      lines.push({ text: es ? '  vía Relaying (1 slot/día)' : '  via Relaying (1 slot/day)', size: 9, col: '#4ade8044' })
    }
  }

  const lineH = 16, padX = 9, padY = 8
  const ph = lines.length * lineH + padY * 2
  const pw = CARD_PW
  const px = CARD_PX
  const py = CARD_PY

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

// ── First-person retro USB staff ────────────────────────────────────────────
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
  // Segmented data staff (30-84%)
  const sX=handX+Math.cos(angle)*length*.84,sY=handY+Math.sin(angle)*length*.84
  ctx.strokeStyle='#071722';ctx.lineWidth=Math.max(3,4.2*scale)
  ctx.beginPath();ctx.moveTo(gX,gY);ctx.lineTo(sX,sY);ctx.stroke()
  // Cyan highlight stripe
  ctx.save();ctx.globalAlpha*=.55;ctx.strokeStyle='#22d3ee';ctx.lineWidth=Math.max(.5,.75*scale)
  ctx.beginPath();ctx.moveTo(gX+nx*1.5,gY+ny*1.5);ctx.lineTo(sX+nx*1.5,sY+ny*1.5);ctx.stroke()
  ctx.restore()
  // Oversized retro USB head: readable at distance and never axe-shaped.
  const neckX=handX+Math.cos(angle)*length*.90,neckY=handY+Math.sin(angle)*length*.90
  ctx.strokeStyle='#22d3ee';ctx.lineWidth=Math.max(2.2,3.2*scale)
  ctx.beginPath();ctx.moveTo(sX,sY);ctx.lineTo(neckX,neckY);ctx.stroke()
  const hLen=Math.max(10,15*scale),hW=Math.max(7,10*scale)
  ctx.save();ctx.translate(neckX,neckY);ctx.rotate(angle)
  ctx.fillStyle='#d8e7ef';ctx.fillRect(0,-hW/2,hLen,hW)
  ctx.strokeStyle='#22d3ee';ctx.lineWidth=Math.max(.8,1.2*scale);ctx.strokeRect(0,-hW/2,hLen,hW)
  ctx.fillStyle='#07121c';ctx.fillRect(hLen*.10,-hW*.30,hLen*.78,hW*.60)
  ctx.fillStyle='#facc15';[.20,.43,.66].forEach(t=>ctx.fillRect(hLen*t,-hW*.20,hLen*.12,hW*.40))
  ctx.fillStyle='#d946ef';ctx.fillRect(-Math.max(2,3*scale),-hW*.35,Math.max(2,3*scale),hW*.70)
  ctx.restore()
  // Tip glow
  const plugEndX=neckX+Math.cos(angle)*hLen,plugEndY=neckY+Math.sin(angle)*hLen
  ctx.save();ctx.globalAlpha*=.75;ctx.fillStyle='#22d3ee'
  ctx.beginPath();ctx.arc(plugEndX,plugEndY,Math.max(2.2,3.4*scale),0,Math.PI*2);ctx.fill()
  ctx.globalAlpha*=.30;ctx.strokeStyle='#22d3ee';ctx.lineWidth=Math.max(.4,.7*scale)
  ctx.beginPath();ctx.arc(plugEndX,plugEndY,Math.max(3.5,5*scale),0,Math.PI*2);ctx.stroke()
  ctx.restore()
  ctx.restore()
}

// ── Mining progress arc ──────────────────────────────────────────────────────
function drawMineProgress(ctx, W, H, progress, type) {
  if (progress <= 0) return
  const cx = W / 2, cy = H * HORIZON_RATIO
  const r = 24
  const col = type === 'nftji' ? '#fb923c' : C
  const start = -Math.PI / 2
  ctx.globalAlpha = 0.28
  ctx.strokeStyle = col; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 0.88
  ctx.strokeStyle = col; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, r, start, start + progress * Math.PI * 2); ctx.stroke()
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
  const SLOT_W = mobile ? 30 : 36, SLOT_H = mobile ? 42 : 48
  const GAP = 4, PAD_X = 8, PAD_Y = 5, HEADER_H = 3
  const COLS = 3                                     // max 3 slots per row
  const skills = myNftjis || []
  const slotCount = Math.max(skills.length, COLS)    // at least one full row
  const rowCount = Math.ceil(slotCount / COLS)
  const pw = PAD_X * 2 + COLS * (SLOT_W + GAP) - GAP
  const ph = PAD_Y * 2 + HEADER_H + rowCount * (SLOT_H + GAP) - GAP

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

  const baseSlotY = py + PAD_Y + HEADER_H
  for (let i = 0; i < slotCount; i++) {
    const skill = skills[i]
    const { emoji, level, isActive, blockKey, source } = skill || {}
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const sx = px + PAD_X + col * (SLOT_W + GAP)
    const slotY = baseSlotY + row * (SLOT_H + GAP)
    const ability = emoji === '❤️'
      ? { lines:['SPEED +10%'], color:'#fb7185' }
      : (emoji === '⚔️' || blockKey === 'sq-atk')
        ? { lines:['CRIT +5%'], color:'#facc15' }
        : (emoji === '🔰' || blockKey === 'sq-def')
          ? { lines:['DODGE 10%'], color:'#22d3ee' }
          : source==='mining'
            ? { lines:['LONG +10%'], color:'#4ade80' }
          : null

    ctx.fillStyle = skill ? (ability ? '#100b18' : isActive ? '#0e2010' : '#080e18') : '#050a12'
    ctx.fillRect(sx, slotY, SLOT_W, SLOT_H)
    ctx.strokeStyle = skill ? (ability ? ability.color+'dd' : isActive ? '#4ade80aa' : '#fb923c22') : '#52617255'
    ctx.lineWidth = ability ? 1.25 : isActive ? 1 : 0.5
    ctx.strokeRect(sx, slotY, SLOT_W, SLOT_H)

    if (!skill) {
      ctx.fillStyle = '#52617222'
      ctx.fillRect(sx + 5, slotY + 6, SLOT_W - 10, SLOT_H - 12)
      continue
    }

    if (ability) {
      const pulse=.12+(Math.sin(Date.now()/420+i)*.5+.5)*.10
      ctx.fillStyle=ability.color
      ctx.globalAlpha=pulse
      ctx.fillRect(sx+1,slotY+1,SLOT_W-2,SLOT_H-2)
      ctx.globalAlpha=1
      ctx.fillStyle=ability.color
      const abilityHeaderH=ability.lines.length>1?14:8
      ctx.fillRect(sx,slotY,SLOT_W,abilityHeaderH)
      ctx.fillStyle='#02060b';ctx.font='bold 6px monospace'
      ctx.textAlign='center';ctx.textBaseline='middle'
      ability.lines.forEach((line,lineIndex)=>{
        ctx.fillText(line,sx+SLOT_W/2,slotY+4.5+lineIndex*6)
      })
    }

    ctx.font = '17px serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(emoji || '⬡', sx + SLOT_W / 2, slotY + SLOT_H / 2 - (ability ? 2 : 5))

    ctx.font = 'bold 7px monospace'
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillStyle = ability ? ability.color : isActive ? '#4ade80dd' : '#fb923c99'
    ctx.fillText(`Lv${level}`, sx + SLOT_W / 2, slotY + SLOT_H - 1)
  }

  ctx.textAlign = 'left'; ctx.globalAlpha = 1
  return { top: healthY, bottom: py + ph, width: pw }
}

function drawChainStats(ctx, W, H, stats, es, top = 8) {
  if (!stats) return
  const { owned, marketFree, marketOwned, total, pct } = stats
  const blocksMined = owned - marketOwned          // regular blocks with owner
  const blocksFree  = total - owned - marketFree   // regular blocks without owner

  const lines = [
    { label: 'MM3 BLOCK CHAIN',    val: null, header: true },
    { label: 'Regular Blocks',     val: `${blocksMined} / ${blocksFree}` },
    { label: 'NFTJI Blocks',       val: `${marketOwned} / ${marketFree}` },
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
  return py + ph
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
    const deadUntilMs = pres.deadUntil
      ? (typeof pres.deadUntil === 'number' ? pres.deadUntil : new Date(pres.deadUntil).getTime())
      : 0
    const isDead = Boolean(pres.isDead) && deadUntilMs > Date.now()
    all.push({ w, isAnon, isBot: Boolean(pres.isBot), stolen: (pvpStolen || {})[w] || 0, isDead })
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
    for (const { w, isAnon, isBot, stolen, isDead } of entries) {
    const isMe = w.toLowerCase() === (myWallet || '').toLowerCase()
    const col  = colorFromAddress(w)
    const label = isAnon
      ? w
      : `${w.slice(0, 6)}…${w.slice(-3)}${isBot ? ' B' : ''}`
    if (isMe) {
      ctx.fillStyle = col + '1a'
      ctx.fillRect(px + 1, ly - 2, pw - 2, LINE_H)
      ctx.fillStyle = col + 'bb'
      ctx.fillRect(px + 1, ly - 2, 2, LINE_H)
    }
    const skullW = isDead ? 9 : 0
    if (isDead) {
      ctx.font = '8px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#fb7185'
      ctx.fillText('☠', px + PAD_X, ly)
    }
    ctx.font = `${isMe ? 'bold ' : ''}9px monospace`
    ctx.textAlign = 'left'
    ctx.fillStyle = col
    ctx.fillRect(px + PAD_X + skullW, ly + 2, 3, 3)
    ctx.fillText(label, px + PAD_X + skullW + 6, ly)
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

function disposeThreeObject(root) {
  root?.traverse?.(object=>{
    object.geometry?.dispose?.()
    const materials=Array.isArray(object.material)?object.material:[object.material]
    materials.filter(Boolean).forEach(material=>{
      if(material.userData?.ownedMap) material.map?.dispose?.()
      material.dispose?.()
    })
  })
}

function makeRampGeometry(direction='east') {
  const heightAt=(x,z)=>direction==='west'?1-x:direction==='south'?z:direction==='north'?1-z:x
  const vertices=new Float32Array([
    0,0,0, 1,0,0, 1,0,1, 0,0,1,
    0,heightAt(0,0),0, 1,heightAt(1,0),0, 1,heightAt(1,1),1, 0,heightAt(0,1),1,
  ])
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3))
  geometry.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7])
  geometry.computeVertexNormals()
  return geometry
}

function biomeForCell(row,col) {
  if(row<ROWS/2&&col<COLS/2) return 'mountain'
  if(row<ROWS/2) return 'coast'
  if(col<COLS/2) return 'ice'
  return 'inferno'
}

const BIOME_STYLE={
  mountain:{ground:'#284765',block:'#739bc0',accent:'#67e8f9'},
  coast:{ground:'#9a7444',block:'#e8b967',accent:'#22d3ee'},
  ice:{ground:'#4a9bc7',block:'#b9ecff',accent:'#f0fbff'},
  inferno:{ground:'#671b18',block:'#d64b2a',accent:'#ffb11b'},
}
const BIOME_ATMOSPHERE={
  mountain:{fog:'#102d49',sky:'#07152f',hemi:'#c7e7ff',rim:'#22d3ee'},
  coast:{fog:'#0b4962',sky:'#06233d',hemi:'#d0f6ff',rim:'#2dd4bf'},
  ice:{fog:'#286386',sky:'#0d3152',hemi:'#f0fcff',rim:'#91eaff'},
  inferno:{fog:'#5a160f',sky:'#2b0709',hemi:'#ffd0a8',rim:'#ff641e'},
}

function seededUnit(seed) {
  const value=Math.sin(seed*12.9898+78.233)*43758.5453
  return value-Math.floor(value)
}

function createProceduralTexture(kind,size=128) {
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),data=image.data
  const palettes={
    mountain:[[28,54,78],[51,85,112],[93,126,150]],
    coast:[[176,126,66],[218,174,101],[242,207,139]],
    ice:[[69,151,196],[136,214,241],[224,249,255]],
    inferno:[[64,12,14],[132,28,19],[225,68,25]],
    crypto:[[18,44,68],[36,83,112],[74,151,174]],
  }
  const palette=palettes[kind]||palettes.crypto
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const grain=seededUnit(x*71+y*191+kind.length*997)
    const wave=(Math.sin(x*.22)+Math.sin(y*.17)+Math.sin((x+y)*.08))/6+.5
    const index=Math.min(palette.length-1,Math.floor((grain*.42+wave*.58)*palette.length))
    const base=palette[index],offset=(grain-.5)*22,i=(y*size+x)*4
    data[i]=Math.max(0,Math.min(255,base[0]+offset));data[i+1]=Math.max(0,Math.min(255,base[1]+offset));data[i+2]=Math.max(0,Math.min(255,base[2]+offset));data[i+3]=255
  }
  ctx.putImageData(image,0,0)
  ctx.globalAlpha=.34
  if(kind==='ice'){
    ctx.strokeStyle='#e6fbff';ctx.lineWidth=1
    for(let index=0;index<28;index++){
      const x=seededUnit(index+20)*size,y=seededUnit(index+60)*size
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(seededUnit(index+90)-.5)*34,y+(seededUnit(index+120)-.5)*34);ctx.stroke()
    }
  }else if(kind==='inferno'){
    ctx.strokeStyle='#ff8a1f';ctx.lineWidth=2
    for(let index=0;index<18;index++){
      const y=seededUnit(index+30)*size
      ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(size*.3,y-8,size*.65,y+10,size,y-3);ctx.stroke()
    }
  }else if(kind==='coast'){
    ctx.fillStyle='#fff1bd'
    for(let index=0;index<150;index++) ctx.fillRect(seededUnit(index+10)*size,seededUnit(index+410)*size,1,1)
  }else{
    ctx.strokeStyle='#76d9ed';ctx.lineWidth=1
    for(let x=0;x<size;x+=16){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,size);ctx.stroke()}
    for(let y=0;y<size;y+=16){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y);ctx.stroke()}
  }
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping
  texture.repeat.set(5,5);texture.anisotropy=4
  return texture
}

function createSkyTexture() {
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=512
  const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,512)
  gradient.addColorStop(0,'#01020d');gradient.addColorStop(.35,'#071642');gradient.addColorStop(.72,'#293b78');gradient.addColorStop(1,'#8a315d')
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,512)
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
  return texture
}

function addNightDome(scene) {
  const skyTexture=createSkyTexture()
  scene.userData.skyTexture=skyTexture
  const dome=new THREE.Mesh(
    new THREE.SphereGeometry(72,24,16),
    new THREE.MeshBasicMaterial({map:skyTexture,color:'#9db8ff',side:THREE.BackSide,fog:false}),
  )
  dome.position.set(COLS/2,5,ROWS/2);scene.add(dome)
  const starCount=420,positions=new Float32Array(starCount*3),colors=new Float32Array(starCount*3)
  for(let index=0;index<starCount;index++){
    const theta=seededUnit(index+1)*Math.PI*2,phi=.12+seededUnit(index+51)*Math.PI*.43,radius=55+seededUnit(index+91)*12
    positions[index*3]=COLS/2+Math.cos(theta)*Math.sin(phi)*radius
    positions[index*3+1]=5+Math.cos(phi)*radius
    positions[index*3+2]=ROWS/2+Math.sin(theta)*Math.sin(phi)*radius
    const blue=.72+seededUnit(index+131)*.28
    colors[index*3]=blue;colors[index*3+1]=.84+blue*.16;colors[index*3+2]=1
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
  const stars=new THREE.Points(geometry,new THREE.PointsMaterial({size:.12,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.92,fog:false}))
  scene.add(stars)
  const moon=new THREE.Mesh(new THREE.SphereGeometry(1.45,16,12),new THREE.MeshBasicMaterial({color:'#d8f4ff',fog:false}))
  moon.position.set(42,24,12);scene.add(moon)
  const moonGlow=new THREE.PointLight('#8dd8ff',18,42,1.5);moonGlow.position.copy(moon.position);scene.add(moonGlow)

  const planet=new THREE.Group()
  const planetBody=new THREE.Mesh(new THREE.SphereGeometry(3.2,20,14),new THREE.MeshStandardMaterial({color:'#7c3aed',emissive:'#29105f',emissiveIntensity:.8,roughness:.72,fog:false}))
  const planetRing=new THREE.Mesh(new THREE.TorusGeometry(4.4,.20,8,42),new THREE.MeshBasicMaterial({color:'#f0abfc',transparent:true,opacity:.66,fog:false}))
  planetRing.rotation.x=1.12;planet.add(planetBody,planetRing);planet.position.set(-30,18,38);planet.userData.orbital='planet';scene.add(planet)

  const ship=new THREE.Group()
  const hull=new THREE.Mesh(new THREE.ConeGeometry(.42,1.9,5),new THREE.MeshStandardMaterial({color:'#dbeafe',metalness:.72,roughness:.24,fog:false}))
  hull.rotation.z=-Math.PI/2
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.26,8,6),new THREE.MeshBasicMaterial({color:'#22d3ee',fog:false}));cockpit.position.set(.25,.18,0)
  const wingGeometry=new THREE.BoxGeometry(.85,.08,.55)
  const wings=new THREE.Mesh(wingGeometry,new THREE.MeshStandardMaterial({color:'#f97316',metalness:.5,roughness:.36,fog:false}));wings.position.x=-.15
  const engine=new THREE.PointLight('#22d3ee',5,8,2);engine.position.set(-1,0,0)
  ship.add(hull,cockpit,wings,engine);ship.position.set(COLS/2,15,ROWS/2);ship.userData.orbital='ship';scene.add(ship)
  scene.userData.orbitals=[planet,ship]
}

function addBiomeGround(world,textures) {
  const quadrantSize=ROWS/2
  for(const [biome,cx,cz] of [['mountain',14,14],['coast',42,14],['ice',14,42],['inferno',42,42]]){
    const material=new THREE.MeshStandardMaterial({
      map:textures[biome],color:'#ffffff',roughness:biome==='ice'?.24:biome==='coast'?.88:.72,
      metalness:biome==='ice'?.32:biome==='inferno'?.18:.06,
      emissive:biome==='inferno'?'#3b0904':biome==='ice'?'#09243a':'#000000',emissiveIntensity:biome==='inferno'?.48:.12,
    })
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(quadrantSize-.12,quadrantSize-.12),material)
    plane.rotation.x=-Math.PI/2;plane.position.set(cx,.002,cz)
    plane.userData.skipOcclusion=true;world.add(plane)
  }
  const routeMaterial=new THREE.MeshBasicMaterial({color:'#22d3ee',transparent:true,opacity:.18,depthWrite:false})
  const routeA=new THREE.Mesh(new THREE.PlaneGeometry(COLS,.42),routeMaterial)
  routeA.rotation.x=-Math.PI/2;routeA.position.set(COLS/2,.006,ROWS/2)
  routeA.userData.skipOcclusion=true;world.add(routeA)
  const routeB=new THREE.Mesh(new THREE.PlaneGeometry(.42,ROWS),routeMaterial)
  routeB.rotation.x=-Math.PI/2;routeB.position.set(COLS/2,.007,ROWS/2)
  routeB.userData.skipOcclusion=true;world.add(routeB)
}

function addArenaWeapon(arena, cx, cz) {
  // Sword: inverted (tip down, pommel at top), very tall, thick blade ~= chain sphere radius
  const bladeMat=new THREE.MeshStandardMaterial({
    color:'#d4d8e0',roughness:.10,metalness:.97,
    emissive:'#22d3ee',emissiveIntensity:.22,
  })
  const guardMat=new THREE.MeshStandardMaterial({
    color:'#facc15',roughness:.20,metalness:.92,
    emissive:'#ca8a04',emissiveIntensity:.48,
  })
  const handleMat=new THREE.MeshStandardMaterial({
    color:'#1e293b',roughness:.72,metalness:.18,
    emissive:'#0f172a',emissiveIntensity:.18,
  })

  // tip at bottom — cone pointing DOWN (rotated 180°)
  const TIP_H=0.64, TIP_Y=0.32
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.22,TIP_H,4),bladeMat.clone())
  tip.rotation.x=Math.PI; tip.rotation.y=Math.PI/4
  tip.position.set(cx,TIP_Y,cz)
  arena.add(tip)

  // blade — tall and thick, sitting on top of tip
  const BLADE_H=7.0, BLADE_W=0.44, BLADE_D=0.30
  const BLADE_BOT=TIP_Y+TIP_H/2
  const BLADE_Y=BLADE_BOT+BLADE_H/2
  const blade=new THREE.Mesh(new THREE.BoxGeometry(BLADE_W,BLADE_H,BLADE_D),bladeMat)
  blade.position.set(cx,BLADE_Y,cz)
  // bright edge lines
  const edgeL=new THREE.Mesh(new THREE.BoxGeometry(.025,BLADE_H,.006),
    new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.60}))
  edgeL.position.set(cx-BLADE_W/2+.01,BLADE_Y,cz-BLADE_D/2+.01)
  const edgeR=edgeL.clone();edgeR.position.set(cx+BLADE_W/2-.01,BLADE_Y,cz-BLADE_D/2+.01)
  arena.add(blade,edgeL,edgeR)

  // cross-guard above blade
  const GUARD_Y=BLADE_BOT+BLADE_H+0.06
  const guard=new THREE.Mesh(new THREE.BoxGeometry(1.50,.14,.38),guardMat)
  guard.position.set(cx,GUARD_Y,cz)
  const guardEnd1=new THREE.Mesh(new THREE.SphereGeometry(.20,10,7),guardMat.clone())
  guardEnd1.position.set(cx-.76,GUARD_Y,cz)
  const guardEnd2=guardEnd1.clone();guardEnd2.position.set(cx+.76,GUARD_Y,cz)
  arena.add(guard,guardEnd1,guardEnd2)

  // grip above guard
  const GRIP_H=0.90, GRIP_Y=GUARD_Y+0.08+GRIP_H/2
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,GRIP_H,8),handleMat)
  grip.position.set(cx,GRIP_Y,cz)
  const wrapMat=new THREE.MeshStandardMaterial({color:'#facc15',roughness:.28,metalness:.82,emissive:'#92400e',emissiveIntensity:.34})
  const wrap1=new THREE.Mesh(new THREE.TorusGeometry(.19,.038,6,16),wrapMat)
  wrap1.rotation.x=Math.PI/2;wrap1.position.set(cx,GRIP_Y+.24,cz)
  const wrap2=wrap1.clone();wrap2.position.set(cx,GRIP_Y-.24,cz)
  arena.add(grip,wrap1,wrap2)

  // pommel at very top
  const POMMEL_Y=GRIP_Y+GRIP_H/2+0.26
  const pommel=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),guardMat.clone())
  pommel.position.set(cx,POMMEL_Y,cz)
  arena.add(pommel)

  // cyan glow ring at guard
  const glowRing=new THREE.Mesh(
    new THREE.TorusGeometry(.30,.055,6,28),
    new THREE.MeshBasicMaterial({color:'#22d3ee',transparent:true,opacity:.80,depthWrite:false}),
  )
  glowRing.rotation.x=Math.PI/2;glowRing.position.set(cx,GUARD_Y,cz)
  arena.add(glowRing)

  // magenta glow ring at blade mid
  const glowRing2=new THREE.Mesh(
    new THREE.TorusGeometry(.20,.040,6,24),
    new THREE.MeshBasicMaterial({color:'#d946ef',transparent:true,opacity:.70,depthWrite:false}),
  )
  glowRing2.rotation.x=Math.PI/2;glowRing2.position.set(cx,BLADE_Y,cz)
  arena.add(glowRing2)
}

function addCryptoColosseum(world) {
  const centerX=MINING_CHAIN_NODE_POSITION.col+.5
  const centerZ=MINING_CHAIN_NODE_POSITION.row+.5
  const arena=new THREE.Group()
  arena.userData.cryptoColosseum=true

  const foundation=new THREE.Mesh(
    new THREE.CylinderGeometry(5.25,5.25,.08,64),
    new THREE.MeshStandardMaterial({
      color:'#09061a',roughness:.64,metalness:.56,
      emissive:'#160b35',emissiveIntensity:.58,
    }),
  )
  foundation.position.set(centerX,.035,centerZ)
  foundation.userData.skipOcclusion=true
  arena.add(foundation)

  const ringMaterial=new THREE.MeshBasicMaterial({color:'#22d3ee',transparent:true,opacity:.88,depthWrite:false})
  for(const radius of [1.35,3.15,4.72]){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.045,6,64),ringMaterial.clone())
    ring.rotation.x=Math.PI/2;ring.position.set(centerX,.09,centerZ);arena.add(ring)
  }
  const magentaRing=new THREE.Mesh(
    new THREE.TorusGeometry(4.98,.065,6,64),
    new THREE.MeshBasicMaterial({color:'#d946ef',transparent:true,opacity:.78,depthWrite:false}),
  )
  magentaRing.rotation.x=Math.PI/2;magentaRing.position.set(centerX,.095,centerZ);arena.add(magentaRing)

  const laneMaterial=new THREE.MeshBasicMaterial({color:'#facc15',transparent:true,opacity:.30,depthWrite:false})
  const laneA=new THREE.Mesh(new THREE.PlaneGeometry(8.7,.10),laneMaterial)
  laneA.rotation.x=-Math.PI/2;laneA.position.set(centerX,.10,centerZ)
  const laneB=new THREE.Mesh(new THREE.PlaneGeometry(.10,8.7),laneMaterial.clone())
  laneB.rotation.x=-Math.PI/2;laneB.position.set(centerX,.105,centerZ)
  arena.add(laneA,laneB)

  const seatGeometry=new THREE.BoxGeometry(1,1,1)
  const sideEntries={cyan:[],magenta:[]}
  const seatCoords=[23,24,25,29,30,31]
  for(let tier=0;tier<3;tier++){
    const offset=tier,height=COLOSSEUM_SEAT_HEIGHT
    const y=COLOSSEUM_STAND_BASE_TOPS[tier]+height*.5
    for(const coord of seatCoords){
      sideEntries.cyan.push({x:coord+.5,y,z:22.5-offset,sx:.82,sz:.28,height})
      sideEntries.cyan.push({x:coord+.5,y,z:32.5+offset,sx:.82,sz:.28,height})
      sideEntries.magenta.push({x:22.5-offset,y,z:coord+.5,sx:.28,sz:.82,height})
      sideEntries.magenta.push({x:32.5+offset,y,z:coord+.5,sx:.28,sz:.82,height})
    }
  }
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion()
  for(const [side,entries] of Object.entries(sideEntries)){
    const color=side==='cyan'?'#22d3ee':'#d946ef'
    const seats=new THREE.InstancedMesh(
      seatGeometry,
      new THREE.MeshStandardMaterial({
        color,roughness:.38,metalness:.72,emissive:color,emissiveIntensity:.34,
        polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
      }),
      entries.length,
    )
    entries.forEach((entry,index)=>{
      position.set(entry.x,entry.y,entry.z);scale.set(entry.sx,entry.height||.20,entry.sz)
      matrix.compose(position,rotation,scale);seats.setMatrixAt(index,matrix)
    })
    seats.instanceMatrix.needsUpdate=true;arena.add(seats)
  }

  const beamMaterial=new THREE.MeshBasicMaterial({color:'#facc15',transparent:true,opacity:.38,depthWrite:false})
  for(const [x,z] of [[22.5,22.5],[32.5,22.5],[22.5,32.5],[32.5,32.5]]){
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.045,.12,4.2,8),beamMaterial.clone())
    beam.position.set(x,2.1,z);arena.add(beam)
    const crown=new THREE.Mesh(new THREE.TorusGeometry(.30,.045,6,20),new THREE.MeshBasicMaterial({color:'#facc15'}))
    crown.rotation.x=Math.PI/2;crown.position.set(x,4.12,z);arena.add(crown)
  }

  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.25,.055,6,40),new THREE.MeshBasicMaterial({color:'#facc15'}))
  halo.rotation.x=Math.PI/2;halo.position.set(centerX,2.35,centerZ);arena.add(halo)
  const haloCross=halo.clone();haloCross.rotation.set(0,0,Math.PI/2);arena.add(haloCross)

  const bridgeMaterial=new THREE.MeshStandardMaterial({
    color:'#123d56',roughness:.42,metalness:.68,
    emissive:'#08263a',emissiveIntensity:.72,side:THREE.DoubleSide,
  })
  const bridgeTop=new THREE.Mesh(new THREE.RingGeometry(7.55,8.45,96),bridgeMaterial)
  bridgeTop.rotation.x=-Math.PI/2;bridgeTop.position.set(centerX,BRIDGE_TOP,centerZ);arena.add(bridgeTop)
  const bridgeBottom=new THREE.Mesh(new THREE.RingGeometry(7.55,8.45,96),bridgeMaterial.clone())
  bridgeBottom.rotation.x=Math.PI/2;bridgeBottom.position.set(centerX,BRIDGE_BOTTOM,centerZ);arena.add(bridgeBottom)
  const bridgeOuter=new THREE.Mesh(
    new THREE.CylinderGeometry(8.45,8.45,BRIDGE_TOP-BRIDGE_BOTTOM,96,1,true),bridgeMaterial.clone(),
  )
  bridgeOuter.position.set(centerX,(BRIDGE_TOP+BRIDGE_BOTTOM)*.5,centerZ);arena.add(bridgeOuter)
  const bridgeInnerMaterial=bridgeMaterial.clone();bridgeInnerMaterial.side=THREE.BackSide
  const bridgeInner=new THREE.Mesh(
    new THREE.CylinderGeometry(7.55,7.55,BRIDGE_TOP-BRIDGE_BOTTOM,96,1,true),bridgeInnerMaterial,
  )
  bridgeInner.position.copy(bridgeOuter.position);arena.add(bridgeInner)
  for(const [radius,color] of [[7.55,'#d946ef'],[8.45,'#22d3ee']]){
    const rim=new THREE.Mesh(new THREE.TorusGeometry(radius,.055,6,96),new THREE.MeshBasicMaterial({color}))
    rim.rotation.x=Math.PI/2;rim.position.set(centerX,BRIDGE_TOP+.025,centerZ);arena.add(rim)
  }

  addArenaWeapon(arena,centerX,centerZ)
  world.add(arena)
}

function addBiomeLandmarks(world,textures) {
  const addParticles=(centerX,centerZ,color,seedOffset,height=4)=>{
    const count=70,positions=new Float32Array(count*3)
    for(let index=0;index<count;index++){
      positions[index*3]=centerX+(seededUnit(index+seedOffset)-.5)*24
      positions[index*3+1]=.35+seededUnit(index+seedOffset+80)*height
      positions[index*3+2]=centerZ+(seededUnit(index+seedOffset+160)-.5)*24
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
    world.add(new THREE.Points(geometry,new THREE.PointsMaterial({color,size:.055,transparent:true,opacity:.72,depthWrite:false})))
  }
  addParticles(14,42,'#bae6fd',620,3.2)
  addParticles(42,42,'#fb6a24',940,4.8)
  addParticles(42,14,'#67e8f9',1180,2.2)

  const rockMaterial=new THREE.MeshStandardMaterial({map:textures.mountain,color:'#8aa5bd',roughness:.82,flatShading:true})
  for(let index=0;index<22;index++){
    const height=2.5+seededUnit(index+220)*5.4
    const rock=new THREE.Mesh(new THREE.ConeGeometry(1.4+height*.17,height,5+index%3),rockMaterial.clone())
    rock.userData.avatarFadeOccluder=true
    const onNorth=index%2===0
    rock.position.set(onNorth?seededUnit(index+205)*25:-1.4,height*.5-.02,onNorth?-1.4:seededUnit(index+206)*25)
    rock.rotation.y=seededUnit(index+230)*Math.PI;world.add(rock)
  }
  const peak=new THREE.Mesh(new THREE.ConeGeometry(5.4,12,7),new THREE.MeshStandardMaterial({map:textures.mountain,color:'#7892aa',roughness:.84,flatShading:true}))
  peak.userData.avatarFadeOccluder=true
  peak.position.set(-1.5,5.9,-1.5);world.add(peak)
  const snowCap=new THREE.Mesh(new THREE.ConeGeometry(2.05,3.1,7),new THREE.MeshStandardMaterial({color:'#b9dff4',roughness:.72,flatShading:true}))
  snowCap.userData.avatarFadeOccluder=true
  snowCap.position.set(-1.5,10.35,-1.5);world.add(snowCap)

  const water=new THREE.Mesh(new THREE.PlaneGeometry(25.4,12.2,18,8),new THREE.MeshPhysicalMaterial({color:'#0aa9d6',transparent:true,opacity:.74,roughness:.08,metalness:.18,clearcoat:1,clearcoatRoughness:.08,side:THREE.DoubleSide,emissive:'#043b56',emissiveIntensity:.28}))
  water.rotation.x=-Math.PI/2;water.position.set(42,.018,-1.2);water.userData.biomeSurface='water';world.add(water)
  const sand=new THREE.Mesh(new THREE.PlaneGeometry(25.4,6.2),new THREE.MeshStandardMaterial({map:textures.coast,color:'#ffe0a0',roughness:.92}))
  sand.rotation.x=-Math.PI/2;sand.position.set(42,-.008,3.1);sand.userData.skipOcclusion=true;world.add(sand)
  for(let index=0;index<14;index++){
    const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.16+seededUnit(index+310)*.18),new THREE.MeshBasicMaterial({color:index%2?'#22d3ee':'#facc15'}))
    crystal.position.set(30+seededUnit(index+320)*24,.18,.4+seededUnit(index+330)*5.4);world.add(crystal)
  }

  const iceMaterial=new THREE.MeshPhysicalMaterial({map:textures.ice,color:'#c6f5ff',transparent:true,opacity:.82,roughness:.10,metalness:.22,clearcoat:1,clearcoatRoughness:.05,emissive:'#0d4c72',emissiveIntensity:.36})
  for(let index=0;index<18;index++){
    const height=.7+seededUnit(index+400)*2.8
    const shard=new THREE.Mesh(new THREE.ConeGeometry(.18+height*.10,height,4),iceMaterial.clone())
    shard.userData.avatarFadeOccluder=true
    shard.position.set(-.7-seededUnit(index+410)*1.8,height*.5,30+seededUnit(index+420)*25)
    shard.rotation.z=(seededUnit(index+430)-.5)*.28;world.add(shard)
  }
  const glacier=new THREE.Mesh(new THREE.DodecahedronGeometry(3.5,1),new THREE.MeshPhysicalMaterial({map:textures.ice,color:'#bdefff',roughness:.16,metalness:.18,clearcoat:1,emissive:'#0b4268',emissiveIntensity:.28,flatShading:true}))
  glacier.userData.avatarFadeOccluder=true
  glacier.scale.set(1.7,1,.9);glacier.position.set(-1.2,1.2,48);world.add(glacier)

  const lava=new THREE.Mesh(new THREE.PlaneGeometry(24,7.2),new THREE.MeshStandardMaterial({map:textures.inferno,color:'#ff6b13',emissive:'#ff2600',emissiveIntensity:2.2,roughness:.48,transparent:true,opacity:.92}))
  lava.rotation.x=-Math.PI/2;lava.position.set(42,.012,58.4);lava.userData.biomeSurface='lava';world.add(lava)
  for(let index=0;index<18;index++){
    const flame=new THREE.Group(),height=.45+seededUnit(index+1320)*.75
    const outer=new THREE.Mesh(new THREE.ConeGeometry(.14+height*.11,height,7),new THREE.MeshBasicMaterial({color:'#ff3d00',transparent:true,opacity:.82,depthWrite:false}))
    const inner=new THREE.Mesh(new THREE.ConeGeometry(.07+height*.06,height*.72,7),new THREE.MeshBasicMaterial({color:'#ffd43b',transparent:true,opacity:.92,depthWrite:false}))
    outer.position.y=height*.5;inner.position.y=height*.37;flame.add(outer,inner)
    flame.position.set(30+seededUnit(index+1330)*24,.02,30+seededUnit(index+1340)*24)
    flame.userData.biomeSurface='fire';flame.userData.phase=seededUnit(index+1350)*Math.PI*2;world.add(flame)
    if(index%4===0){
      const light=new THREE.PointLight('#ff5a16',8,7,1.8);light.position.set(flame.position.x,1.25,flame.position.z);world.add(light)
    }
  }
  for(let index=0;index<20;index++){
    const height=.8+seededUnit(index+500)*3.8
    const spire=new THREE.Mesh(new THREE.ConeGeometry(.24+height*.14,height,5),new THREE.MeshStandardMaterial({map:textures.inferno,color:index%3?'#5c191d':'#a53120',emissive:index%3?'#260307':'#8c1705',emissiveIntensity:.9,roughness:.74,flatShading:true}))
    spire.userData.avatarFadeOccluder=true
    const onSouth=index%2===0
    spire.position.set(onSouth?30+seededUnit(index+510)*25:56.7,height*.5,onSouth?56.7:30+seededUnit(index+520)*25);world.add(spire)
  }
  const portalRing=new THREE.Mesh(new THREE.TorusGeometry(2.1,.22,8,28),new THREE.MeshBasicMaterial({color:'#ff5b1a'}))
  portalRing.position.set(55.4,2.5,49);portalRing.rotation.y=Math.PI/4;world.add(portalRing)

  for(const [x,z,color] of [[14,14,'#67e8f9'],[42,14,'#2dd4bf'],[14,42,'#e0f2fe'],[42,42,'#fb4b1f']]){
    const beacon=new THREE.Group()
    const ringA=new THREE.Mesh(new THREE.TorusGeometry(.62,.045,6,18),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.58}))
    const ringB=ringA.clone();ringA.rotation.x=Math.PI/2;ringB.rotation.y=Math.PI/2
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(.18),new THREE.MeshBasicMaterial({color}))
    beacon.add(ringA,ringB,core);beacon.position.set(x,4.6,z);world.add(beacon)
  }
}

function makeEmojiSprite(emoji,color) {
  const canvas=document.createElement('canvas')
  canvas.width=128;canvas.height=128
  const context=canvas.getContext('2d')
  context.clearRect(0,0,128,128)
  context.shadowColor=color;context.shadowBlur=20
  context.fillStyle='rgba(1,7,14,.92)'
  context.strokeStyle=color;context.lineWidth=7
  context.beginPath();context.rect(8,8,112,112);context.fill();context.stroke()
  context.shadowBlur=0
  context.font='72px "Apple Color Emoji","Segoe UI Emoji",sans-serif'
  context.textAlign='center';context.textBaseline='middle'
  context.fillText(emoji||'◆',64,67)
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.minFilter=THREE.LinearFilter
  texture.generateMipmaps=false
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,alphaTest:.04})
  material.userData.ownedMap=true
  const sprite=new THREE.Sprite(material)
  sprite.scale.set(.72,.72,1)
  return sprite
}

function addInteractiveBeaconEmoji(world,row,col,cell,height) {
  if(!cell.isMarket||!cell.emoji) return
  const color=cell.isChainNode?'#facc15':cell.isPortalNode?(cell.color||'#22d3ee'):cell.isMarket?(cell.owner?'#4ade80':'#fb923c'):'#22d3ee'
  const beacon=new THREE.Group()
  const emojiSprite=makeEmojiSprite(cell.emoji,color)
  emojiSprite.position.y=height+.82
  beacon.add(emojiSprite)
  beacon.position.set(col+.5,0,row+.5)
  beacon.userData.interactive=true;beacon.userData.phase=seededUnit(row*71+col*113)*Math.PI*2
  world.add(beacon)
}

function addInteractiveBeaconBatch(world,entries) {
  if(!entries.length) return null
  const ringMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.78,depthWrite:false})
  const columnMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.22,depthWrite:false})
  const rings=new THREE.InstancedMesh(new THREE.TorusGeometry(.58,.035,6,24),ringMaterial,entries.length)
  const ring2s=new THREE.InstancedMesh(new THREE.TorusGeometry(.45,.025,6,20),ringMaterial.clone(),entries.length)
  const columns=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.11,1,8),columnMaterial,entries.length)
  const markerGroups={
    portal:{geometry:new THREE.OctahedronGeometry(.16),entries:[]},
    market:{geometry:new THREE.DodecahedronGeometry(.15),entries:[]},
    chain:{geometry:new THREE.TetrahedronGeometry(.18),entries:[]},
  }
  entries.forEach((entry,index)=>{
    const {cell}=entry
    const color=new THREE.Color(cell.isChainNode?'#facc15':cell.isPortalNode?(cell.color||'#22d3ee'):cell.isMarket?(cell.owner?'#4ade80':'#fb923c'):'#22d3ee')
    rings.setColorAt(index,color);ring2s.setColorAt(index,color);columns.setColorAt(index,color)
    const markerKey=cell.isPortalNode?'portal':cell.isMarket?'market':'chain'
    entry.markerKey=markerKey
    entry.markerIndex=markerGroups[markerKey].entries.length
    markerGroups[markerKey].entries.push(entry)
  })
  const markers={}
  for(const [key,group] of Object.entries(markerGroups)){
    if(!group.entries.length){group.geometry.dispose();continue}
    const mesh=new THREE.InstancedMesh(group.geometry,new THREE.MeshBasicMaterial({vertexColors:true}),group.entries.length)
    group.entries.forEach((entry,index)=>{
      const {cell}=entry
      mesh.setColorAt(index,new THREE.Color(cell.isChainNode?'#facc15':cell.isPortalNode?(cell.color||'#22d3ee'):cell.owner?'#4ade80':'#fb923c'))
    })
    if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true
    markers[key]=mesh
    world.add(mesh)
  }
  for(const mesh of [rings,ring2s,columns]) if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true
  world.add(rings,ring2s,columns)
  return {
    entries,rings,ring2s,columns,markers,
    parent:new THREE.Matrix4(),local:new THREE.Matrix4(),final:new THREE.Matrix4(),
    position:new THREE.Vector3(),scale:new THREE.Vector3(),quaternion:new THREE.Quaternion(),
    localPosition:new THREE.Vector3(),localScale:new THREE.Vector3(),localQuaternion:new THREE.Quaternion(),euler:new THREE.Euler(),
  }
}

function updateInteractiveBeaconBatch(batch,time) {
  if(!batch) return
  const yAxis=THREE.Object3D.DEFAULT_UP
  for(let index=0;index<batch.entries.length;index++){
    const entry=batch.entries[index]
    const pulse=1+Math.sin(time*2.8+entry.phase)*.08
    batch.position.set(entry.col+.5,Math.sin(time*2.1+entry.phase)*.045,entry.row+.5)
    batch.scale.setScalar(pulse)
    batch.quaternion.setFromAxisAngle(yAxis,time*.72+entry.phase)
    batch.parent.compose(batch.position,batch.quaternion,batch.scale)
    const setInstance=(mesh,instanceIndex,y,rotationX,rotationY,scaleY=1)=>{
      batch.localPosition.set(0,y,0)
      batch.localScale.set(1,scaleY,1)
      batch.localQuaternion.setFromEuler(batch.euler.set(rotationX,rotationY,0))
      batch.local.compose(batch.localPosition,batch.localQuaternion,batch.localScale)
      batch.final.multiplyMatrices(batch.parent,batch.local)
      mesh.setMatrixAt(instanceIndex,batch.final)
    }
    setInstance(batch.rings,index,entry.height+.14,Math.PI/2,0)
    setInstance(batch.ring2s,index,entry.height*.58,0,Math.PI/2)
    setInstance(batch.columns,index,(entry.height+.42)*.5,0,0,entry.height+.42)
    setInstance(batch.markers[entry.markerKey],entry.markerIndex,entry.height+.38,0,0)
  }
  for(const mesh of [batch.rings,batch.ring2s,batch.columns,...Object.values(batch.markers)]) mesh.instanceMatrix.needsUpdate=true
}

function rebuildThreeWorld(state,cellMap,obstacles) {
  if(!state) return
  if(state.world){state.scene.remove(state.world);disposeThreeObject(state.world)}
  const world=new THREE.Group(),matrix=new THREE.Matrix4(),position=new THREE.Vector3()
  const scale=new THREE.Vector3(),quaternion=new THREE.Quaternion()
  addBiomeGround(world,state.textures)
  addCryptoColosseum(world)
  addBiomeLandmarks(world,state.textures)
  // ── Block + node groups ───────────────────────────────────────────────────────
  // Each interactive type gets its own material & shape so players can tell them apart.
  // No texture maps here — texture × vertex-color was multiplying everything to black.
  //
  //  freeEntries      → cube, dark blue    — minable, no NFTJI, no owner
  //  nftjiEntries     → cube, amber        — minable, has NFTJI, no owner (BUY)
  //  ownedFreeEntries → cube, wallet color — mined block, no NFTJI (owned)
  //  ownedNftjiEntries→ cube, green        — mined block, has NFTJI (RESELL/info)
  //  chainEntries     → sphere, gold       — opens chain formula dialog
  //  portalEntries    → sphere, accent     — redirects to portal section
  const allBlockEntries=[...cellMap.entries()]
  const freeEntries      =allBlockEntries.filter(([,c])=>!c.owner&&!c.isMarket&&!c.isChainNode&&!c.isPortalNode)
  const nftjiEntries     =allBlockEntries.filter(([,c])=>c.isMarket&&!c.owner)
  const ownedFreeEntries =allBlockEntries.filter(([,c])=>c.owner&&!c.isMarket)
  const ownedNftjiEntries=allBlockEntries.filter(([,c])=>c.owner&&c.isMarket)
  const chainEntries     =allBlockEntries.filter(([,c])=>c.isChainNode)
  const portalEntries    =allBlockEntries.filter(([,c])=>c.isPortalNode)

  // Helper: cube InstancedMesh + wireframe glow + pedestal
  function makeBlockGroup(count, mat, glowColor, glowOpacity) {
    const geom=new THREE.BoxGeometry(1,1,1)
    const mesh=new THREE.InstancedMesh(geom,mat,count||1)
    const glow=new THREE.InstancedMesh(geom,new THREE.MeshBasicMaterial({color:glowColor,wireframe:true,transparent:true,opacity:glowOpacity,depthWrite:false}),count||1)
    const ped=new THREE.InstancedMesh(geom,new THREE.MeshStandardMaterial({roughness:.88,metalness:.16,vertexColors:true}),count||1)
    glow.userData.blockGlow=true
    return {mesh,glow,ped}
  }

  // Helper: place cube block + pedestal into a group at row,col
  function placeBlock(group, index, row, col, cell, cubeSide=.44, glowPad=0.018) {
    const height=blockTop(cell,row,col),cubeBottom=Math.max(0,height-cubeSide)
    position.set(col+.5,cubeBottom+cubeSide*.5,row+.5);scale.set(cubeSide,cubeSide,cubeSide)
    matrix.compose(position,quaternion,scale);group.mesh.setMatrixAt(index,matrix)
    scale.set(cubeSide+glowPad,cubeSide+glowPad,cubeSide+glowPad)
    matrix.compose(position,quaternion,scale);group.glow.setMatrixAt(index,matrix)
    const pw=cubeSide*0.75,ph=Math.max(.02,cubeBottom)
    position.set(col+.5,ph*.5,row+.5);scale.set(pw,ph,pw)
    matrix.compose(position,quaternion,scale);group.ped.setMatrixAt(index,matrix)
  }
  function flushGroup(g) {
    g.mesh.instanceMatrix.needsUpdate=true;g.glow.instanceMatrix.needsUpdate=true
    if(g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate=true
    g.ped.instanceMatrix.needsUpdate=true;if(g.ped.instanceColor) g.ped.instanceColor.needsUpdate=true
  }

  // ── Free mineable (no NFTJI, no owner) — dark blue per biome ────────────────
  const freeGroup=makeBlockGroup(freeEntries.length,
    new THREE.MeshStandardMaterial({roughness:.52,metalness:.22,vertexColors:true,emissive:'#0a1a40',emissiveIntensity:.35}),
    '#4488ff',.22)
  freeEntries.forEach(([key,cell],i)=>{
    const [row,col]=key.split(',').map(Number)
    placeBlock(freeGroup,i,row,col,cell)
    const c=new THREE.Color(BIOME_STYLE[biomeForCell(row,col)].block)
    freeGroup.mesh.setColorAt(i,c);freeGroup.ped.setColorAt(i,c.clone().multiplyScalar(.38))
  });flushGroup(freeGroup)

  // ── NFTJI unclaimed — bright amber ──────────────────────────────────────────
  const nftjiGroup=makeBlockGroup(nftjiEntries.length,
    new THREE.MeshStandardMaterial({color:'#ff9900',roughness:.48,metalness:.32,emissive:'#c05000',emissiveIntensity:.60}),
    '#ffb347',.40)
  nftjiEntries.forEach(([key,cell],i)=>{
    const [row,col]=key.split(',').map(Number)
    placeBlock(nftjiGroup,i,row,col,cell,.44,.02)
    nftjiGroup.ped.setColorAt(i,new THREE.Color('#7a3800'))
  });flushGroup(nftjiGroup)

  // ── Owned free (mined, no NFTJI) — wallet color ─────────────────────────────
  const ownedFreeGroup=makeBlockGroup(ownedFreeEntries.length,
    new THREE.MeshStandardMaterial({roughness:.46,metalness:.38,vertexColors:true,emissive:'#08182a',emissiveIntensity:.22}),
    '#67e8f9',.20)
  ownedFreeEntries.forEach(([key,cell],i)=>{
    const [row,col]=key.split(',').map(Number)
    placeBlock(ownedFreeGroup,i,row,col,cell)
    const c=new THREE.Color(cell.color||BIOME_STYLE[biomeForCell(row,col)].block)
    ownedFreeGroup.mesh.setColorAt(i,c);ownedFreeGroup.ped.setColorAt(i,c.clone().multiplyScalar(.40))
  });flushGroup(ownedFreeGroup)

  // ── Owned NFTJI (mined, has NFTJI) — green ──────────────────────────────────
  const ownedNftjiGroup=makeBlockGroup(ownedNftjiEntries.length,
    new THREE.MeshStandardMaterial({roughness:.46,metalness:.34,vertexColors:true,emissive:'#062a10',emissiveIntensity:.38}),
    '#4ade80',.28)
  ownedNftjiEntries.forEach(([key,cell],i)=>{
    const [row,col]=key.split(',').map(Number)
    placeBlock(ownedNftjiGroup,i,row,col,cell)
    const c=new THREE.Color(cell.color||'#22c55e')
    ownedNftjiGroup.mesh.setColorAt(i,c);ownedNftjiGroup.ped.setColorAt(i,c.clone().multiplyScalar(.38))
  });flushGroup(ownedNftjiGroup)

  // ── Chain nodes — gold sphere (opens formula dialog) ────────────────────────
  const chainSphereGeom=new THREE.SphereGeometry(.52,12,8)
  const chainMesh=new THREE.InstancedMesh(chainSphereGeom,
    new THREE.MeshStandardMaterial({color:'#facc15',roughness:.38,metalness:.58,emissive:'#a07000',emissiveIntensity:.70}),
    chainEntries.length||1)
  chainEntries.forEach(([key,cell],i)=>{
    const [row,col]=key.split(',').map(Number),h=blockTop(cell,row,col)
    position.set(col+.5,h-.46,row+.5);scale.set(1,1,1)
    matrix.compose(position,quaternion,scale);chainMesh.setMatrixAt(i,matrix)
  });chainMesh.instanceMatrix.needsUpdate=true

  // ── Portal nodes — colored sphere (redirects to portal section) ─────────────
  const portalSphereGeom=new THREE.SphereGeometry(.50,12,8)
  const portalMesh=new THREE.InstancedMesh(portalSphereGeom,
    new THREE.MeshStandardMaterial({roughness:.32,metalness:.50,vertexColors:true,emissive:'#000000',emissiveIntensity:.50}),
    portalEntries.length||1)
  portalEntries.forEach(([key,cell],i)=>{
    const [row,col]=key.split(',').map(Number),h=blockTop(cell,row,col)
    position.set(col+.5,h-.46,row+.5);scale.set(1,1,1)
    matrix.compose(position,quaternion,scale);portalMesh.setMatrixAt(i,matrix)
    portalMesh.setColorAt(i,new THREE.Color(cell.color||'#22d3ee'))
  });portalMesh.instanceMatrix.needsUpdate=true
  if(portalMesh.instanceColor) portalMesh.instanceColor.needsUpdate=true

  world.add(
    freeGroup.ped,       freeGroup.mesh,       freeGroup.glow,
    nftjiGroup.ped,      nftjiGroup.mesh,       nftjiGroup.glow,
    ownedFreeGroup.ped,  ownedFreeGroup.mesh,   ownedFreeGroup.glow,
    ownedNftjiGroup.ped, ownedNftjiGroup.mesh,  ownedNftjiGroup.glow,
    chainMesh, portalMesh,
  )
  const beaconEntries=[]
  for(const [key,cell] of allBlockEntries){
    if(!cell.isMarket&&!cell.isPortalNode&&!cell.isChainNode) continue
    const [row,col]=key.split(',').map(Number)
    const height=blockTop(cell,row,col)
    beaconEntries.push({row,col,cell,height,phase:seededUnit(row*71+col*113)*Math.PI*2})
    addInteractiveBeaconEmoji(world,row,col,cell,height)
  }
  state.beaconBatch=addInteractiveBeaconBatch(world,beaconEntries)
  updateInteractiveBeaconBatch(state.beaconBatch,performance.now()*.001)

  const boxGroups={mountain:[],coast:[],ice:[],inferno:[]}
  for(const entry of obstacles.entries()){
    if(isOrganicShape(entry[1])||entry[1].isColosseumBridge) continue
    const [row,col]=entry[0].split(',').map(Number);boxGroups[biomeForCell(row,col)].push(entry)
  }
  for(const [biome,entries] of Object.entries(boxGroups)){
    if(!entries.length) continue
    const style={
      mountain:{color:'#9bb9d2',roughness:.68,metalness:.12,emissive:'#071a2b',intensity:.14},
      coast:{color:'#ffd288',roughness:.84,metalness:.03,emissive:'#2a1803',intensity:.10},
      ice:{color:'#ddfaff',roughness:.12,metalness:.30,emissive:'#0b5d89',intensity:.42},
      inferno:{color:'#df5832',roughness:.55,metalness:.18,emissive:'#8c1705',intensity:.88},
    }[biome]
    const material=new THREE.MeshStandardMaterial({map:state.textures[biome],color:style.color,roughness:style.roughness,metalness:style.metalness,emissive:style.emissive,emissiveIntensity:style.intensity})
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,entries.length)
    entries.forEach(([key,obstacle],index)=>{
      const [row,col]=key.split(',').map(Number),bottom=obstacleBottom(obstacle),height=obstacleTop(obstacle)-bottom
      const visualTop=Number(obstacle.visualHeight)||obstacleTop(obstacle)
      const visualHeight=Math.max(.02,visualTop-bottom)
      position.set(col+.5,bottom+visualHeight*.5,row+.5);scale.set(.985,visualHeight,.985)
      matrix.compose(position,quaternion,scale);mesh.setMatrixAt(index,matrix)
    })
    mesh.instanceMatrix.needsUpdate=true;world.add(mesh)
  }

  for(const [key,obstacle] of obstacles){
    if(!isOrganicShape(obstacle)) continue
    const [row,col]=key.split(',').map(Number),biome=biomeForCell(row,col)
    const material=new THREE.MeshStandardMaterial({map:state.textures[biome],color:BIOME_STYLE[biome].block,roughness:biome==='ice'?.14:.66,metalness:biome==='ice'?.28:.14,emissive:biome==='inferno'?'#681205':biome==='ice'?'#0a4a70':'#000000',emissiveIntensity:biome==='inferno'?.82:.22})
    if(obstacle.shape==='ramp'){
      const mesh=new THREE.Mesh(makeRampGeometry(obstacle.direction),material)
      mesh.userData.avatarFadeOccluder=true
      mesh.position.set(col,0,row);mesh.scale.y=obstacleTop(obstacle);world.add(mesh)
    }else if(obstacle.shape==='sphere'){
      const radius=obstacle.radius||.34,mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(radius,2),material)
      mesh.userData.avatarFadeOccluder=true
      mesh.position.set(col+.5,radius,row+.5);world.add(mesh)
    }else{
      const tree=new THREE.Group()
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.13,.19,.92,7),new THREE.MeshStandardMaterial({color:'#6b4423',roughness:1}))
      trunk.userData.avatarFadeOccluder=true
      trunk.position.y=.46;tree.add(trunk)
      const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.52,1),material)
      crown.userData.avatarFadeOccluder=true
      crown.scale.set(1,1.35,1);crown.position.y=1.32;tree.add(crown)
      const core=new THREE.Mesh(new THREE.OctahedronGeometry(.13),new THREE.MeshBasicMaterial({color:'#5eead4'}))
      core.position.y=1.34;tree.add(core);tree.position.set(col+.5,0,row+.5);world.add(tree)
    }
  }
  state.world=world
  state.cameraCollisionValid=false
  state.biomeSurfaces=[]
  state.interactiveVisuals=[]
  state.avatarFadeOccluders=[]
  world.traverse(object=>{
    if(object.userData.biomeSurface) state.biomeSurfaces.push(object)
    if(object.userData.interactive||object.userData.blockGlow) state.interactiveVisuals.push(object)
    if(object.userData.avatarFadeOccluder){
      const materials=Array.isArray(object.material)?object.material:[object.material]
      object.userData.avatarFadeMaterials=materials.filter(Boolean).map(material=>({
        material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite,
      }))
      state.avatarFadeOccluders.push(object)
    }
  })
  const animated=new Set([
    ...(state.biomeSurfaces||[]),
    ...(state.interactiveVisuals||[]),
    ...Object.values(state.beaconBatch?.markers||{}),
    state.beaconBatch?.rings,state.beaconBatch?.ring2s,state.beaconBatch?.columns,
  ].filter(Boolean))
  world.traverse(object=>{
    if(object===world||animated.has(object)||object.userData.interactive) return
    object.updateMatrix()
    object.matrixAutoUpdate=false
  })
  state.scene.add(world)
}

function createThreeWalletAvatar(wallet) {
  const avatar=new THREE.Group()
  const color=new THREE.Color(colorFromAddress(wallet))
  const bright=color.clone().lerp(new THREE.Color('#ffffff'),.20)
  const dark=color.clone().multiplyScalar(.30)
  const mid=color.clone().multiplyScalar(.62)
  const bodyMat=new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.34})
  const brightMat=new THREE.MeshStandardMaterial({color:bright,roughness:.38,metalness:.42})
  const darkMat=new THREE.MeshStandardMaterial({color:dark,roughness:.72,metalness:.28})
  const midMat=new THREE.MeshStandardMaterial({color:mid,roughness:.58,metalness:.30})
  const cyanMat=new THREE.MeshBasicMaterial({color:'#67e8f9'})
  const goldMat=new THREE.MeshBasicMaterial({color:'#facc15'})
  const magentaMat=new THREE.MeshBasicMaterial({color:'#d946ef'})

  const torso=new THREE.Mesh(new THREE.BoxGeometry(.46,.48,.27),bodyMat)
  torso.position.y=.39;avatar.add(torso)
  const chestPlate=new THREE.Mesh(new THREE.BoxGeometry(.31,.22,.025),darkMat)
  chestPlate.position.set(0,.43,-.151);avatar.add(chestPlate)
  const chestInset=new THREE.Mesh(new THREE.BoxGeometry(.20,.105,.014),new THREE.MeshBasicMaterial({color:'#03121c'}))
  chestInset.position.set(0,.44,-.168);avatar.add(chestInset)
  const core=new THREE.Mesh(new THREE.BoxGeometry(.095,.055,.014),goldMat)
  core.position.set(0,.44,-.178);avatar.add(core)
  const belt=new THREE.Mesh(new THREE.BoxGeometry(.48,.065,.29),darkMat)
  belt.position.y=.20;avatar.add(belt)
  const beltNode=new THREE.Mesh(new THREE.BoxGeometry(.08,.06,.025),cyanMat)
  beltNode.position.set(0,.20,-.166);avatar.add(beltNode)

  const shoulderGeometry=new THREE.BoxGeometry(.13,.20,.25)
  const shoulderL=new THREE.Mesh(shoulderGeometry,midMat);shoulderL.position.set(-.295,.51,0);avatar.add(shoulderL)
  const shoulderR=shoulderL.clone();shoulderR.position.x=.295;avatar.add(shoulderR)
  const armGeometry=new THREE.BoxGeometry(.09,.25,.11)
  const armL=new THREE.Mesh(armGeometry,darkMat);armL.position.set(-.30,.36,0);avatar.add(armL)
  const armR=armL.clone();armR.position.x=.30;avatar.add(armR)
  const hand=new THREE.Mesh(new THREE.BoxGeometry(.10,.10,.12),brightMat);hand.position.set(.31,.22,-.01);avatar.add(hand)

  const neck=new THREE.Mesh(new THREE.BoxGeometry(.13,.07,.13),darkMat);neck.position.y=.68;avatar.add(neck)
  const head=new THREE.Mesh(new THREE.BoxGeometry(.34,.25,.25),brightMat);head.position.y=.82;avatar.add(head)
  const headFrame=new THREE.Mesh(new THREE.BoxGeometry(.27,.105,.018),darkMat);headFrame.position.set(0,.84,-.139);avatar.add(headFrame)
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.205,.045,.012),cyanMat);visor.position.set(0,.84,-.153);avatar.add(visor)
  const visorPixel=new THREE.Mesh(new THREE.BoxGeometry(.035,.025,.008),new THREE.MeshBasicMaterial({color:'#ffffff'}));visorPixel.position.set(-.067,.846,-.161);avatar.add(visorPixel)
  const earL=new THREE.Mesh(new THREE.BoxGeometry(.07,.11,.17),midMat);earL.position.set(-.205,.81,0);avatar.add(earL)
  const earR=earL.clone();earR.position.x=.205;avatar.add(earR)
  const antennaStem=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.12,5),darkMat);antennaStem.position.set(.08,1.005,0);avatar.add(antennaStem)
  const antennaTip=new THREE.Mesh(new THREE.OctahedronGeometry(.027),magentaMat);antennaTip.position.set(.08,1.075,0);avatar.add(antennaTip)

  const footGeometry=new THREE.BoxGeometry(.18,.11,.28)
  const footL=new THREE.Mesh(footGeometry,darkMat);footL.position.set(-.14,.075,-.025);avatar.add(footL)
  const footR=footL.clone();footR.position.x=.14;avatar.add(footR)
  const soleGeometry=new THREE.BoxGeometry(.19,.025,.30)
  const soleL=new THREE.Mesh(soleGeometry,midMat);soleL.position.set(-.14,.014,-.025);avatar.add(soleL)
  const soleR=soleL.clone();soleR.position.x=.14;avatar.add(soleR)

  // Retro USB staff. The connector is a rectangular Type-A plug, never a pick head.
  const tool=new THREE.Group();tool.position.set(.31,.25,-.01)
  const toolAngle=-.58
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.024,.030,.62,8),darkMat)
  shaft.rotation.z=toolAngle;shaft.position.set(.17,.255,0);tool.add(shaft)
  const dataRail=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.48,6),cyanMat)
  dataRail.rotation.z=toolAngle;dataRail.position.set(.185,.285,-.031);tool.add(dataRail)
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.19,8),new THREE.MeshStandardMaterial({color:'#07121c',roughness:.55,metalness:.55}))
  grip.rotation.z=toolAngle;grip.position.set(.055,.085,0);tool.add(grip)
  const gripRing=new THREE.Mesh(new THREE.TorusGeometry(.046,.009,5,12),magentaMat)
  gripRing.rotation.x=Math.PI/2;gripRing.rotation.y=toolAngle;gripRing.position.set(.11,.17,0);tool.add(gripRing)
  const plug=new THREE.Group();plug.position.set(.36,.535,0);plug.rotation.z=toolAngle
  const plugShell=new THREE.Mesh(new THREE.BoxGeometry(.15,.22,.095),new THREE.MeshStandardMaterial({color:'#d8e7ef',metalness:.78,roughness:.20}))
  plug.add(plugShell)
  const plugFace=new THREE.Mesh(new THREE.BoxGeometry(.105,.012,.061),new THREE.MeshBasicMaterial({color:'#041019'}));plugFace.position.y=.116;plug.add(plugFace)
  for(const x of [-.034,0,.034]){
    const contact=new THREE.Mesh(new THREE.BoxGeometry(.018,.008,.034),goldMat);contact.position.set(x,.124,0);plug.add(contact)
  }
  const plugCollar=new THREE.Mesh(new THREE.BoxGeometry(.17,.055,.11),magentaMat);plugCollar.position.y=-.13;plug.add(plugCollar)
  tool.add(plug)
  avatar.add(tool)
  avatar.userData.tool=tool
  avatar.userData.leftFoot=footL
  avatar.userData.rightFoot=footR
  return avatar
}

function syncThreeAvatars(state,presence,myIdentity) {
  if(!state) return
  const active=state._activeAvatars
  active.clear()
  for(const wallet in presence||{}){
    const data=presence[wallet]
    if(wallet.toLowerCase()===(myIdentity||'').toLowerCase()) continue
    active.add(wallet)
    let avatar=state.avatars.get(wallet)
    if(!avatar){
      avatar=createThreeWalletAvatar(wallet)
      state.avatars.set(wallet,avatar);state.scene.add(avatar)
    }
    const baseZ=Number(data.z)||0
    avatar.position.set(Number(data.gx??((data.col??0)+.5)),baseZ,Number(data.gy??((data.row??0)+.5)))
    avatar.rotation.y=-(Number(data.angle)||0)-Math.PI/2
    // Track whether depthTest changed so we only traverse when needed
    const wasDead=avatar.userData.wasDead||false
    if(data.isDead){
      // Lie flat: tilt 90° forward, raise slightly so body sits on the ground
      avatar.rotation.x=Math.PI/2
      avatar.position.y=baseZ+0.14
      avatar.userData.tool.rotation.x=0; avatar.userData.tool.rotation.z=0
      if(avatar.userData.leftFoot) avatar.userData.leftFoot.position.y=.075
      if(avatar.userData.rightFoot) avatar.userData.rightFoot.position.y=.075
      // Dead bodies render over obstacle walls so they stay visible when clipping
      if(!wasDead){
        avatar.userData.wasDead=true
        avatar.traverse(obj=>{
          if(!obj.isMesh) return
          obj.renderOrder=2
          const mats=Array.isArray(obj.material)?obj.material:[obj.material]
          mats.forEach(m=>{ m.depthTest=false })
        })
      }
    } else {
      avatar.rotation.x=0
      // Restore normal depth for living players
      if(wasDead){
        avatar.userData.wasDead=false
        avatar.traverse(obj=>{
          if(!obj.isMesh) return
          obj.renderOrder=0
          const mats=Array.isArray(obj.material)?obj.material:[obj.material]
          mats.forEach(m=>{ m.depthTest=true })
        })
      }
    // The local avatar is a screen-space HUD model. Cap remote projected size
    // to the same visual height so nearby wallets never become giants.
    const cameraSpace=state._avatarCameraSpace.copy(avatar.position).applyMatrix4(state.camera.matrixWorldInverse)
    const depth=Math.max(.08,-cameraSpace.z)
    const viewportHeight=Math.max(1,state.size.y||600)
    const viewportWidth=Math.max(1,state.size.x||900)
    const targetPixels=viewportWidth<640?86:Math.max(96,Math.min(112,viewportHeight*.19))
    const focalPixels=viewportHeight/(2*Math.tan(THREE.MathUtils.degToRad(state.camera.fov)*.5))
    const screenMatchedScale=(targetPixels*depth)/(REMOTE_AVATAR_MODEL_HEIGHT*focalPixels)
    avatar.scale.setScalar(Math.min(REMOTE_AVATAR_VISUAL_SCALE,screenMatchedScale))
    const swingAge=Date.now()-(Number(data.swingAt)||0)
    const swing=swingAge<SWING_DUR?Math.sin(swingAge/SWING_DUR*Math.PI):0
    // Forward strike: tool pitches toward target (rotation.x), slight side sweep
    avatar.userData.tool.rotation.x=-swing*1.15
    avatar.userData.tool.rotation.z=swing*0.28
    const walk=Number(data.walkDist)||0
    if(avatar.userData.leftFoot) avatar.userData.leftFoot.position.y=.075+Math.max(0,Math.sin(walk*.18))*.045
    if(avatar.userData.rightFoot) avatar.userData.rightFoot.position.y=.075+Math.max(0,Math.sin(walk*.18+Math.PI))*.045
    }
  }
  for(const [wallet,avatar] of state.avatars){
    if(active.has(wallet)) continue
    state.scene.remove(avatar);disposeThreeObject(avatar);state.avatars.delete(wallet)
  }
}

function updateAvatarOccluders(state) {
  const occluders=state?.avatarFadeOccluders||[]
  if(!occluders.length) return
  const faded=state._fadedOccluders
  faded.clear()
  const origin=state.camera.position
  const avatars=state._occlusionAvatars
  avatars.length=0
  for(const avatar of state.avatars.values()) avatars.push(avatar)
  if(state.localAvatar) avatars.push(state.localAvatar)
  for(const avatar of avatars){
    if(avatar.userData.wasDead) continue
    const target=state._occlusionTarget.copy(avatar.position)
    target.y+=Math.max(.18,avatar.scale.y*.58)
    const direction=state._occlusionDirection.copy(target).sub(origin)
    const distance=direction.length()
    if(distance<=.1) continue
    state.occlusionRaycaster.set(origin,direction.divideScalar(distance))
    state.occlusionRaycaster.near=.05
    state.occlusionRaycaster.far=Math.max(.05,distance-.08)
    const hits=state._occlusionHits
    hits.length=0
    state.occlusionRaycaster.intersectObjects(occluders,false,hits)
    for(const hit of hits) faded.add(hit.object)
  }
  for(const object of occluders){
    const shouldFade=faded.has(object)
    for(const entry of object.userData.avatarFadeMaterials||[]){
      const {material}=entry
      if(shouldFade){
        if(!material.transparent||material.depthWrite){
          material.transparent=true
          material.depthWrite=false
          material.needsUpdate=true
        }
        material.opacity=Math.min(entry.opacity,.24)
      }else{
        material.opacity=entry.opacity
        if(material.transparent!==entry.transparent||material.depthWrite!==entry.depthWrite){
          material.transparent=entry.transparent
          material.depthWrite=entry.depthWrite
          material.needsUpdate=true
        }
      }
    }
    object.renderOrder=shouldFade?1:0
  }
}

function syncThreeLocalAvatar(state,identity,swingT,walkDist,gx,gy,playerZ,heading,isDead) {
  const avatarId=identity||'local-player'
  if(!state.localAvatar||state.localAvatarId!==avatarId){
    if(state.localAvatar){
      state.hudScene.remove(state.localAvatar)
      state.scene.remove(state.localAvatar)
      disposeThreeObject(state.localAvatar)
    }
    state.localAvatar=createThreeWalletAvatar(avatarId)
    state.localAvatarId=avatarId
    state.scene.add(state.localAvatar)
  }
  state.localAvatar.rotation.y=-heading-Math.PI/2
  state.localAvatar.scale.setScalar(REMOTE_AVATAR_VISUAL_SCALE)
  if(isDead){
    state.localAvatar.position.set(gx,playerZ+0.14,gy)
    state.localAvatar.rotation.x=Math.PI/2
    state.localAvatar.userData.tool.rotation.x=0
    state.localAvatar.userData.tool.rotation.z=0
    if(state.localAvatar.userData.leftFoot) state.localAvatar.userData.leftFoot.position.y=.075
    if(state.localAvatar.userData.rightFoot) state.localAvatar.userData.rightFoot.position.y=.075
  }else{
    state.localAvatar.position.set(gx,playerZ,gy)
    state.localAvatar.rotation.x=0
    const swing=Math.sin(Math.min(1,swingT)*Math.PI)
    state.localAvatar.userData.tool.rotation.x=-swing*1.15
    state.localAvatar.userData.tool.rotation.z=swing*0.28
    const stride=walkDist*.18
    if(state.localAvatar.userData.leftFoot) state.localAvatar.userData.leftFoot.position.y=.075+Math.max(0,Math.sin(stride))*.045
    if(state.localAvatar.userData.rightFoot) state.localAvatar.userData.rightFoot.position.y=.075+Math.max(0,Math.sin(stride+Math.PI))*.045
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MiningChain3DFPV({
  cellMap, presenceMap, myWallet, presenceKey, myColor,
  initRow, initCol, jumpToCell,
  onPositionChange, onFacingChange, onWantNavigate, onPositionRealtime,
  onPvpHit, pvpStolen,
  onChainSolveOpen, externalPvpFlash, externalDodgeFlash = 0, externalKnockback, externalPush, onCollisionPush,
  swingMap, myPoolCode,
  anonKillMsg,
  playerLevel, playerNftjiCount, walletNftjis, myNftjis,
  healthMap,
  currency = 'EUR',
  es,
  myDeadUntil = null,
  myDeadPos   = null,
}) {
  const canvasRef    = useRef(null)
  const webglCanvasRef = useRef(null)
  const containerRef = useRef(null)
  const [pointerLocked, setPointerLocked] = useState(false)
  // Incrementing this key re-runs the Three.js init effect (recovery from context loss / crash)
  const [threeKey, setThreeKey] = useState(0)
  const threeReinitRef = useRef(null)
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
  const visualPresenceRef = useRef({})
  const lastRemoteFrameRef = useRef(0)
  const lastAmbientRenderRef = useRef(0)
  const renderRef     = useRef(null)
  const lastCellRef   = useRef({row:initRow??14,col:initCol??14})
  const zBufferRef    = useRef(null)
  const minimapStaticRef = useRef(null)
  // Pickaxe / mining
  const swingStartRef   = useRef(-9999)
  const hitDoneRef      = useRef(false)
  const mineProgressRef = useRef(0)
  const mineTargetRef   = useRef(null)
  const mineTypeRef     = useRef('empty')
  const facingDataRef   = useRef({ mx:-1, my:-1, cell:null })
  // PvP
  const enemyTargetRef  = useRef(null)   // { wallet, dist, isAnon } — within PVP_HIT_RANGE
  const enemyInSightRef = useRef(null)   // closest enemy in crosshair within PVP_SIGHT_RANGE (may be out of hit range)
  const pvpFlashRef     = useRef(0)      // timestamp of last pvp strike (for red flash)
  const dodgeFlashRef   = useRef(0)      // timestamp of last successful dodge (cyan flash)
  const pvpGainRef      = useRef(null)   // { text, at } for "+X EUR" popup
  const onPvpHitRef          = useRef(onPvpHit)
  const pvpStolenRef         = useRef(pvpStolen || {})
  const chainStatsRef        = useRef(null)
  const playerLevelRef       = useRef(playerLevel ?? 0)
  const globalMm3Ref         = useRef(0)
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
  const longJumpRef         = useRef(1)
  const critFlashRef        = useRef(-9999)
  const walletNftjisRef     = useRef(walletNftjis || {})
  const myNftjisRef         = useRef(myNftjis || [])
  const healthMapRef        = useRef(healthMap||{})
  const threeStateRef       = useRef(null)
  // FPS camera feel
  const cameraRollRef   = useRef(0)      // lean on strafe (radians)
  const landImpactRef   = useRef(0)      // landing punch (0-1, decays)
  const dynamicFovRef   = useRef(0)      // extra FOV radians when sprinting
  const breathPhaseRef  = useRef(0)      // idle breathing oscillator
  const prevJumpsRef    = useRef(0)      // detect landing edge
  const landVzRef       = useRef(0)      // vertical speed at landing (for impact strength)
  const hitPunchRef     = useRef(0)      // view punch on pvp hit / collision (0-1, decays)
  const myDeadUntilRef  = useRef(null)  // ms timestamp or null — synced from prop
  const myDeadPosRef    = useRef(null)  // { gx, gy } or null
  const rebuildThreeRef     = useRef(null)
  const obstaclesReadyRef   = useRef(false)

  // Expose reinit trigger to refs so it can be called from the render loop or context handlers
  useEffect(()=>{ threeReinitRef.current=()=>setThreeKey(k=>k+1) },[])


  // WebGL context loss / restore — browser can reclaim GPU memory when tab is backgrounded
  useEffect(()=>{
    const canvas=webglCanvasRef.current
    if(!canvas) return
    const onLost=(e)=>{ e.preventDefault(); threeStateRef.current=null }
    const onRestored=()=>{ setTimeout(()=>threeReinitRef.current?.(),200) }
    canvas.addEventListener('webglcontextlost',onLost)
    canvas.addEventListener('webglcontextrestored',onRestored)
    return ()=>{ canvas.removeEventListener('webglcontextlost',onLost); canvas.removeEventListener('webglcontextrestored',onRestored) }
  },[])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const canvas=webglCanvasRef.current
    if(!canvas) return
    let renderer
    try{
      renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})
    }catch{return}
    renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.toneMapping=THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure=1.38
    const scene=new THREE.Scene()
    scene.background=new THREE.Color('#020617')
    scene.fog=new THREE.FogExp2('#07132c',.018)
    const camera=new THREE.PerspectiveCamera(58,1,.05,100)
    const hudScene=new THREE.Scene()
    // Perspective camera for 3D avatar — positioned slightly above-right-front for a 3/4 hero pose
    const hudCamera=new THREE.PerspectiveCamera(42,1,0.05,10)
    hudCamera.position.set(0.36,1.08,-2.10);hudCamera.lookAt(0,0.38,0)
    hudScene.add(new THREE.HemisphereLight('#e5f7ff','#111827',2.5))
    const hudKey=new THREE.DirectionalLight('#ffffff',2.8);hudKey.position.set(-2,4,-4);hudScene.add(hudKey)
    const hudRim=new THREE.DirectionalLight('#22d3ee',1.4);hudRim.position.set(3,2,2);hudScene.add(hudRim)
    // Extra fill from the front so the face is readable
    const hudFront=new THREE.DirectionalLight('#b0f0ff',1.1);hudFront.position.set(0,0,-4);hudScene.add(hudFront)
    const hemi=new THREE.HemisphereLight('#d9f2ff','#18213a',2.15);scene.add(hemi)
    const key=new THREE.DirectionalLight('#fff4d6',2.35);key.position.set(-8,16,-10);scene.add(key)
    const rim=new THREE.DirectionalLight('#22d3ee',1.1);rim.position.set(12,5,14);scene.add(rim)
    const iceLight=new THREE.PointLight('#83e6ff',18,24,1.5);iceLight.position.set(14,6,42);scene.add(iceLight)
    const coastLight=new THREE.PointLight('#62eaff',12,22,1.7);coastLight.position.set(42,5,14);scene.add(coastLight)
    const infernoLight=new THREE.PointLight('#ff4b12',24,25,1.45);infernoLight.position.set(42,5,42);scene.add(infernoLight)
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(COLS,ROWS),new THREE.MeshStandardMaterial({color:'#07101f',roughness:.98,metalness:.02}))
    floor.rotation.x=-Math.PI/2;floor.position.set(COLS/2,-.012,ROWS/2);scene.add(floor)
    const grid=new THREE.GridHelper(Math.max(COLS,ROWS),Math.max(COLS,ROWS),'#176080','#12334f')
    grid.position.set(COLS/2,.004,ROWS/2);grid.material.transparent=true;grid.material.opacity=.22;scene.add(grid)
    addNightDome(scene)
    const textures={
      mountain:createProceduralTexture('mountain'),coast:createProceduralTexture('coast'),
      ice:createProceduralTexture('ice'),inferno:createProceduralTexture('inferno'),crypto:createProceduralTexture('crypto'),
    }
    const camRaycaster=new THREE.Raycaster(); camRaycaster.camera=camera
    const occlusionRaycaster=new THREE.Raycaster()
    const state={renderer,scene,camera,hudScene,hudCamera,localAvatar:null,localAvatarId:null,world:null,avatars:new Map(),pixelRatio:0,size:new THREE.Vector2(),hemi,key,rim,textures,
      camRaycaster,occlusionRaycaster,_occlusionTarget:new THREE.Vector3(),_occlusionDirection:new THREE.Vector3(),
      _v3a:new THREE.Vector3(),_v3b:new THREE.Vector3(),_v3c:new THREE.Vector3(),_v3d:new THREE.Vector3(),_v3e:new THREE.Vector3(),
      _avatarCameraSpace:new THREE.Vector3(),_activeAvatars:new Set(),_fadedOccluders:new Set(),
      _occlusionAvatars:[],_occlusionHits:[],viewWidth:0,viewHeight:0,viewDpr:0,viewFov:0,activeBiome:null}
    threeStateRef.current=state
    rebuildThreeRef.current=()=>rebuildThreeWorld(state,cellMapRef.current,validObstaclesRef.current)
    if(obstaclesReadyRef.current) rebuildThreeRef.current()
    return ()=>{
      rebuildThreeRef.current=null
      try{ disposeThreeObject(scene) }catch{}
      try{ disposeThreeObject(hudScene) }catch{}
      try{ Object.values(textures).forEach(texture=>texture.dispose()) }catch{}
      try{ scene.userData.skyTexture?.dispose?.() }catch{}
      try{ renderer.dispose() }catch{}
      threeStateRef.current=null
    }
  // threeKey intentionally drives re-runs of this effect for WebGL recovery
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[threeKey])

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
  // Mining skills: ❤️ speed · held mining NFTJI air travel · squeeze attack crit.
  useEffect(()=>{
    const nfts = myNftjis || []
    const hasHeart=nfts.some(n=>n.emoji==='❤️')
    const hasMiningNftji=nfts.some(n=>n.source==='mining')
    const hasAttackNftji=nfts.some(n=>n.blockKey==='sq-atk')
    critChanceRef.current = hasAttackNftji ? 0.05 : 0
    speedRef.current      = hasHeart ? MOVE_SPD * 1.10 : MOVE_SPD
    longJumpRef.current   = hasMiningNftji ? 1.10 : 1
  },[myNftjis])
  // External hit flash (victim sees red screen when struck by another player)
  useEffect(()=>{ if(externalPvpFlash) pvpFlashRef.current=performance.now() },[externalPvpFlash])
  useEffect(()=>{ if(externalDodgeFlash) dodgeFlashRef.current=performance.now() },[externalDodgeFlash])
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
    hitPunchRef.current=0.7
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
  // Sync death state refs from parent props
  useEffect(()=>{ myDeadUntilRef.current = myDeadUntil },[myDeadUntil])
  useEffect(()=>{ myDeadPosRef.current   = myDeadPos   },[myDeadPos])
  // Keep player level in sync for drawFacingHUD requirement check
  useEffect(()=>{ playerLevelRef.current = playerLevel ?? 0 },[playerLevel])
  // Fetch global MM3 value (token_value.total_eth) on mount and after any DB update
  useEffect(()=>{
    const fetch = () =>
      supabase.from('token_value').select('total_eth').limit(1).maybeSingle()
        .then(({ data }) => { if (data) globalMm3Ref.current = Number(data.total_eth) || 0 })
        .catch(()=>{})
    fetch()
    const handler = () => fetch()
    window.addEventListener('mm3-db-updated', handler)
    return () => window.removeEventListener('mm3-db-updated', handler)
  },[])

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
    for(const [key,cell] of cellMap){
      const [r,c]=key.split(',').map(Number)
      reserved.add(key)
      const approaches=[[1,0],[-1,0],[0,1],[0,-1]]
      if(cell.isPortalNode||cell.isChainNode||cell.isMarket){
        for(const [dr,dc] of approaches) reserved.add(`${r+dr},${c+dc}`)
      }else{
        const raw=String(cell.blockHex||gridToBlockHex(r,c)||'').replace('#','')
        const index=Number.parseInt(raw,16)||0
        const [dr,dc]=approaches[Math.abs(index+r*3+c*5)%approaches.length]
        reserved.add(`${r+dr},${c+dc}`)
      }
    }
    const valid = new Map()
    for (const [key, data] of OBSTACLE_MAP) {
      if(!reserved.has(key)) valid.set(key, chainObstacle(key,data))
    }

    // Keep the full arena footprint clear of procedural geometry. Authored
    // Colosseum walls were loaded above and remain in the valid obstacle map.
    for (let r = CRYPTO_COLOSSEUM_BOUNDS.minRow; r <= CRYPTO_COLOSSEUM_BOUNDS.maxRow; r++) {
      for (let c = CRYPTO_COLOSSEUM_BOUNDS.minCol; c <= CRYPTO_COLOSSEUM_BOUNDS.maxCol; c++) {
        reserved.add(`${r},${c}`)
      }
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

    addDenseMaze(valid,reserved,cellMap)
    addOrganicObstacles(valid,reserved,cellMap)

    // Build a small number of deterministic staircases beside isolated tall
    // obstacles. Each cube is a real collision/support surface, so players can
    // reach the roof through three normal jumps without adding moving geometry.
    let staircases = 0
    const directions = [[1,0],[0,1],[-1,0],[0,-1]]
    const tallObstacles = [...valid.entries()].sort(([a],[b]) => a.localeCompare(b))
    for (const [anchorKey, anchor] of tallObstacles) {
      if (staircases >= MAX_STAIRCASES) break
      if (anchor?.isStair || anchor?.isStructure || anchor?.isOrganic) continue
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
    ensureInteractiveConnectivity(valid,cellMap)
    validObstaclesRef.current = valid
    obstaclesReadyRef.current = true
    rebuildThreeRef.current?.()

    // Safety: if player is inside an obstacle or block, teleport to nearest free cell
    if (hitsSolidWall(playerRef.current.x/CELL_SIZE,playerRef.current.y/CELL_SIZE,cellMap,valid,playerRef.current.z)) {
      const curRow = Math.floor(playerRef.current.y / CELL_SIZE)
      const curCol = Math.floor(playerRef.current.x / CELL_SIZE)
      const free = findNearestFreeCell(curRow, curCol, cellMap, valid)
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

  // External teleport — fallback to nearest free cell if target is blocked
  useEffect(()=>{
    if (!jumpToCell) return
    const obs = validObstaclesRef.current
    const cm  = cellMapRef.current
    const targetGX=jumpToCell.col+.5,targetGY=jumpToCell.row+.5
    if (hitsSolidWall(targetGX,targetGY,cm,obs,0)) {
      const free = findNearestFreeCell(jumpToCell.row, jumpToCell.col, cm, obs)
      playerRef.current.x = (free.col + 0.5) * CELL_SIZE
      playerRef.current.y = (free.row + 0.5) * CELL_SIZE
    } else {
      playerRef.current.x = (jumpToCell.col + 0.5) * CELL_SIZE
      playerRef.current.y = (jumpToCell.row + 0.5) * CELL_SIZE
    }
    renderRef.current?.()
  },[jumpToCell])

  // ── Render ──────────────────────────────────────────────────────────────────
  // Dual-canvas architecture:
  //   webglCanvasRef → Three.js renders the 3D world (always active, spring-arm camera)
  //   canvasRef (2D)  → draws HUD on top: minimap, health, skills, crosshair, notifications
  //                     When Three.js is active strips=1 so the raycaster wall loop is a no-op.
  //                     The raycaster is a pure fallback if Three.js fails to initialise.
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
    const presence=visualPresenceRef.current
    for(const w in rawPresence||{}){
      const target=rawPresence[w]
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
      current.isDead=Boolean(target.isDead)
      current.deadUntil=target.deadUntil??null
      presence[w]=current
    }
    for(const w of visuals.keys()) if(!rawPresence?.[w]){visuals.delete(w);delete presence[w]}

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
    const stripW=threeStateRef.current?W:(W<=1600?2:STRIP_W)
    const strips=threeStateRef.current?0:Math.ceil(W/stripW)

    if (!zBufferRef.current || zBufferRef.current.length !== strips) {
      zBufferRef.current = new Float32Array(strips)
    }
    const zBuffer = zBufferRef.current

    // Compose all camera feel effects
    const roll      = cameraRollRef.current
    const landPitch = landImpactRef.current * 0.11     // max ~6.3° pitch-down on hard landing
    const hitPunch  = hitPunchRef.current * 0.09       // brief pitch kick on pvp hit / collision
    const breath    = Math.sin(breathPhaseRef.current) * 0.0045   // ±0.26° idle breathing
    const cameraBobZ = pz > 0 ? 0 : (Math.sin(walkDistRef.current*0.12) * 0.012 + breath)
    const cameraZ = pz + CAMERA_EYE_Z + cameraBobZ
    const effectivePitch = pitch + landPitch + hitPunch
    let threeState=threeStateRef.current
    if(threeState){
      try{
        const aspect=W/Math.max(1,H)
        const fovRad = FOV + dynamicFovRef.current
        const verticalFov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(fovRad/2)/aspect))
        const projectionChanged=threeState.viewWidth!==W||threeState.viewHeight!==H||Math.abs(threeState.viewFov-verticalFov)>.0001
        const sizeChanged=threeState.viewWidth!==W||threeState.viewHeight!==H||threeState.viewDpr!==dpr
        if(projectionChanged){
          threeState.camera.fov=verticalFov;threeState.camera.aspect=aspect;threeState.camera.updateProjectionMatrix()
          threeState.viewFov=verticalFov
        }
        if(sizeChanged){
          threeState.renderer.setPixelRatio(dpr)
          threeState.renderer.setSize(W,H,false)
          threeState.pixelRatio=dpr;threeState.viewDpr=dpr;threeState.viewWidth=W;threeState.viewHeight=H
          threeState.size.set(W,H)
        }
        const gx=px/CELL_SIZE,gy=py/CELL_SIZE,lookDistance=5
        const biome=biomeForCell(Math.floor(gy),Math.floor(gx))
        if(threeState.activeBiome!==biome){
          const atmosphere=BIOME_ATMOSPHERE[biome]
          threeState.scene.background.set(atmosphere.sky)
          threeState.scene.fog.color.set(atmosphere.fog)
          threeState.hemi.color.set(atmosphere.hemi)
          threeState.rim.color.set(atmosphere.rim)
          threeState.activeBiome=biome
        }
        // 3rd-person over-shoulder camera — drop to ground level when dead
        const localDead=myDeadUntilRef.current&&myDeadUntilRef.current>Date.now()
        const behindDist=localDead?1.20:2.55, aboveOffset=localDead?-0.45:1.15, lookFwd=2.4, shoulderR=localDead?0:0.30
        const cosA=Math.cos(angle),sinA=Math.sin(angle)
        // Perpendicular right vector (horizontal plane)
        const rightX=Math.cos(angle+Math.PI/2), rightZ=Math.sin(angle+Math.PI/2)
        const camX=gx - cosA*behindDist + rightX*shoulderR
        const camZworld=gy - sinA*behindDist + rightZ*shoulderR
        const cosRoll=Math.cos(roll*0.4),sinRoll=Math.sin(roll*0.4)  // subtle roll in TPS
        threeState.camera.up.set(-sinA*sinRoll, cosRoll, cosA*sinRoll)
        // Spring arm: pull camera toward player when world geometry occludes the avatar.
        // Casts a ray from the player eye to each candidate position; if blocked, the
        // camera is pulled to just in front of the hit.  When the primary position is
        // too close (<1.5 u) alternative positions are tried in priority order:
        //   1. rise vertically at primary angle   2. centre (no shoulder offset)
        //   3. opposite shoulder                  (each also tried elevated)
        // The candidate that achieves the greatest clear distance from the player wins.
        {
          const eyeY=cameraZ+0.5
          const ra=threeState._v3a.set(gx,eyeY,gy)
          const rb=threeState._v3b.set(camX,cameraZ+aboveOffset,camZworld)
          // Cast ray from player to (cx,cy,cz); update rb to achieved safe position.
          // Returns the clear distance achieved (possibly < ideal if blocked).
          const tryCam=(cx,cy,cz)=>{
            threeState._v3d.set(cx,cy,cz)
            threeState._v3c.copy(threeState._v3d).sub(ra)
            const d=threeState._v3c.length()
            if(d<0.05){ rb.copy(ra); return 0 }
            threeState._v3c.divideScalar(d)
            threeState.camRaycaster.set(ra,threeState._v3c)
            threeState.camRaycaster.near=0.05
            threeState.camRaycaster.far=d
            const hits=threeState.camRaycaster.intersectObject(threeState.world,true)
            if(hits.length===0){ rb.copy(threeState._v3d); return d }
            const safe=Math.max(0.22,hits[0].distance-0.15)
            rb.copy(ra).addScaledVector(threeState._v3c,safe)
            return safe
          }
          const lastCollision=threeState.cameraCollisionState
          const collisionChanged=!threeState.cameraCollisionValid||!lastCollision
            ||Math.abs(lastCollision.gx-gx)>.002||Math.abs(lastCollision.gy-gy)>.002
            ||Math.abs(lastCollision.angle-angle)>.002||Math.abs(lastCollision.rawZ-rawZ)>.002
            ||lastCollision.localDead!==Boolean(localDead)
          try {
            if(threeState.world&&collisionChanged){
              // Phase 1 — primary position
              tryCam(camX,cameraZ+aboveOffset,camZworld)
              // Phase 2 — try alternatives when camera is still too close to player
              if(rb.distanceTo(ra)<1.5){
                let bestDist=rb.distanceTo(ra)
                const bestPos=threeState._v3e.copy(rb)
                const cx0=gx-cosA*behindDist,              cz0=gy-sinA*behindDist
                const cxOpp=gx-cosA*behindDist-rightX*shoulderR, czOpp=gy-sinA*behindDist-rightZ*shoulderR
                const baseY=cameraZ+aboveOffset
                const candidates=[
                  [camX, baseY+0.7,camZworld],[camX,baseY+1.4,camZworld],[camX,baseY+2.1,camZworld],
                  [camX, baseY+2.8,camZworld],[camX,baseY+3.5,camZworld],[camX,baseY+4.2,camZworld],
                  [cx0,  baseY,    cz0      ],[cx0, baseY+0.7,cz0      ],[cx0, baseY+1.4,cz0      ],
                  [cx0,  baseY+2.1,cz0      ],[cx0, baseY+2.8,cz0      ],
                  [cxOpp,baseY,    czOpp    ],[cxOpp,baseY+0.7,czOpp   ],[cxOpp,baseY+1.4,czOpp   ],
                  [cxOpp,baseY+2.1,czOpp    ],[cxOpp,baseY+2.8,czOpp   ],
                ]
                for(const [cx,cy,cz] of candidates){
                  const d=tryCam(cx,cy,cz)
                  if(d>bestDist){ bestDist=d; bestPos.copy(rb) }
                  if(bestDist>=1.5) break  // good enough — stop searching
                }
                rb.copy(bestPos)
              }
              if(!threeState.cachedCameraPosition) threeState.cachedCameraPosition=new THREE.Vector3()
              threeState.cachedCameraPosition.copy(rb)
              threeState.cameraCollisionState={gx,gy,angle,rawZ,localDead:Boolean(localDead),cameraZ}
              threeState.cameraCollisionValid=true
            }else if(threeState.cachedCameraPosition&&lastCollision){
              rb.copy(threeState.cachedCameraPosition)
              rb.y+=cameraZ-lastCollision.cameraZ
            }
          } catch(_) { /* spring arm non-critical — fall through to default cam pos */ }
          threeState.camera.position.copy(rb)
        }
        threeState.camera.lookAt(
          gx + cosA*lookFwd,
          cameraZ - Math.sin(effectivePitch)*lookFwd*0.6 + 0.18,
          gy + sinA*lookFwd,
        )

        syncThreeAvatars(threeState,presence,myIdentity)
        const time=performance.now()*.001
        for(const object of threeState.biomeSurfaces||[]){
          if(object.userData.biomeSurface==='water'){
            object.position.y=.018+Math.sin(time*1.4)*.012
            object.material.opacity=.62+Math.sin(time*.8)*.06
          }else if(object.userData.biomeSurface==='lava'){
            object.material.opacity=.72+Math.sin(time*2.1)*.12
          }else if(object.userData.biomeSurface==='fire'){
            const pulse=.86+Math.sin(time*7+object.userData.phase)*.14
            object.scale.set(pulse,1.04+(pulse-.86)*.9,pulse)
            object.rotation.y=time*.9+object.userData.phase
          }
        }
        for(const object of threeState.interactiveVisuals||[]){
          if(object.userData.blockGlow){
            object.material.opacity=.14+(Math.sin(time*2.4)*.5+.5)*.16
          }else{
            const pulse=1+Math.sin(time*2.8+object.userData.phase)*.08
            object.scale.setScalar(pulse)
            object.rotation.y=time*.72+object.userData.phase
            object.position.y=Math.sin(time*2.1+object.userData.phase)*.045
          }
        }
        updateInteractiveBeaconBatch(threeState.beaconBatch,time)
        for(const orbital of threeState.scene.userData.orbitals||[]){
          if(orbital.userData.orbital==='ship'){
            const orbit=time*.055
            orbital.position.set(COLS/2+Math.cos(orbit)*39,13+Math.sin(time*.18)*2.2,ROWS/2+Math.sin(orbit)*39)
            orbital.rotation.y=-orbit+.2
          }else{
            orbital.rotation.y=time*.025;orbital.rotation.z=Math.sin(time*.04)*.08
          }
        }
        const localSwingAge=performance.now()-swingStartRef.current
        const localSwingT=localSwingAge<SWING_DUR?localSwingAge/SWING_DUR:0
        // Local avatar lives in the main 3D scene — sync position before render
        syncThreeLocalAvatar(threeState,myIdentity,localSwingT,walkDistRef.current,gx,gy,rawZ,angle,localDead)
        updateAvatarOccluders(threeState)
        threeState.renderer.render(threeState.scene,threeState.camera)
        // No separate HUD avatar pass: local player is now a scene object
      }catch(err){
        console.warn('[mm3 three] render error — scheduling reinit:',err)
        threeStateRef.current=null;threeState=null
        // Schedule recovery: re-run the init effect to rebuild the renderer
        setTimeout(()=>threeReinitRef.current?.(),1500)
      }
    }
    const projectionScale = H * PROJ_DIST
    const pitchSin = Math.sin(effectivePitch)
    const pitchCos = Math.cos(effectivePitch)
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
    const horizon = viewCenterY - Math.tan(effectivePitch) * projectionScale
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
    const renderCellRange=threeState?1:VISUAL_RANGE
    const viewMinRow=Math.max(0,gr-renderCellRange)
    const viewMaxRow=Math.min(ROWS-1,gr+renderCellRange)
    const viewMinCol=Math.max(0,gc-renderCellRange)
    const viewMaxCol=Math.min(COLS-1,gc+renderCellRange)
    const gridMinRow=Math.max(0,gr-FLOOR_GRID_RANGE)
    const gridMaxRow=Math.min(ROWS-1,gr+FLOOR_GRID_RANGE)
    const gridMinCol=Math.max(0,gc-FLOOR_GRID_RANGE)
    const gridMaxCol=Math.min(COLS-1,gc+FLOOR_GRID_RANGE)
    const curCell = cellMap.get(`${gr},${gc}`)
    // A cell directly below the player is a platform, not the room containing
    // the camera. Do not recolor the whole scene when landing on top of it.
    const atmosphereCell = pz < blockTop(curCell,gr,gc) ? curCell : null
    const [ar,ag,ab] = atmosphereCell?.color ? hexToRgb(atmosphereCell.color) : [0,0,0]
    const AT = 0.18

    if(threeState){
      // Three.js owns the scene — clear 2D canvas immediately so WebGL canvas shows through.
      ctx.clearRect(0,0,W,H)
    } else {
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

    // Thin atmospheric band separates silhouettes from the horizon without
    // adding geometry or texture fetches.
    const hazeH=Math.max(18,Math.min(72,H*.10))
    const haze=ctx.createLinearGradient(0,sceneSplitY-hazeH,0,sceneSplitY+hazeH)
    haze.addColorStop(0,'rgba(28,64,104,0)')
    haze.addColorStop(.5,'rgba(38,94,132,.16)')
    haze.addColorStop(1,'rgba(10,28,58,0)')
    ctx.fillStyle=haze;ctx.fillRect(0,sceneSplitY-hazeH,W,hazeH*2)
    } // end !threeState (backgrounds)

    // World-space grid made from projected cell edges. This is dramatically
    // cheaper than per-pixel floor casting and remains stable during motion.
    const solidHeightAt=(gx,gy)=>{
      const row=Math.floor(gy),col=Math.floor(gx),key=`${row},${col}`
      if(validObstaclesRef.current.has(key)){
        const obstacle=validObstaclesRef.current.get(key)
        if(obstacle?.shape==='ramp') return rampHeightAt(obstacle,gx,gy,row,col)
        if(isOrganicShape(obstacle)) return 0
        return obstacleTop(obstacle)
      }
      if(cellMap.has(key)) return blockTop(cellMap.get(key),row,col)
      return 0
    }
    if(!threeState){
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
    } // end !threeState (floor grid)

    if(!threeState){
    // Horizontal surfaces are bidirectional: platforms are visible from above
    // and suspended bridges expose a proper underside from below. Near-plane
    // clipping keeps the cell beneath the player stable instead of hiding it.
    const surfaces=[]
    for(let r=viewMinRow;r<=viewMaxRow;r++) for(let c=viewMinCol;c<=viewMaxCol;c++){
      const cameraCell=horizontalCameraPoint(c+.5,r+.5)
      if(cameraCell.dist>VISUAL_RANGE||cameraCell.depth<-1.1) continue
      if(Math.abs(cameraCell.lateral)>Math.max(1.7,cameraCell.depth*tanHalfFov+1.5)) continue
      const key=`${r},${c}`,obs=validObstaclesRef.current.get(key),cell=cellMap.get(key)
      if(!obs&&!cell) continue
      if(isOrganicShape(obs)) continue
      const topHeight=obs?obstacleTop(obs):blockTop(cell,r,c)
      const bottomHeight=obs?obstacleBottom(obs):0
      const isTop=cameraZ>topHeight+.015
      const isUnderside=bottomHeight>0&&cameraZ<bottomHeight-.015
      if(!isTop&&!isUnderside) continue
      const surfaceZ=isTop?topHeight:bottomHeight
      const verts=clipCameraPolygon([
        cameraVertex(c,r,surfaceZ),cameraVertex(c+1,r,surfaceZ),
        cameraVertex(c+1,r+1,surfaceZ),cameraVertex(c,r+1,surfaceZ),
      ])
      if(verts.length<3) continue
      const points=verts.map(screenVertex)
      const area=Math.abs(points.reduce((sum,point,index)=>{
        const next=points[(index+1)%points.length]
        return sum+point.x*next.y-next.x*point.y
      },0))*.5
      const minY=Math.min(...points.map(point=>point.y))
      const maxY=Math.max(...points.map(point=>point.y))
      const projectedHeight=maxY-minY
      if(!Number.isFinite(area)||area<0.35) continue
      const depth=verts.reduce((sum,v)=>sum+v.depth,0)/verts.length
      const edgeAlpha=projectedHeight<3?Math.max(.25,projectedHeight/3):1
      const areaAlpha=area<3?Math.max(.3,area/3):1
      surfaces.push({r,c,points,depth,surfaceZ,area,alpha:edgeAlpha*areaAlpha,isTop,obs,cell})
    }
    surfaces.sort((a,b)=>b.depth-a.depth)
    for(const surface of surfaces){
      const {obs,cell}=surface
      const base=obs?.base||(cell?.color?hexToRgb(cell.color):cell?.isChainNode?[220,170,25]:[48,82,142])
      const light=Math.max(.50,1-surface.depth*.022)
      const faceMul=surface.isTop?(obs?1.16:1.30):.48
      const [tr,tg,tb]=[Math.min(255,Math.round(base[0]*light*faceMul)),Math.min(255,Math.round(base[1]*light*faceMul)),Math.min(255,Math.round(base[2]*light*faceMul))]
      ctx.save()
      ctx.globalAlpha=surface.alpha??1
      ctx.fillStyle=`rgb(${tr},${tg},${tb})`
      ctx.strokeStyle=!surface.isTop?'rgba(34,211,238,.34)'
        :obs?.isRouteStair?'rgba(250,204,21,.88)'
        :obs?.isRoute?'rgba(103,232,249,.82)'
        :obs?.isRouteWall?'rgba(232,121,249,.70)'
        :'rgba(220,248,255,.44)'
      ctx.lineWidth=obs?.isRoute||obs?.isRouteStair?1.35:1
      ctx.beginPath();ctx.moveTo(surface.points[0].x,surface.points[0].y)
      for(let i=1;i<surface.points.length;i++)ctx.lineTo(surface.points[i].x,surface.points[i].y)
      ctx.closePath();ctx.fill();ctx.stroke()
      if(surface.depth<10&&surface.area>12){
        const offset=surface.isTop ? .003 : -.003
        const a=projectSegment([surface.c+.5,surface.r,surface.surfaceZ+offset],[surface.c+.5,surface.r+1,surface.surfaceZ+offset])
        const b=projectSegment([surface.c,surface.r+.5,surface.surfaceZ+offset],[surface.c+1,surface.r+.5,surface.surfaceZ+offset])
        ctx.strokeStyle=!surface.isTop?'rgba(34,211,238,.28)'
          :obs?.isRouteStair?'rgba(120,53,15,.55)'
          :obs?.isRoute?'rgba(1,20,30,.38)'
          :'rgba(0,0,0,.24)'
        ctx.beginPath()
        if(a){ctx.moveTo(a[0].x,a[0].y);ctx.lineTo(a[1].x,a[1].y)}
        if(b){ctx.moveTo(b[0].x,b[0].y);ctx.lineTo(b[1].x,b[1].y)}
        ctx.stroke()
      }
      ctx.restore()
    }
    } // end !threeState (surfaces)

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
      const wallTop = cell?.isObstacle ? obstacleTop(cell) : blockTop(cell,hitMy,hitMx)
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

      // Cheap volumetric lighting: a lit cap, a grounded contact shadow and a
      // soft center lift make flat raycast strips read as solid architecture.
      if(wallH>5){
        const capH=Math.max(1,Math.min(4,Math.round(wallH*.035)))
        ctx.fillStyle=cell?.isObstacle?'rgba(220,245,255,.16)':'rgba(255,255,255,.20)'
        ctx.fillRect(col*stripW,wTop,stripW,capH)
        const baseH=Math.max(2,Math.min(10,Math.round(wallH*.10)))
        ctx.fillStyle=wallBase<=.01?'rgba(0,2,10,.34)':'rgba(0,8,18,.18)'
        ctx.fillRect(col*stripW,wTop+wallH-baseH,stripW,baseH)
        if(col%4===0&&dist<11){
          ctx.fillStyle='rgba(180,235,255,.035)'
          ctx.fillRect(col*stripW,wTop+capH,stripW,Math.max(1,wallH-capH-baseH))
        }
      }

      // NFTJI vs free block visual distinction
      if (cell?.isMarket && !cell.owner) {
        // Unowned NFTJI: strong amber/gold full overlay so it stays warm even through fog
        ctx.fillStyle = 'rgba(255,155,20,0.52)'
        ctx.fillRect(col*stripW, wTop, stripW, wallH)
        // Bold top-cap to mark it clearly from a distance
        if (wallH > 3) {
          ctx.fillStyle = 'rgba(255,210,60,0.72)'
          ctx.fillRect(col*stripW, wTop, stripW, Math.max(2, Math.round(wallH*0.10)))
        }
      } else if (cell?.isMarket && cell.owner) {
        const isMe = myWallet && cell.owner.toLowerCase() === myWallet.toLowerCase()
        ctx.fillStyle = isMe ? 'rgba(34,211,238,0.28)' : `rgba(${hexToRgb(cell.color).join(',')},0.22)`
        ctx.fillRect(col*stripW, wTop, stripW, wallH)
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

    // Curved and sloped props are projected separately from the cell raycaster.
    // This keeps their silhouette honest and avoids invisible cube collision.
    const organic=[]
    for(let r=viewMinRow;r<=viewMaxRow;r++) for(let c=viewMinCol;c<=viewMaxCol;c++){
      const obstacle=validObstaclesRef.current.get(`${r},${c}`)
      if(!isOrganicShape(obstacle)) continue
      const cameraCell=horizontalCameraPoint(c+.5,r+.5)
      if(cameraCell.depth<=.12||cameraCell.dist>VISUAL_RANGE) continue
      if(Math.abs(cameraCell.lateral)>cameraCell.depth*tanHalfFov+1.2) continue
      organic.push({r,c,obstacle,...cameraCell})
    }
    organic.sort((a,b)=>b.depth-a.depth)
    const organicVisible=(screenX,depth)=>{
      const zCol=Math.floor(screenX/stripW)
      return zCol>=0&&zCol<strips&&depth<zBuffer[zCol]+.12
    }
    const fillProjectedFace=(vertices,fill,stroke)=>{
      const clipped=clipCameraPolygon(vertices.map(vertex=>cameraVertex(...vertex)))
      if(clipped.length<3) return
      const points=clipped.map(screenVertex)
      ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1
      ctx.beginPath();ctx.moveTo(points[0].x,points[0].y)
      for(let index=1;index<points.length;index++) ctx.lineTo(points[index].x,points[index].y)
      ctx.closePath();ctx.fill();ctx.stroke()
    }
    for(const item of organic){
      const {r,c,obstacle,depth}=item
      const centerVertex=cameraVertex(c+.5,r+.5,obstacle.shape==='tree'?1.05:obstacleTop(obstacle)*.5)
      if(centerVertex.depth<=.16) continue
      const center=screenVertex(centerVertex)
      if(!organicVisible(center.x,depth)) continue
      const fade=Math.max(.42,1-depth*.035)
      const [br,bg,bb]=obstacle.base
      const [lr,lg,lb]=obstacle.glow||[34,211,238]
      if(obstacle.shape==='ramp'){
        const heights={
          nw:rampHeightAt(obstacle,c,r,r,c),ne:rampHeightAt(obstacle,c+1,r,r,c),
          se:rampHeightAt(obstacle,c+1,r+1,r,c),sw:rampHeightAt(obstacle,c,r+1,r,c),
        }
        const top=[[c,r,heights.nw],[c+1,r,heights.ne],[c+1,r+1,heights.se],[c,r+1,heights.sw]]
        const faces=[
          {v:[[c,r,0],[c+1,r,0],[c+1,r,heights.ne],[c,r,heights.nw]],m:.68},
          {v:[[c+1,r,0],[c+1,r+1,0],[c+1,r+1,heights.se],[c+1,r,heights.ne]],m:.78},
          {v:[[c+1,r+1,0],[c,r+1,0],[c,r+1,heights.sw],[c+1,r+1,heights.se]],m:.60},
          {v:[[c,r+1,0],[c,r,0],[c,r,heights.nw],[c,r+1,heights.sw]],m:.72},
        ]
        faces.forEach(face=>fillProjectedFace(face.v,`rgba(${Math.round(br*face.m*fade)},${Math.round(bg*face.m*fade)},${Math.round(bb*face.m*fade)},.98)`,`rgba(${lr},${lg},${lb},.34)`))
        fillProjectedFace(top,`rgba(${Math.round(br*1.28*fade)},${Math.round(bg*1.28*fade)},${Math.round(bb*1.28*fade)},.99)`,`rgba(${lr},${lg},${lb},.82)`)
        const low=obstacle.direction==='west'?[c+1,r+.5,.02]:obstacle.direction==='north'?[c+.5,r+1,.02]:obstacle.direction==='south'?[c+.5,r,.02]:[c,r+.5,.02]
        const high=obstacle.direction==='west'?[c,r+.5,obstacleTop(obstacle)]:obstacle.direction==='north'?[c+.5,r,obstacleTop(obstacle)]:obstacle.direction==='south'?[c+.5,r+1,obstacleTop(obstacle)]:[c+1,r+.5,obstacleTop(obstacle)]
        const stripe=projectSegment(low,high)
        if(stripe){ctx.strokeStyle=`rgba(${lr},${lg},${lb},.72)`;ctx.beginPath();ctx.moveTo(stripe[0].x,stripe[0].y);ctx.lineTo(stripe[1].x,stripe[1].y);ctx.stroke()}
      }else if(obstacle.shape==='sphere'){
        const radius=Math.max(3,projectionScale*(obstacle.radius||.34)/centerVertex.depth)
        const groundY=projectY(0,depth)
        ctx.fillStyle='rgba(0,3,12,.34)';ctx.beginPath();ctx.ellipse(center.x,groundY,radius*.88,radius*.22,0,0,Math.PI*2);ctx.fill()
        const gradient=ctx.createRadialGradient(center.x-radius*.30,center.y-radius*.34,radius*.05,center.x,center.y,radius)
        gradient.addColorStop(0,`rgba(${Math.min(255,lr+70)},${Math.min(255,lg+55)},${Math.min(255,lb+35)},1)`)
        gradient.addColorStop(.45,`rgba(${lr},${lg},${lb},.98)`)
        gradient.addColorStop(1,`rgba(${Math.round(br*.38)},${Math.round(bg*.38)},${Math.round(bb*.38)},1)`)
        ctx.fillStyle=gradient;ctx.strokeStyle=`rgba(${lr},${lg},${lb},.92)`;ctx.lineWidth=Math.max(1,radius*.045)
        ctx.beginPath();ctx.arc(center.x,center.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke()
        ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(center.x,center.y,radius*.68,-2.45,-.55);ctx.stroke()
      }else{
        const groundY=projectY(0,depth)
        const trunkTop=screenVertex(cameraVertex(c+.5,r+.5,.92))
        const trunkW=Math.max(3,projectionScale*.17/centerVertex.depth)
        ctx.fillStyle='rgba(0,3,12,.32)';ctx.beginPath();ctx.ellipse(center.x,groundY,trunkW*1.8,Math.max(2,trunkW*.42),0,0,Math.PI*2);ctx.fill()
        ctx.fillStyle=`rgb(${Math.round(92*fade)},${Math.round(58*fade)},${Math.round(35*fade)})`
        ctx.strokeStyle='rgba(250,204,21,.42)';ctx.lineWidth=1
        ctx.beginPath();ctx.moveTo(center.x-trunkW,groundY);ctx.lineTo(center.x-trunkW*.62,trunkTop.y);ctx.lineTo(center.x+trunkW*.62,trunkTop.y);ctx.lineTo(center.x+trunkW,groundY);ctx.closePath();ctx.fill();ctx.stroke()
        const canopyRadius=Math.max(6,projectionScale*.48/centerVertex.depth)
        const canopyY=screenVertex(cameraVertex(c+.5,r+.5,1.38)).y
        for(const [ox,oy,scale] of [[0,-.34,.78],[-.48,.08,.68],[.48,.08,.68],[0,.27,.82]]){
          ctx.fillStyle=`rgba(${Math.round(br*(1+oy*.25)*fade)},${Math.round(bg*1.24*fade)},${Math.round(bb*fade)},.98)`
          ctx.strokeStyle=`rgba(${lr},${lg},${lb},.68)`
          ctx.beginPath();ctx.arc(center.x+canopyRadius*ox,canopyY+canopyRadius*oy,canopyRadius*scale,0,Math.PI*2);ctx.fill();ctx.stroke()
        }
        ctx.fillStyle=`rgba(${lr},${lg},${lb},.82)`;ctx.fillRect(center.x-1,canopyY-canopyRadius*.95,2,canopyRadius*1.7)
      }
    }

    if(!threeState){
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
    } // end !threeState (emoji)

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
        color: colorFromAddress(w), poolCode: pres.poolCode||null,
        isDead: Boolean(pres.isDead),
        deadUntil: pres.deadUntil
          ? (typeof pres.deadUntil === 'number' ? pres.deadUntil : new Date(pres.deadUntil).getTime())
          : null,
      })
    }
    sprites.sort((a,b) => b.dist - a.dist)

    if(!threeState)
    for (const { w, tX, tY, gx, gy, z:remoteZ, supportZ, angle:remoteAngle, swingAt, isBot, taskLabel, taskPhase, color, isDead, deadUntil } of sprites) {
      const groundCamera = cameraPoint(0, tY)
      if (groundCamera.rotatedDepth <= 0.05) continue
      const scrX = Math.round(W/2 + tX*horizontalProjection/groundCamera.rotatedDepth)
      const [cr,cg2,cb] = hexToRgb(color)
      const fade  = Math.max(0.32, 1 - tY*0.038)
      const alpha = Math.min(0.98, Math.max(0.12, 1.0 - tY*0.028))

      // Dead body: draw horizontal corpse + countdown, skip upright sprite
      if (isDead) {
        const zCol = Math.floor(scrX / stripW)
        if (zCol >= 0 && zCol < strips && tY < zBuffer[zCol]) {
          const bodyW = Math.round(Math.min(projectionScale / Math.max(0.72, tY), 150) * 0.86)
          const bodyH = Math.max(3, Math.round(bodyW * 0.22))
          const bodyY = Math.round(projectY(remoteZ, tY)) - bodyH
          ctx.globalAlpha = alpha * 0.92
          ctx.fillStyle = color
          ctx.fillRect(scrX - Math.floor(bodyW/2), bodyY, bodyW, bodyH)
          ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = '#000'
          ctx.fillRect(scrX - Math.floor(bodyW*0.35), bodyY + Math.floor(bodyH*0.15), Math.floor(bodyW*0.70), Math.max(1,Math.floor(bodyH*0.70)))
          if (tY < 25.0 && deadUntil) {
            const msLeft = Math.max(0, deadUntil - Date.now())
            const totalSec = Math.ceil(msLeft / 1000)
            const hh = String(Math.floor(totalSec/3600)).padStart(2,'0')
            const mm = String(Math.floor((totalSec%3600)/60)).padStart(2,'0')
            const ss = String(totalSec%60).padStart(2,'0')
            const lAlpha = Math.max(0, (25.0-tY)/25.0) * 0.92
            const lSize  = Math.max(8, Math.round(11/Math.max(0.5, tY)))
            ctx.font = `bold ${lSize}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
            ctx.globalAlpha = lAlpha * 0.45; ctx.fillStyle = '#000'
            ctx.fillText(`\u{1F480} ${hh}:${mm}:${ss}`, scrX+1, bodyY)
            ctx.globalAlpha = lAlpha; ctx.fillStyle = '#fb7185'
            ctx.fillText(`\u{1F480} ${hh}:${mm}:${ss}`, scrX, bodyY-1)
          }
          ctx.globalAlpha = 1
        }
        continue
      }

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
        if(visorW>7){ctx.fillStyle='#fff';ctx.fillRect(scrX-Math.floor(visorW*.28),visorY+1,Math.max(1,Math.round(visorW*.12)),1)}
        const antennaH=Math.max(2,Math.round(billsH*.34))
        ctx.strokeStyle='#071019';ctx.lineWidth=Math.max(1,Math.round(walletW*.025))
        ctx.beginPath();ctx.moveTo(scrX+Math.round(billsW*.22),billsTop);ctx.lineTo(scrX+Math.round(billsW*.22),billsTop-antennaH);ctx.stroke()
        ctx.fillStyle='#d946ef';ctx.fillRect(scrX+Math.round(billsW*.22)-1,billsTop-antennaH-2,3,3)
        const shoulderY=walletTop+Math.round(walletH*.10),shoulderW=Math.max(2,Math.round(walletW*.12))
        ctx.fillStyle=`rgb(${Math.round(cr*fade*.48)},${Math.round(cg2*fade*.48)},${Math.round(cb*fade*.48)})`
        ctx.fillRect(wx1-shoulderW,shoulderY,shoulderW,Math.max(3,Math.round(walletH*.24)))
        ctx.fillRect(wx2,shoulderY,shoulderW,Math.max(3,Math.round(walletH*.24)))
        const coreW=Math.max(3,Math.round(walletW*.20)),coreH=Math.max(2,Math.round(walletH*.10))
        ctx.fillStyle='#06131c';ctx.fillRect(scrX-coreW,claspY-1,coreW*2,coreH+2)
        ctx.fillStyle='#facc15';ctx.fillRect(scrX-Math.floor(coreW*.55),claspY,Math.max(2,Math.round(coreW*1.1)),coreH)
        const beltY=walletTop+Math.round(walletH*.70)
        ctx.fillStyle='rgba(2,8,18,.82)';ctx.fillRect(wx1,beltY,walletW,Math.max(2,Math.round(walletH*.06)))
        if(walletW>12){
          ctx.strokeStyle='rgba(103,232,249,.50)';ctx.lineWidth=1
          ctx.strokeRect(scrX-Math.round(walletW*.28),walletTop+Math.round(walletH*.54),Math.round(walletW*.56),Math.max(2,Math.round(walletH*.09)))
          ctx.fillStyle='#22d3ee';ctx.fillRect(wx1+Math.max(2,Math.round(walletW*.08)),beltY+1,Math.max(1,Math.round(walletW*.06)),Math.max(1,Math.round(walletH*.035)))
          ctx.fillStyle='#d946ef';ctx.fillRect(wx2-Math.max(3,Math.round(walletW*.14)),beltY+1,Math.max(1,Math.round(walletW*.06)),Math.max(1,Math.round(walletH*.035)))
        }
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

    if(threeState){
      // Use Three.js camera projection so labels track the 3D avatar exactly,
      // regardless of spring-arm position or pitch changes.
      const _sv=threeState._v3a
      for(const sprite of sprites){
        // Project the avatar head-top in Three.js world space (X=gx, Y=height, Z=gy)
        _sv.set(sprite.gx,(sprite.z||0)+1.05,sprite.gy)
        _sv.project(threeState.camera)
        if(_sv.z>1) continue  // behind camera
        const sx=(_sv.x+1)/2*W
        const sy=(-_sv.y+1)/2*H
        if(sx<-80||sx>W+80||sy<-40||sy>H+40) continue
        const hp=Math.max(0,Math.min(100,Number(healthMapRef.current[sprite.w]??100)))
        const label=sprite.isBot?`${sprite.w.slice(0,6)}…${sprite.w.slice(-4)} (BOT)`:`${sprite.w.slice(0,6)}…${sprite.w.slice(-4)}`
        const alpha=Math.max(.28,1-sprite.dist*.045)
        ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.textBaseline='top'
        let nextY=sy
        if(sprite.isDead){
          let countdown=''
          if(sprite.deadUntil){
            const msLeft=Math.max(0,sprite.deadUntil-Date.now())
            const totalSec=Math.ceil(msLeft/1000)
            const hh=String(Math.floor(totalSec/3600)).padStart(2,'0')
            const mm=String(Math.floor((totalSec%3600)/60)).padStart(2,'0')
            const ss=String(totalSec%60).padStart(2,'0')
            countdown=` ${hh}:${mm}:${ss}`
          }
          ctx.font='bold 10px monospace'
          ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillText(`\u{1F480}${countdown}`,sx+1,nextY+1)
          ctx.fillStyle='#fb7185';ctx.fillText(`\u{1F480}${countdown}`,sx,nextY)
          ctx.globalAlpha=1
          continue
        }
        if(sprite.poolCode){
          ctx.font='bold 9px monospace'
          ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillText(`[${sprite.poolCode}]`,sx+1,nextY+1)
          ctx.fillStyle='#f59e0b';ctx.fillText(`[${sprite.poolCode}]`,sx,nextY)
          nextY+=12
        }
        ctx.font='bold 10px monospace'
        ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillText(label,sx+1,nextY+1)
        ctx.fillStyle=sprite.color;ctx.fillText(label,sx,nextY)
        nextY+=13
        const barW=42
        ctx.fillStyle='#26070e';ctx.fillRect(sx-barW/2,nextY,barW,4)
        ctx.fillStyle=hp>60?'#4ade80':hp>25?'#facc15':'#fb7185';ctx.fillRect(sx-barW/2,nextY,barW*hp/100,4)
        ctx.globalAlpha=1
      }
    }

    // ── Wall face overlays — ONLY for mineable blocks, never for structural walls ──
    // Use the actual wall top height so the crosshair activates across the full obstacle face
    const fwdWallTopH = fwdCell?.isObstacle ? obstacleTop(fwdCell) : blockTop(fwdCell,fwdMy,fwdMx)
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

    // Inspect prompt when very close — suppressed when a player is in the crosshair
    if (fwdDist < 0.9 && fwdCell && !enemyTargetRef.current?.wallet) {
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      const isMineWall2 = myWallet && fwdCell.owner?.toLowerCase() === myWallet.toLowerCase()
      if (fwdCell.isChainNode) {
        ctx.fillStyle = '#ffd700cc'
        ctx.fillText(es ? '[ ↵ RESOLVER CADENA ]' : '[ ↵ SOLVE FORMULA CHAIN ]', W/2, viewCenterY+18)
      } else if (fwdCell.isPortalNode) {
        ctx.fillStyle = '#22d3eecc'
        ctx.fillText(es ? '[ ↵ IR ]' : '[ ↵ GO ]', W/2, viewCenterY+18)
      } else if (!fwdCell.owner && fwdCell.isMarket) {
        ctx.fillStyle = '#fb923ccc'
        ctx.fillText(es ? '[ ↵ COMPRAR NFTJI ]' : '[ ↵ BUY NFTJI ]', W/2, viewCenterY+18)
      } else if (isMineWall2 && fwdCell.isMarket) {
        ctx.fillStyle = '#4ade80cc'
        ctx.fillText(es ? '[ ↵ LIBERAR NFTJI ]' : '[ ↵ RESELL NFTJI ]', W/2, viewCenterY+18)
      } else if (!fwdCell.owner && !fwdCell.isPortalNode) {
        ctx.fillStyle = C + 'cc'
        ctx.fillText(es ? '[ ↵ MINAR BLOQUE ]' : '[ ↵ MINE BLOCK ]', W/2, viewCenterY+18)
      }
    }

    } // end: block-only overlays (not obstacles)

    // ── Crosshair — always visible, brightens on target ──────────────────────
    const hasTarget  = fwdMx >= 0 && fwdMy >= 0 && fwdCell !== null && crosshairHitsFace
    const playerInXH = Boolean(enemyTargetRef.current?.wallet)
    const inXHRange  = !playerInXH && hasTarget && !fwdCell?.isObstacle && fwdDist <= INTERACT_DIST
    const xhBase     = playerInXH ? '#ef4444'
                     : fwdCell?.isChainNode ? '#ffd700'
                     : (fwdCell?.owner ? fwdCell.color : C)
    const xhFgCol    = playerInXH ? '#ff6b6b'
                     : inXHRange  ? xhBase
                     : '#ffffff'
    const xhLen      = playerInXH ? 14 : inXHRange ? 13 : 10
    const xhGap      = playerInXH ? 3  : inXHRange ? 2  : 3
    const xhLW       = playerInXH ? 2.2 : inXHRange ? 1.8 : 1.4
    // Draw dark outline first so crosshair is readable on any background
    const drawXH = () => {
      ctx.beginPath()
      ctx.moveTo(W/2-xhLen-xhGap, viewCenterY); ctx.lineTo(W/2-xhGap, viewCenterY)
      ctx.moveTo(W/2+xhGap, viewCenterY);       ctx.lineTo(W/2+xhLen+xhGap, viewCenterY)
      ctx.moveTo(W/2, viewCenterY-xhLen-xhGap); ctx.lineTo(W/2, viewCenterY-xhGap)
      ctx.moveTo(W/2, viewCenterY+xhGap);       ctx.lineTo(W/2, viewCenterY+xhLen+xhGap)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = xhLW + 1.8; drawXH()
    ctx.strokeStyle = xhFgCol; ctx.lineWidth = xhLW;
    ctx.globalAlpha = playerInXH ? 1 : inXHRange ? 0.95 : 0.82
    drawXH()
    ctx.globalAlpha = 1
    // Centre dot
    ctx.fillStyle = xhFgCol
    ctx.beginPath(); ctx.arc(W/2, viewCenterY, playerInXH ? 3 : inXHRange ? 2.5 : 2, 0, Math.PI*2); ctx.fill()
    // Ring when on block target or player
    if (inXHRange) {
      ctx.globalAlpha = 0.22; ctx.strokeStyle = xhBase; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(W/2, viewCenterY, 24, 0, Math.PI*2); ctx.stroke()
      ctx.globalAlpha = 1
    }
    if (playerInXH) {
      const pulse = 0.55 + Math.sin(Date.now()/180)*0.20
      ctx.globalAlpha = pulse; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(W/2, viewCenterY, 20, 0, Math.PI*2); ctx.stroke()
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

    // ── Dodge flash (cyan vignette + text) — victim successfully dodged ───
    const dodgeAge = performance.now() - dodgeFlashRef.current
    if (dodgeAge < 500) {
      const da = (1 - dodgeAge / 500) * 0.32
      const dg = ctx.createRadialGradient(W/2,H/2,H*0.15, W/2,H/2,H*0.75)
      dg.addColorStop(0, `rgba(34,211,238,${(da*0.4).toFixed(3)})`)
      dg.addColorStop(1, `rgba(6,182,212,${da.toFixed(3)})`)
      ctx.globalAlpha = 1
      ctx.fillStyle = dg
      ctx.fillRect(0, 0, W, H)
      const dt = Math.max(0, 1 - dodgeAge / 500)
      ctx.globalAlpha = dt
      ctx.font = `bold ${Math.round(14 + dt * 4)}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#22d3ee'
      ctx.fillText('🛡 DODGED!', W/2, H * HORIZON_RATIO - 58 - (1-dt)*14)
      ctx.globalAlpha = 1
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
        ctx.fillStyle = gain.color || '#4ade80'
        ctx.fillText(gain.text, W/2, H * HORIZON_RATIO - 40 - ga*20)
        ctx.globalAlpha = 1
      } else pvpGainRef.current = null
    }

    // ── Death HUD overlay (own player dead) ──────────────────────────────────
    const deadUntilMs = myDeadUntilRef.current
    if (deadUntilMs && deadUntilMs > Date.now()) {
      const msLeft = Math.max(0, deadUntilMs - Date.now())
      const totalSec = Math.ceil(msLeft / 1000)
      const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0')
      const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
      const ss = String(totalSec % 60).padStart(2, '0')
      // Dark red vignette
      const dg = ctx.createRadialGradient(W/2,H/2,H*0.08, W/2,H/2,H*0.72)
      dg.addColorStop(0,'rgba(0,0,0,0)')
      dg.addColorStop(1,'rgba(100,0,0,0.62)')
      ctx.globalAlpha=1; ctx.fillStyle=dg; ctx.fillRect(0,0,W,H)
      // Skull + countdown
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.font=`bold ${Math.round(H*0.11)}px monospace`
      ctx.globalAlpha=0.92; ctx.fillStyle='#fb7185'
      ctx.fillText('\u{1F480}', W/2, H*0.38)
      ctx.font=`bold ${Math.round(H*0.055)}px monospace`
      ctx.fillStyle='#fca5a5'
      ctx.fillText('YOU WERE KILLED', W/2, H*0.52)
      ctx.font=`bold ${Math.round(H*0.048)}px monospace`
      ctx.fillStyle='#fff'
      ctx.fillText(`REVIVE IN  ${hh}:${mm}:${ss}`, W/2, H*0.60)
      ctx.globalAlpha=1
    }

    drawMinimap(ctx,gr,gc,angle,cellMap,presence,myIdentity,W,H,chainNodePosRef.current,validObstaclesRef.current,px/CELL_SIZE,py/CELL_SIZE,minimapStaticRef,dpr)
    drawOnlineList(ctx,W,H,presence,myIdentity,pvpStolenRef.current)
    const walletDock = drawWalletDock(
      ctx,W,H,myNftjisRef.current,healthMapRef.current[myIdentity]??100,es,Boolean(myWallet)
    )
    const chainStatsBottom = drawChainStats(ctx,W,H,chainStatsRef.current,es,(walletDock?.bottom||8)+6)

    // ── Facing block info HUD — left side, below MM3 BLOCK CHAIN panel ────────
    if (fwdDist <= 2.0 && !enemyTargetRef.current?.wallet) {
      const _isObsHUD = fwdCell?.isObstacle || validObstaclesRef.current?.has(`${fwdMy},${fwdMx}`)
      const _maxHudDist = (!_isObsHUD && fwdCell?.isMarket && !fwdCell?.owner) ? 1.5 : 2.0
      if ((_isObsHUD || fwdFaceSolid) && fwdDist <= _maxHudDist) {
        drawFacingHUD(ctx, W, H, fwdCell, fwdMx, fwdMy, myWallet, es, fwdDist, validObstaclesRef.current, chainStatsBottom ?? 72, mineProgressRef.current, playerLevelRef.current, globalMm3Ref.current)
      }
    }
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
      // Portrait tablet (≥540px wide, taller than wide): render at 65% resolution
      // so the raycaster casts fewer strips and CSS upscales the result.
      // Mobile is narrower than 540px so it keeps normal full resolution.
      const isPortraitTablet = cssW >= 540 && cssH > cssW
      let physW, physH, dpr
      if (isPortraitTablet) {
        dpr = 0.65
        physW = Math.round(cssW * dpr)
        physH = Math.round(cssH * dpr)
      } else {
        const pixels = cssW * cssH
        const dprCap = pixels > 1600000 ? 1.1 : 1.3
        dpr = Math.min(dprCap, Math.max(1, window.devicePixelRatio || 1))
        physW = Math.round(cssW * dpr)
        physH = Math.round(cssH * dpr)
      }
      canvas.dataset.dpr = String(dpr)
      canvas.width = physW
      canvas.height = physH
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      zBufferRef.current=null
      minimapStaticRef.current=null
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
        // Player in crosshair takes priority — Enter triggers swing instead of block action
        if(!enemyTargetRef.current?.wallet){
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
        }
        e.preventDefault()
      }
      if(e.key===' '||e.code==='Space'){
        if(!keysRef.current.space){  // fire once per physical press, not on key-hold repeat
          keysRef.current.space=true
          const _p=playerRef.current
          const _dead=myDeadUntilRef.current&&myDeadUntilRef.current>Date.now()
          if(!_dead&&_p.jumps<MAX_JUMPS){ _p.vz=Math.max(0,_p.vz)+JUMP_VZ; _p.jumps++ }
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
    const canvas=canvasRef.current
    const onLock=()=>setPointerLocked(document.pointerLockElement===canvasRef.current)
    const onMouseMove=(e)=>{
      if(document.pointerLockElement!==canvasRef.current) return
      // Acceleration curve: raw pixels → scaled with sqrt for precise slow / fast fast
      const BASE_SENS=0.0026
      const applyAccel=(raw)=>{
        const sign=raw<0?-1:1
        const abs=Math.abs(raw)
        // linear below 5px/frame, sqrt-blended above — feel precise at low speed, natural at high
        return sign*BASE_SENS*(abs<5 ? abs : 5+Math.sqrt((abs-5)*3.4))
      }
      playerRef.current.angle += applyAccel(e.movementX)
      playerRef.current.pitch = Math.max(-MAX_PITCH,Math.min(MAX_PITCH,
        playerRef.current.pitch + applyAccel(e.movementY)*0.92))
      renderRef.current?.()
    }
    // Prevent wheel from scrolling the page while the game canvas is in view
    const onWheel=(e)=>{ e.preventDefault() }
    const onCtx=(e)=>{ e.preventDefault() }
    document.addEventListener('pointerlockchange',onLock)
    document.addEventListener('mousemove',onMouseMove)
    canvas?.addEventListener('wheel',onWheel,{passive:false})
    canvas?.addEventListener('contextmenu',onCtx)
    return ()=>{
      document.removeEventListener('pointerlockchange',onLock)
      document.removeEventListener('mousemove',onMouseMove)
      canvas?.removeEventListener('wheel',onWheel)
      canvas?.removeEventListener('contextmenu',onCtx)
    }
  },[])

  // Pointer drag rotates; tapping swings the USB staff.
  const handlePointerDown = useCallback((e)=>{
    if(e.pointerType==='mouse'){
      if(document.pointerLockElement!==canvasRef.current){ canvasRef.current?.requestPointerLock?.(); return }
      const nowDead=myDeadUntilRef.current&&myDeadUntilRef.current>Date.now()
      if(!nowDead&&performance.now()-swingStartRef.current>SWING_DUR){
        swingStartRef.current=performance.now(); swingEpochRef.current=Date.now(); hitDoneRef.current=false
      }
      return
    }
    canvasRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { pointerId:e.pointerId,x:e.clientX,y:e.clientY,type:e.pointerType,moved:0 }
  },[])
  const handlePointerMove = useCallback((e)=>{
    if (!dragRef.current||dragRef.current.pointerId!==e.pointerId) return
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
  const handlePointerUp = useCallback((e)=>{
    if(!dragRef.current||dragRef.current.pointerId!==e.pointerId) return
    if (dragRef.current.type!=='touch' && (dragRef.current.moved||0) < 8) {
      // Tap/click with minimal movement swings the USB staff.
      const nowDead=myDeadUntilRef.current&&myDeadUntilRef.current>Date.now()
      if (!nowDead && performance.now()-swingStartRef.current > SWING_DUR) {
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

      // When dead: lock position, block movement, still allow look-around
      const myDead = myDeadUntilRef.current && myDeadUntilRef.current > Date.now()
      if (myDead && myDeadPosRef.current) {
        const dp = myDeadPosRef.current
        p.x = dp.gx * CELL_SIZE; p.y = dp.gy * CELL_SIZE
        p.z = 0; p.vz = 0
        velocityRef.current.x = 0; velocityRef.current.y = 0
      }

      if(k.q){p.angle-=TURN_SPD*dt;needsRender=true}
      if(k.e){p.angle+=TURN_SPD*dt;needsRender=true}

      const joy=joystickRef.current
      const fwd=myDead?0:(k.w?1:0)-(k.s?1:0)-joy.y, str=myDead?0:(k.d?1:0)-(k.a?1:0)+joy.x
      const inputLen=Math.hypot(fwd,str)||1
      const targetSpeed=speedRef.current*(p.z>.04?longJumpRef.current:1)
      const targetVX=(Math.cos(p.angle)*(fwd/inputLen)+Math.cos(p.angle+Math.PI/2)*(str/inputLen))*targetSpeed
      const targetVY=(Math.sin(p.angle)*(fwd/inputLen)+Math.sin(p.angle+Math.PI/2)*(str/inputLen))*targetSpeed
      const blend=1-Math.exp(-MOVE_ACCEL*dt)
      const vel=velocityRef.current
      vel.x+=(targetVX-vel.x)*blend; vel.y+=(targetVY-vel.y)*blend
      if(!fwd&&!str&&Math.hypot(vel.x,vel.y)<0.5){vel.x=0;vel.y=0}
      // Physical collision repulsion: push away from nearby players (no health damage)
      if(!myDead) for(const [w,remote] of remoteVisualsRef.current.entries()){
        if(w.toLowerCase()===(presenceKeyRef.current||myWalletRef.current||'').toLowerCase()) continue
        if(Math.abs((Number(remote.z)||0)-p.z)>.85) continue
        const repX=p.x/CELL_SIZE-remote.gx, repY=p.y/CELL_SIZE-remote.gy
        const repD=Math.hypot(repX,repY)
        if(repD<AVATAR_R*2&&repD>.01){
          const overlap=(AVATAR_R*2-repD)/(AVATAR_R*2)
          const bump=80*overlap
          vel.x+=(repX/repD)*bump; vel.y+=(repY/repD)*bump
          hitPunchRef.current=Math.max(hitPunchRef.current,overlap*0.4)
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
      const cm=cellMapRef.current, obs=validObstaclesRef.current
      const movedDist=Math.hypot(vel.x,vel.y)*dt
      if(movedDist>0.001){
        const nx=p.x+vel.x*dt
        const ny=p.y+vel.y*dt
        const R=PLAYER_R*CELL_SIZE
        const inBX=nx>R&&nx<WORLD_W-R, inBY=ny>R&&ny<WORLD_H-R
        const ngx=nx/CELL_SIZE, ngy=ny/CELL_SIZE
        const cgx=p.x/CELL_SIZE, cgy=p.y/CELL_SIZE
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
          const prevX=p.x, prevY=p.y
          if(inBX&&!hitsSolidWall(ngx,cgy,cm,obs,p.z)&&!avatarBlocked(ngx,cgy)) p.x=nx
          if(inBY&&!hitsSolidWall(cgx,ngy,cm,obs,p.z)&&!avatarBlocked(cgx,ngy)) p.y=ny
          // Corner-clip guard: both axes slid into a combined position that is
          // itself solid (diagonal block corner). Revert to avoid penetration.
          if(p.x!==prevX&&p.y!==prevY&&hitsSolidWall(p.x/CELL_SIZE,p.y/CELL_SIZE,cm,obs,p.z)){
            p.x=prevX; p.y=prevY
          }
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
        const floorZ = supportHeight&&p.z>=supportHeight-.24 ? supportHeight : 0
        if(floorZ>p.z&&floorZ-p.z<=.24&&p.vz<=0){
          p.z=floorZ;p.vz=0;p.jumps=0;needsRender=true
        }
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
            // Detect landing impact: store pre-landing vertical speed
            if(prevJumpsRef.current>0&&p.vz<-0.8){
              landVzRef.current=Math.abs(p.vz)
              landImpactRef.current=Math.min(1,Math.abs(p.vz)/JUMP_VZ)
            }
            p.z = floorZ; p.vz = 0; p.jumps = 0   // land on floor or block top
          } else {
            p.z = nz
          }
          needsRender = true
        }
      }
      prevJumpsRef.current = p.jumps

      // ── Stuck-in-solid recovery ──────────────────────────────────────────────
      // If the player somehow ended up inside a solid cell (e.g. world update),
      // eject them to the nearest free cell centre so they can always move.
      {
        const sGX=p.x/CELL_SIZE, sGY=p.y/CELL_SIZE
        if(hitsSolidWall(sGX,sGY,cm,obs,p.z)){
          const r0=Math.floor(sGY), c0=Math.floor(sGX)
          let ejected=false
          outer: for(let d=0;d<=3;d++){
            for(let dr=-d;dr<=d&&!ejected;dr++){
              for(let dc=-d;dc<=d&&!ejected;dc++){
                if(d>0&&Math.abs(dr)<d&&Math.abs(dc)<d) continue
                const ex=c0+dc+0.5, ey=r0+dr+0.5
                if(!hitsSolidWall(ex,ey,cm,obs,p.z)){
                  p.x=ex*CELL_SIZE; p.y=ey*CELL_SIZE
                  vel.x=0; vel.y=0
                  ejected=true
                }
              }
            }
          }
        }
      }

      // ── FPS camera feel ──────────────────────────────────────────────────────
      {
        const joy=joystickRef.current
        const strInput=(keysRef.current.d?1:0)-(keysRef.current.a?1:0)+joy.x
        const speedNow=Math.hypot(velocityRef.current.x,velocityRef.current.y)
        const isMoving=speedNow>2

        // Camera roll: lean into strafe — max ~2.2°
        const rollTarget=-strInput*0.038
        cameraRollRef.current+=(rollTarget-cameraRollRef.current)*(1-Math.exp(-9*dt))

        // Dynamic FOV: swell when running (+5° max)
        const fovBoost=Math.min(speedNow/(MOVE_SPD*CELL_SIZE),1)*0.087
        dynamicFovRef.current+=(fovBoost-dynamicFovRef.current)*(1-Math.exp(-5*dt))

        // Landing impact: brief downward pitch punch, decays quickly
        if(landImpactRef.current>0.01){
          landImpactRef.current*=Math.exp(-14*dt)
          needsRender=true
        }else{
          landImpactRef.current=0
        }

        // Hit punch: brief view kick on pvp hit / collision, decays fast
        if(hitPunchRef.current>0.01){
          hitPunchRef.current*=Math.exp(-12*dt)
          needsRender=true
        }else{
          hitPunchRef.current=0
        }

        // Idle breathing: slow sinusoidal swell when not moving
        if(!isMoving){
          breathPhaseRef.current+=dt*0.55
          needsRender=true
        }else{
          // Fade breath phase back to zero without popping
          breathPhaseRef.current*=Math.exp(-3*dt)
        }
      }

      // Replicate the full avatar state. This also runs while stationary so
      // Mouse look, jumps and USB staff swings remain visible to every client.
      {
        const now=Date.now()
        const nextState={
          gx:p.x/CELL_SIZE,gy:p.y/CELL_SIZE,z:p.z,
          angle:p.angle,pitch:p.pitch,swingAt:swingEpochRef.current,
          isDead:Boolean(myDead),
          deadUntil:myDeadUntilRef.current||null,
        }
        const prev=lastSentStateRef.current
        const changed=!prev
          || Math.hypot(nextState.gx-prev.gx,nextState.gy-prev.gy)>0.004
          || Math.abs(nextState.z-prev.z)>0.004
          || Math.abs(nextState.angle-prev.angle)>0.03
          || Math.abs(nextState.pitch-prev.pitch)>0.03
          || nextState.swingAt!==prev.swingAt
        // Two network updates/sec are enough because remote avatars interpolate
        // every rendered frame. Idle heartbeats are deliberately infrequent.
        if(now-lastRealtimeRef.current>500&&(changed||now-(prev?.sentAt||0)>15000)){
          lastRealtimeRef.current=now
          lastSentStateRef.current={...nextState,sentAt:now}
          onPositionRealtimeRef.current?.(nextState.gx,nextState.gy,nextState)
        }
      }

      // ── Enemy sprite targeting (screen-space, zoom-invariant) ─────────────
      if(myDead){ enemyTargetRef.current=null; enemyInSightRef.current=null; actionUrlRef.current=null; mineTypeRef.current='empty' }
      const camGX = p.x / CELL_SIZE, camGY = p.y / CELL_SIZE
      let closestEnemy = null, closestDist = Infinity
      let closestInSight = null, closestInSightDist = Infinity
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
      const _threeState = threeStateRef.current
      for (const [w, pres] of myDead ? [] : remoteVisualsRef.current.entries()) {
        const isMe = w.toLowerCase() === (myIdentity || '').toLowerCase()
        if (isMe) continue
        if (pres.isDead) continue  // dead players are not targetable
        const sgx = pres.gx ?? ((pres.col ?? 0) + 0.5)
        const sgy = pres.gy ?? ((pres.row ?? 0) + 0.5)
        const rx = sgx - camGX, ry = sgy - camGY
        const tY = Math.cos(p.angle)*rx + Math.sin(p.angle)*ry
        if (tY < 0.15 || tY > PVP_SIGHT_RANGE) continue
        const remoteZ = Number(pres.z) || 0
        const verticalGap = Math.abs(remoteZ - p.z)
        if (verticalGap > 0.90 || Math.hypot(tY, verticalGap) > PVP_SIGHT_RANGE) continue
        const enemyPool  = presenceRef.current[w]?.poolCode || null
        const myPool     = myPoolCodeRef.current
        const isTeammate = !!(myPool && enemyPool && myPool === enemyPool)
        let hitZone = null

        if (_threeState) {
          // In 3D mode: use Three.js camera projection for exact spring-arm accuracy.
          // The 2D raycaster projection uses the player eye, not the spring-arm camera,
          // so it diverges when the camera is pulled back — causing missed/wrong detections.
          const sv = _threeState._v3a
          sv.set(sgx, remoteZ + 0.85, sgy); sv.project(_threeState.camera)
          if (sv.z > 1) continue
          const pxHead = (sv.x + 1) / 2 * _W, pyHead = (-sv.y + 1) / 2 * _H
          sv.set(sgx, remoteZ + 0.42, sgy); sv.project(_threeState.camera)
          const pxMid  = (sv.x + 1) / 2 * _W, pyMid  = (-sv.y + 1) / 2 * _H
          sv.set(sgx, remoteZ + 0.05, sgy); sv.project(_threeState.camera)
          const pyFeet = (-sv.y + 1) / 2 * _H
          // Bounding box with generous tolerance so click-feel matches the visual
          const pad = 14
          const minX = Math.min(pxHead, pxMid) - pad
          const maxX = Math.max(pxHead, pxMid) + pad
          const minY = Math.min(pyHead, pyFeet) - 4
          const maxY = Math.max(pyHead, pyFeet) + 4
          if (_cx < minX || _cx > maxX || _cy < minY || _cy > maxY) continue
          hitZone = _cy <= pyMid ? 'head' : 'body'
        } else {
          // 2D raycaster mode: project with player-eye math (same as the renderer).
          const tX = -Math.sin(p.angle)*rx + Math.cos(p.angle)*ry
          const relZ  = remoteZ - (p.z + CAMERA_EYE_Z)
          const rotV  = relZ * _cosP + tY * _sinP
          const rotD  = tY  * _cosP - relZ * _sinP
          if (rotD <= 0.05) continue
          const scrX    = Math.round(_cx + tX * _hProj / rotD)
          const bottomY = Math.min(_H+30, Math.round(_viewCY - rotV * _projScale / rotD))
          const sScale  = Math.min(_projScale / Math.max(0.72, tY), 150)
          const walletH = Math.round(sScale * 0.58 * REMOTE_AVATAR_VISUAL_SCALE)
          const walletW = Math.round(sScale * 0.50 * REMOTE_AVATAR_VISUAL_SCALE)
          const billsH  = Math.round(sScale * 0.20 * REMOTE_AVATAR_VISUAL_SCALE)
          const walletTop = bottomY - walletH
          const billsTop  = walletTop - billsH
          if (Math.abs(_cx - scrX) > walletW * 0.60) continue
          hitZone = _cy >= billsTop && _cy <= walletTop ? 'head'
                  : _cy >  walletTop && _cy <= bottomY  ? 'body'
                  : null
          if (!hitZone) continue
        }

        const inHitRange = tY <= PVP_HIT_RANGE && Math.hypot(tY, verticalGap) <= PVP_HIT_RANGE
        const entry = { wallet: w, dist: tY, isAnon: w.startsWith('anon-'), isTeammate, hitZone }
        if (inHitRange && tY < closestDist) { closestDist = tY; closestEnemy = entry }
        if (tY < closestInSightDist) { closestInSightDist = tY; closestInSight = entry }
      }
      enemyTargetRef.current = closestEnemy
      enemyInSightRef.current = closestInSight

      // Facing detection + action URL + mine type update (skipped when dead)
      if(myDead){ facingKeyRef.current=null }
      const previousFacing=facingDataRef.current
      let {cell:fc,mx:fmx,my:fmy,perpDist:fcDist}=myDead?{cell:null,mx:-1,my:-1,perpDist:0}:castRay(p.x,p.y,p.angle,cellMapRef.current,validObstaclesRef.current)
      // Direct distance to chain node center — castRay misses it when the player
      // walks INTO its cell (DDA steps away immediately without checking own cell)
      const cnPos=chainNodePosRef.current
      const cnDist=myDead?Infinity:Math.hypot(p.x/CELL_SIZE-(cnPos.col+.5),p.y/CELL_SIZE-(cnPos.row+.5))
      if(cnDist<=CHAIN_INTERACT_DIST){
        const cnCell=cellMapRef.current?.get(`${cnPos.row},${cnPos.col}`)
        fmx=cnPos.col;fmy=cnPos.row;fc=cnCell;fcDist=cnDist
      }
      const newKey=`${fmy},${fmx}`
      facingDataRef.current={mx:fmx,my:fmy,cell:fc,dist:fcDist}
      const crossedInteractionRange=(previousFacing?.dist<=INTERACT_DIST)!==(fcDist<=INTERACT_DIST)
      // Reset mine progress whenever the player is out of interaction range
      if(fcDist > INTERACT_DIST){ mineProgressRef.current=0; mineTargetRef.current=null }
      // Reset chain progress when stepping out of the tight chain radius
      if(cnDist > CHAIN_INTERACT_DIST && mineTypeRef.current==='chain'){ mineProgressRef.current=0 }
      // Keep chain active every frame while player stays within range
      if(cnDist<=CHAIN_INTERACT_DIST){ actionUrlRef.current=null; mineTypeRef.current='chain' }
      if(newKey!==facingKeyRef.current||crossedInteractionRange){
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
              mineTypeRef.current=fcDist<=CHAIN_INTERACT_DIST?'chain':'empty'
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
      const swinging=!myDead&&swingElapsed<SWING_DUR
      if(swinging) needsRender=true
      if(swinging&&swingElapsed/SWING_DUR>=0.45&&!hitDoneRef.current){
        hitDoneRef.current=true
        const myWallet = myWalletRef.current
        const myIdentity = presenceKeyRef.current || myWallet
        const myIsAnon = myIdentity?.startsWith('anon-')
        const enemy = enemyTargetRef.current

        const inSight = enemyInSightRef.current
        if(inSight?.wallet && !enemy?.wallet && myIdentity && (!myIsAnon || inSight.isAnon) && !inSight.isTeammate && mineTypeRef.current!=='chain'){
          // ── Swing at enemy but out of range → MISS (skipped when hitting chain node) ──
          playPickHit(audioCtxRef,'empty')
          pvpGainRef.current={ text:'✗ MISS', at:performance.now(), color:'#fb7185' }

        } else if(enemy?.wallet && myIdentity && (!myIsAnon || enemy.isAnon) && !enemy.isTeammate){
          // ── PvP hit ──────────────────────────────────────────────────────
          playPickHit(audioCtxRef,'nftji')
          pvpFlashRef.current = performance.now()

          Promise.resolve(onPvpHitRef.current?.({
            attacker:myIdentity,victim:enemy.wallet,victimIsAnon:enemy.isAnon,hitZone:enemy.hitZone,
          }))
            .then(result=>{
              if(!result?.ok) return
              if(result.dodged){
                pvpGainRef.current={ text:'🛡 DODGE', at:performance.now() }
                return
              }
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
          const {mx,my,dist:blockDist}=facingDataRef.current
          const tk=mx>=0&&my>=0?`${my},${mx}`:null
          if(tk!==mineTargetRef.current){mineProgressRef.current=0;mineTargetRef.current=tk}
          if(!tk||mineTypeRef.current==='empty'||(blockDist!=null&&blockDist>INTERACT_DIST)){
            playPickHit(audioCtxRef,'empty')
          } else if(mineTypeRef.current==='chain'){
            mineProgressRef.current=Math.min(1,mineProgressRef.current+1/HITS_NEEDED)
            playPickHit(audioCtxRef,'nftji')
            if(mineProgressRef.current>=1){
              playPickHit(audioCtxRef,'complete')
              mineProgressRef.current=0
              onChainSolveOpenRef.current?.()
            }
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
      // Keep rendering while dead so countdown ticks every frame
      if(myDeadUntilRef.current && myDeadUntilRef.current > Date.now()) needsRender=true
      // Keep rendering while pvp/dodge flash animations are active
      if(pvpFlashRef.current && nowMs-pvpFlashRef.current<280) needsRender=true
      if(dodgeFlashRef.current && nowMs-dodgeFlashRef.current<500) needsRender=true
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
  const triggerJump=useCallback(()=>{
    if(myDeadUntilRef.current&&myDeadUntilRef.current>Date.now()) return
    const player=playerRef.current
    if(player.jumps>=MAX_JUMPS) return
    player.vz=Math.max(0,player.vz)+JUMP_VZ;player.jumps++
    renderRef.current?.()
  },[])
  const triggerAttack=useCallback(()=>{
    if(myDeadUntilRef.current&&myDeadUntilRef.current>Date.now()) return
    if(performance.now()-swingStartRef.current<=SWING_DUR) return
    swingStartRef.current=performance.now();swingEpochRef.current=Date.now();hitDoneRef.current=false
    renderRef.current?.()
  },[])
  return (
    <div ref={containerRef} style={{width:'100%',height:'100%',position:'relative',background:'#020610'}}>
      <canvas ref={webglCanvasRef} aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',display:'block',pointerEvents:'none'}} />
      <canvas ref={canvasRef} tabIndex={0} aria-label={es?'Vista 3D de minería. Haz clic para capturar el ratón.':'3D mining view. Click to capture the mouse.'}
        style={{position:'relative',zIndex:1,display:'block',width:'100%',height:'100%',outline:'none',touchAction:'none'}}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {/* FPS pointer-lock overlay — desktop only, hidden once locked */}
      {!pointerLocked && (
        <div
          onClick={()=>canvasRef.current?.requestPointerLock?.()}
          style={{
            position:'absolute',inset:0,zIndex:10,display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center',
            background:'rgba(2,6,16,0.72)',backdropFilter:'blur(3px)',
            cursor:'crosshair',userSelect:'none',pointerEvents:'auto',
          }}
          className="mm3-desktop-only"
        >
          {(() => {
            const identity = presenceKey || myWallet
            const hp = Math.max(0, Math.min(100, Number((healthMap||{})[identity] ?? 100)))
            const hpColor = hp > 60 ? '#4ade80' : hp > 25 ? '#facc15' : '#fb7185'
            const accent = myColor || '#22d3ee'
            const skills = myNftjis || []
            const shortAddr = identity
              ? (identity.startsWith('anon-') ? identity : `${identity.slice(0,6)}…${identity.slice(-4)}`)
              : null
            return (
              <div style={{
                border:`1px solid ${accent}55`,borderRadius:10,
                padding:'1.2rem 1.6rem 1.1rem',
                textAlign:'center',fontFamily:'Consolas,"Courier New",monospace',
                background:'rgba(2,6,16,.90)',
                boxShadow:`0 0 36px ${accent}22, 0 0 80px rgba(0,0,0,.6)`,
                minWidth:220,
              }}>
                {/* wallet address / identity */}
                {shortAddr && (
                  <div style={{
                    color:accent,fontSize:'.68rem',letterSpacing:'.10em',marginBottom:'.55rem',
                    padding:'2px 8px',borderRadius:4,display:'inline-block',
                    background:`${accent}18`,border:`1px solid ${accent}33`,
                  }}>{shortAddr}</div>
                )}
                {/* HP bar */}
                <div style={{marginBottom:'.75rem'}}>
                  <div style={{
                    display:'flex',justifyContent:'space-between',alignItems:'center',
                    marginBottom:3,
                  }}>
                    <span style={{color:hpColor,fontSize:'.65rem',letterSpacing:'.08em',fontWeight:700}}>
                      {es?'VIDA':'HP'}
                    </span>
                    <span style={{color:hpColor,fontSize:'.65rem',letterSpacing:'.06em'}}>
                      {hp}/100
                    </span>
                  </div>
                  <div style={{
                    width:'100%',height:8,background:'rgba(255,255,255,.08)',
                    borderRadius:4,overflow:'hidden',
                    border:`1px solid ${hpColor}44`,
                  }}>
                    <div style={{
                      width:`${hp}%`,height:'100%',background:hpColor,
                      borderRadius:4,
                      boxShadow:`0 0 6px ${hpColor}`,
                      transition:'width .4s ease',
                    }}/>
                  </div>
                </div>
                {/* skill slots */}
                {skills.length > 0 && (
                  <div style={{
                    display:'flex',gap:5,justifyContent:'center',marginBottom:'.8rem',
                    flexWrap:'wrap',
                  }}>
                    {skills.map((sk,i) => {
                      const abilityLabel = sk.emoji==='❤️' ? 'SPEED +10%'
                        : (sk.emoji==='⚔️'||sk.blockKey==='sq-atk') ? 'CRIT +5%'
                        : (sk.emoji==='🔰'||sk.blockKey==='sq-def') ? 'DODGE 10%'
                        : sk.source==='mining' ? 'LONG +10%'
                        : null
                      const slotAccent = sk.emoji==='❤️' ? '#fb7185'
                        : (sk.emoji==='⚔️'||sk.blockKey==='sq-atk') ? '#facc15'
                        : (sk.emoji==='🔰'||sk.blockKey==='sq-def') ? '#22d3ee'
                        : sk.source==='mining' ? '#4ade80'
                        : '#fb923c'
                      return (
                        <div key={i} style={{
                          width:44,height:58,borderRadius:5,
                          background:abilityLabel?'#100b18':'#080e18',
                          border:`1px solid ${abilityLabel?slotAccent+'cc':'#fb923c33'}`,
                          display:'flex',flexDirection:'column',alignItems:'center',
                          justifyContent:'center',gap:2,position:'relative',overflow:'hidden',
                          boxShadow:abilityLabel?`0 0 8px ${slotAccent}55`:'none',
                        }}>
                          {abilityLabel && (
                            <div style={{
                              position:'absolute',top:0,left:0,right:0,
                              background:slotAccent,padding:'2px 1px',
                              display:'flex',alignItems:'center',justifyContent:'center',
                            }}>
                              <span style={{
                                fontSize:'0.44rem',fontWeight:700,color:'#02060b',
                                letterSpacing:'.03em',lineHeight:1,whiteSpace:'nowrap',
                              }}>{abilityLabel}</span>
                            </div>
                          )}
                          <span style={{fontSize:'1.1rem',lineHeight:1,marginTop:abilityLabel?6:0}}>{sk.emoji||'⬡'}</span>
                          <span style={{
                            fontSize:'0.55rem',color:abilityLabel?slotAccent:'#fb923c99',
                            fontWeight:700,letterSpacing:'.04em',
                          }}>Lv{sk.level}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* CTA */}
                <div style={{
                  color:accent,fontSize:'.95rem',letterSpacing:'.14em',
                  textTransform:'uppercase',marginBottom:'.3rem',fontWeight:700,
                  textShadow:`0 0 12px ${accent}`,
                }}>
                  {es?'Haz clic para jugar':'Click to play'}
                </div>
                <div style={{color:`${accent}66`,fontSize:'.68rem',letterSpacing:'.06em'}}>
                  {es?'WASD · ratón · ESC para salir':'WASD · mouse · ESC to release'}
                </div>
              </div>
            )
          })()}
        </div>
      )}
      {/* ── Mobile joystick ────────────────────────────────────────────────── */}
      <div ref={joystickPadRef} className="mm3-touch-controls" style={{
        position:'absolute', zIndex:5,
        bottom:'calc(28px + env(safe-area-inset-bottom, 0px))', left:18,
        width:130, height:130, borderRadius:'50%',
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'radial-gradient(circle at 40% 38%, rgba(34,211,238,.22) 0%, rgba(2,8,20,.80) 72%)',
        border:'1.5px solid rgba(103,232,249,.40)',
        boxShadow:'0 0 28px rgba(34,211,238,.10), 0 4px 24px rgba(0,0,0,.55), inset 0 1px 0 rgba(165,243,252,.12)',
        pointerEvents:'auto', userSelect:'none', touchAction:'none', WebkitTapHighlightColor:'transparent',
      }}
        onPointerDown={(e)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);joystickRef.current.pointerId=e.pointerId;updateJoystick(e.clientX,e.clientY)}}
        onPointerMove={(e)=>{if(joystickRef.current.pointerId===e.pointerId)updateJoystick(e.clientX,e.clientY)}}
        onPointerUp={stopJoystick} onPointerCancel={stopJoystick}
      >
        {/* Tick marks */}
        {[0,90,180,270].map(deg=>(
          <div key={deg} style={{
            position:'absolute', width:1, height:8,
            background:'rgba(103,232,249,.28)',
            transformOrigin:'50% 59px',
            transform:`rotate(${deg}deg)`,
            pointerEvents:'none',
          }}/>
        ))}
        <div ref={joystickKnobRef} style={{
          width:50, height:50, borderRadius:'50%',
          background:'radial-gradient(circle at 38% 36%, rgba(103,232,249,.55), rgba(34,211,238,.22))',
          border:'1.5px solid rgba(165,243,252,.80)',
          boxShadow:'0 0 16px rgba(34,211,238,.40), inset 0 1px 0 rgba(255,255,255,.18)',
          pointerEvents:'none', willChange:'transform',
        }}/>
        <span style={{
          position:'absolute', bottom:8, left:0, right:0, textAlign:'center',
          color:'rgba(103,232,249,.50)', font:'700 7px monospace', letterSpacing:'0.14em',
          pointerEvents:'none',
        }}>{es?'MOVER':'MOVE'}</span>
      </div>

      {/* ── JUMP + HIT buttons — single right-side stack, no overlap ───────── */}
      <div className="mm3-touch-controls" style={{
        position:'absolute', zIndex:5,
        bottom:'calc(24px + env(safe-area-inset-bottom, 0px))', right:16,
        display:'flex', flexDirection:'column', alignItems:'center', gap:12,
        pointerEvents:'auto',
      }}>
        {/* JUMP */}
        <button
          aria-label={es?'Saltar':'Jump'}
          onPointerDown={(e)=>{e.preventDefault();e.stopPropagation();triggerJump()}}
          onPointerUp={(e)=>e.preventDefault()}
          style={{
            width:74, height:74, borderRadius:'50%',
            background:'radial-gradient(circle at 40% 36%, rgba(56,189,248,.50), rgba(2,18,40,.88))',
            border:'1.5px solid rgba(103,232,249,.60)',
            boxShadow:'0 0 20px rgba(34,211,238,.22), 0 4px 16px rgba(0,0,0,.50), inset 0 1px 0 rgba(165,243,252,.18)',
            color:'#cffafe', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
            userSelect:'none', fontFamily:'monospace', touchAction:'none', WebkitTapHighlightColor:'transparent',
          }}
        >
          <span style={{fontSize:24, lineHeight:1, marginTop:2}}>▲</span>
          <span style={{fontSize:8, fontWeight:700, letterSpacing:'0.12em', opacity:.80}}>{es?'SALTAR':'JUMP'}</span>
        </button>
        {/* HIT */}
        <button
          aria-label={es?'Atacar o minar':'Attack or mine'}
          onPointerDown={(e)=>{e.preventDefault();e.stopPropagation();triggerAttack()}}
          onPointerUp={(e)=>e.preventDefault()}
          style={{
            width:74, height:74, borderRadius:'50%',
            background:'radial-gradient(circle at 40% 36%, rgba(249,115,22,.50), rgba(36,8,2,.88))',
            border:'1.5px solid rgba(251,146,60,.58)',
            boxShadow:'0 0 20px rgba(249,115,22,.20), 0 4px 16px rgba(0,0,0,.50), inset 0 1px 0 rgba(254,215,170,.14)',
            color:'#fed7aa', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
            userSelect:'none', fontFamily:'monospace', touchAction:'none', WebkitTapHighlightColor:'transparent',
          }}
        >
          <span style={{fontSize:24, lineHeight:1, fontWeight:700, marginTop:2}}>✕</span>
          <span style={{fontSize:8, fontWeight:700, letterSpacing:'0.12em', opacity:.80}}>{es?'GOLPE':'HIT'}</span>
        </button>
      </div>
    </div>
  )
}
