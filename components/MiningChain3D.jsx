'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'
import { useCurrency } from '@/lib/currency-context'
import { useActiveWallet } from '@/lib/use-active-wallet'
import { colorFromAddress } from '@/lib/wallet-colors'
import { getDiceState } from '@/lib/dice'
import {
  gridToBlockHex, blockHexToGrid,
  MM3_BLOCK_REQUIREMENT_BY_HEX,
  MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS,
} from '@/lib/mm3-block-chain'
import { computeRelayLevel } from '@/lib/wallet-decorations'
import { CIPHER_HOUSE_BOUNDS, CIPHER_HOUSE_MINING_EXCLUSION, CIPHER_HOUSE_MINING_LEVELS, HOUSE_POOL_HEAL_ZONE, HOUSE_POOL_FLOOR_LEVEL, HOUSE_POOL_SWIM_MAX_Z, MINING_CHAIN_NODE_POSITION, NODE_DICE_POSITION } from '@/lib/mining-world-layout'
import {
  MINING_MARKET_LANDMARK_POSITIONS,
  MINING_VISUAL_BLOCK_POSITIONS,
  placeMiningVisualBlock,
  relocateMiningBlockPosition,
} from '@/lib/mining-visual-layout'
import { MINING_CORE_MAP_ID } from '@/lib/mining-maps'
import { RL_NODE_MIN_LEVEL, RL_NODE_PRICE_MM3 } from '@/lib/mining-rl-mount'
import supabase from '@/lib/supabaseClient'

const MiningChain3DFPV = dynamic(() => import('./MiningChain3DFPV'), { ssr: false })
const ChainSolveCard = dynamic(() => import('./ChainSolveCard'), { ssr: false })
const NftjiPenaltyCard = dynamic(() => import('./NftjiPenaltyCard'), { ssr: false })

const C = '#22d3ee'
const NETWORK_VISUAL_RANGE = 22
const CHAIN3D_CHANNEL = 'mm3-chain3d-v1'

const CIPHER_HOUSE_MINING_KEYS = new Set(Object.keys(CIPHER_HOUSE_MINING_LEVELS))
const MINING_STAIR_EXCLUSION = new Set(CIPHER_HOUSE_MINING_EXCLUSION)

function isInCipherHouseClearance(row, col) {
  return row >= CIPHER_HOUSE_BOUNDS.minRow - 2 && row <= CIPHER_HOUSE_BOUNDS.maxRow + 2
    && col >= CIPHER_HOUSE_BOUNDS.minCol - 2 && col <= CIPHER_HOUSE_BOUNDS.maxCol + 2
}

function canPlaceMiningBlockAt(row, col) {
  const key = `${row},${col}`
  if (MINING_STAIR_EXCLUSION.has(key)) return false
  if (CIPHER_HOUSE_MINING_KEYS.has(key)) return true
  return !isInCipherHouseClearance(row, col)
}

function isRelocatableMineCell(cell) {
  if (!cell) return false
  if (cell.isChainNode || cell.isPortalNode || cell.isNodeDiceNode) return false
  return Boolean(cell.blockHex)
}

function relocateStairOverlappingBlocks(map) {
  const pending = []
  for (const [key, cell] of map) {
    if (!MINING_STAIR_EXCLUSION.has(key) || !isRelocatableMineCell(cell)) continue
    pending.push({ key, cell })
  }
  for (const { key, cell } of pending) {
    map.delete(key)
    const newPos = relocateMiningBlockPosition(cell.blockHex, new Set(map.keys()))
    if (!newPos) continue
    const nextKey = `${newPos.row},${newPos.col}`
    if (map.has(nextKey)) continue
    const { baseHeight, ...rest } = cell
    map.set(nextKey, rest)
  }
}
const NODE_DICE_PRICE_MM3 = 500
const NODE_DICE_MIN_LEVEL = 30
const NODE_DICE_STORAGE_KEY = 'mm3_stormroll_node'
const NODE_DICE_DURATION_MS = 24 * 60 * 60 * 1000
function isInHousePoolSafeZone(gx, gy, gz) {
  if (!(gx > HOUSE_POOL_HEAL_ZONE.minX && gx < HOUSE_POOL_HEAL_ZONE.maxX &&
    gy > HOUSE_POOL_HEAL_ZONE.minZ && gy < HOUSE_POOL_HEAL_ZONE.maxZ)) return false
  return gz >= HOUSE_POOL_FLOOR_LEVEL - 0.28 && gz <= HOUSE_POOL_SWIM_MAX_Z
}

function normalizeNodeDiceState(value) {
  const now = Date.now()
  const expiresAt = Number(value?.expiresAt) || 0
  if (!expiresAt || expiresAt <= now) return null
  const wallet = String(value?.wallet || '').toLowerCase()
  if (!wallet) return null
  return {
    wallet,
    startedAt: Number(value?.startedAt) || now,
    expiresAt,
    mode: value?.mode === 'war' ? 'war' : 'meteo',
    hourStart: Number(value?.hourStart) || 0,
    warPercent: Number(value?.warPercent) || 0,
    naturePercent: Number(value?.naturePercent) || 0,
  }
}

// Trade/wallet NFTJIs — matches TRADE_SLOT_ORDER in wallet-decorations.js
const TRADE_NFTJI_DEFS = [
  { key: 'lucky50',   emoji: '🔮', field: 'lucky_50_level'   },
  { key: 'lucky100',  emoji: '🍀', field: 'lucky_100_level'  },
  { key: 'lucky500',  emoji: '🎰', field: 'lucky_500_level'  },
  { key: 'lucky1000', emoji: '🧿', field: 'lucky_1000_level' },
  { key: 'revive',    emoji: '❤️', field: null                },
]
const CHAIN_NODE_ROW = MINING_CHAIN_NODE_POSITION.row
const CHAIN_NODE_COL = MINING_CHAIN_NODE_POSITION.col

const ANON_KEY_STORAGE = 'mm3_anon_key'

// Hash an IP string into a stable anon-XXXXXX key (same algorithm as relaying)
function hashIpToAnonKey(ip) {
  let h = 0x811c9dc5
  for (let i = 0; i < ip.length; i++) h = Math.imul(h ^ ip.charCodeAt(i), 0x01000193) >>> 0
  return `anon-${h.toString(36).slice(0, 6).padStart(6, '0')}`
}

// Return a stable anon key: localStorage → fresh random (saved for next time)
function getOrCreateAnonKey() {
  try {
    const saved = localStorage.getItem(ANON_KEY_STORAGE)
    if (saved?.startsWith('anon-')) return saved
  } catch { /* */ }
  const fresh = `anon-${Math.random().toString(36).slice(2, 8)}`
  try { localStorage.setItem(ANON_KEY_STORAGE, fresh) } catch { /* */ }
  return fresh
}

// Portal nodes are spread across all four quarters of the 56x56 world.
const PORTAL_NODES = [
  { row:5,  col:5,  emoji:'🎮', titleEn:'TRAINING',    titleEs:'ENTRENAMIENTO', navUrl:'/training', color:'#4ade80' },
  { row:5,  col:50, emoji:'💹', titleEn:'TRADING',     titleEs:'TRADING',    navUrl:'/trading',     color:'#fb923c' },
  { row:18, col:14, emoji:'📈', titleEn:'MM3 CHART',   titleEs:'GRÁFICO MM3', navUrl:'/mm3-value',  color:'#a78bfa' },
  { row:18, col:42, emoji:'🏆', titleEn:'RANKING',     titleEs:'RANKING',    navUrl:'/ranking',     color:'#ffd700' },
  { row:32, col:50, emoji:'💥', titleEn:'SQUEEZING',   titleEs:'SQUEEZING',  navUrl:'/squeezing',   color:'#fb7185' },
  { row:50, col:50, emoji:'🔗', titleEn:'RELAYING',    titleEs:'RELAYING',   navUrl:'/relaying',    color:'#60a5fa' },
  { row:50, col:5,  emoji:'🤖', titleEn:'AI TEAM',     titleEs:'EQUIPO IA',  navUrl:'/ai-team',     color:'#bef264' },
  { row:32, col:5,  emoji:'📜', titleEn:'MANIFESTO',   titleEs:'MANIFIESTO', navUrl:'/manifesto',   color:'#f472b6' },
  { row:50, col:28, emoji:'✅', titleEn:'DAILY TASKS', titleEs:'TAREAS',     navUrl:'/daily-tasks', color:'#2dd4bf' },
]

function placeDistributedBlock(blockHex) {
  return placeMiningVisualBlock(blockHex)
}

const MARKET_LANDMARK_POSITIONS = MINING_MARKET_LANDMARK_POSITIONS
const VISUAL_BLOCK_POSITIONS = MINING_VISUAL_BLOCK_POSITIONS

function getRandomLoggedSpawn() {
  return {
    row: 2 + Math.floor(Math.random() * (MM3_BLOCK_GRID_ROWS - 4)),
    col: 2 + Math.floor(Math.random() * (MM3_BLOCK_GRID_COLS - 4)),
  }
}

const ANONYMOUS_ARENA_SPAWNS = [
  { row: MINING_CHAIN_NODE_POSITION.row,     col: MINING_CHAIN_NODE_POSITION.col - 3 },
  { row: MINING_CHAIN_NODE_POSITION.row,     col: MINING_CHAIN_NODE_POSITION.col + 3 },
  { row: MINING_CHAIN_NODE_POSITION.row - 3, col: MINING_CHAIN_NODE_POSITION.col },
  { row: MINING_CHAIN_NODE_POSITION.row + 3, col: MINING_CHAIN_NODE_POSITION.col },
]

function getAnonymousArenaSpawn() {
  return ANONYMOUS_ARENA_SPAWNS[Math.floor(Math.random()*ANONYMOUS_ARENA_SPAWNS.length)]
}

function getSpawnForWallet(wallet) {
  return wallet ? getRandomLoggedSpawn() : getAnonymousArenaSpawn()
}

export default function MiningChain3D() {
  const { language } = useI18n()
  const { currency } = useCurrency()
  const es = language === 'es'
  const { account } = useActiveWallet()
  const router = useRouter()

  // myWallet MUST be declared before any hook that references it
  const myWallet = account?.toLowerCase() || null
  const myColor  = myWallet ? colorFromAddress(myWallet) : '#888888'

  // Initial spawn is always random — useEffect restores persisted position client-side
  // (useMemo runs on server during SSR where localStorage doesn't exist)
  const initialPos = useMemo(() => getSpawnForWallet(myWallet), [])

  // Refs: avoid stale closures in channel callbacks and game loop
  const channelRef     = useRef(null)
  const loadChainStatusRef = useRef(null)
  const myWalletRef    = useRef(myWallet)
  const myPosRef       = useRef(initialPos)
  const myKeyRef       = useRef(null)     // presence key (wallet or 'anon-XXXX')
  const mapIdRef       = useRef(MINING_CORE_MAP_ID)
  const lastDbPosSaveRef = useRef(0)      // throttle DB position saves
  // Tracks last node-dice state we broadcast — null means "no dice"; only send when changed
  const lastBroadcastNodeDiceRef = useRef(null)

  // Keep refs current each render
  myWalletRef.current = myWallet

  const [cellMap,       setCellMap]       = useState(new Map())
  const reloadCellMapRef = useRef(null)
  const [myPos,         setMyPos]         = useState(initialPos)
  const [mapId,         setMapId]         = useState(MINING_CORE_MAP_ID)
  mapIdRef.current = mapId
  const [jumpToCell,    setJumpToCell]    = useState(null)
  const [pvpStolen,     setPvpStolen]     = useState({})
  const [demineRewards, setDemineRewards] = useState({})
  const [showChainSolve, setShowChainSolve] = useState(false)
  const [nftjiPanel,    setNftjiPanel]    = useState(null) // null | { blockKey, blockHex, emoji, titleEn, titleEs, priceEur, owner }
  // positions: wallet → { gx, gy, row, col } — populated from presence payload, broadcast, and DB
  const [positions,     setPositions]     = useState({})
  // onlineWallets: who is currently in the channel (from presence sync)
  const [onlineWallets, setOnlineWallets] = useState(new Set())
  const [loading,       setLoading]       = useState(true)
  const [fpvReady,      setFpvReady]      = useState(false)
  const [worldBootstrapped, setWorldBootstrapped] = useState(false)
  const [channelReady,  setChannelReady]  = useState(false)
  const [profileReady,  setProfileReady]  = useState(false)
  const [healthReady,   setHealthReady]   = useState(false)
  const playReady = worldBootstrapped && channelReady && profileReady && healthReady
  const handleWorldBootstrapped = useCallback(() => setWorldBootstrapped(true), [])
  const [onlineCount,   setOnlineCount]   = useState(0)
  const [anonKillMsg,   setAnonKillMsg]   = useState(null)
  const [walletNftjis,  setWalletNftjis]  = useState({})
  const [playerLevel,   setPlayerLevel]   = useState(0)
  const [playerNftjiCount, setPlayerNftjiCount] = useState(0)
  const [myNftjis,      setMyNftjis]      = useState([])  // [{ emoji, level, blockKey, isActive }]
  const marketRef = useRef([])
  const [marketLoaded, setMarketLoaded] = useState(false)
  const [facingCell,    setFacingCell]    = useState(null)
  const [receivedHitAt, setReceivedHitAt] = useState(0)
  const [receivedHitFrom, setReceivedHitFrom] = useState(null)
  const [receivedDodgeAt, setReceivedDodgeAt] = useState(0)
  const [externalPush, setExternalPush] = useState(null)
  const [swingMap,      setSwingMap]      = useState({})
  const [myPoolCode,    setMyPoolCode]    = useState(null)
  const [presenceKey,   setPresenceKey]   = useState(myWallet)
  const [healthMap,     setHealthMap]     = useState({})
  const healthRequestedRef = useRef(new Set())
  const healthMapRef       = useRef({})
  const lastPoolHealAtRef  = useRef(0)
  // Death / respawn state — ms timestamp (null = alive)
  const [myDeadUntil,   setMyDeadUntil]   = useState(null)
  const [myDeadPos,     setMyDeadPos]     = useState(null)
  const myDeadUntilRef = useRef(null)
  const myDeadPosRef   = useRef(null)
  const respawnTimerRef = useRef(null)
  const [chainDemineActive, setChainDemineActive] = useState(false)
  const [chainDemineHitsRemaining, setChainDemineHitsRemaining] = useState(100)
  const [chainSolvers, setChainSolvers] = useState([])
  const [nodeDiceState, setNodeDiceState] = useState(null)
  const [nodeDicePanelOpen, setNodeDicePanelOpen] = useState(false)
  const [nodeDiceWalletStats, setNodeDiceWalletStats] = useState({ mm3: 0, level: 0 })
  const [nodeDiceError, setNodeDiceError] = useState('')
  const [rlMountActive, setRlMountActive] = useState(false)
  const [rlMountPanelOpen, setRlMountPanelOpen] = useState(false)
  const [rlMountWalletStats, setRlMountWalletStats] = useState({ mm3: 0, level: 0 })
  const [rlMountError, setRlMountError] = useState('')
  const demineRewardIdsRef = useRef(new Set())
  const nodeDiceRef = useRef(null)
  const rlMountActiveRef = useRef(false)

  const applyDemineReward = useCallback(({ wallet, mm3Awarded, eventId }) => {
    const normalizedWallet = String(wallet || '').trim().toLowerCase()
    const amount = Number(mm3Awarded) || 0
    if (!normalizedWallet || amount <= 0) return
    if (eventId) {
      if (demineRewardIdsRef.current.size >= 300) demineRewardIdsRef.current.clear()
      if (demineRewardIdsRef.current.has(eventId)) return
      demineRewardIdsRef.current.add(eventId)
    }
    setDemineRewards(prev => ({
      ...prev,
      [normalizedWallet]: (Number(prev[normalizedWallet]) || 0) + amount,
    }))
  }, [])

  const refreshNodeDiceMode = useCallback(async (state = nodeDiceRef.current, broadcast = true) => {
    const active = normalizeNodeDiceState(state)
    if (!active) {
      nodeDiceRef.current = null
      setNodeDiceState(null)
      try { localStorage.removeItem(NODE_DICE_STORAGE_KEY) } catch {}
      // Only broadcast null once (when transitioning from active → null, not every interval tick)
      if (broadcast && lastBroadcastNodeDiceRef.current !== null) {
        lastBroadcastNodeDiceRef.current = null
        channelRef.current?.send({ type: 'broadcast', event: 'node-dice', payload: null })?.catch(() => {})
        window.dispatchEvent(new CustomEvent('mm3-stormroll-changed'))
      }
      return null
    }
    const dice = getDiceState()
    if (!dice.active) {
      nodeDiceRef.current = active
      setNodeDiceState(active)
      return active
    }
    if (Number(active.hourStart) === Number(dice.hourStart)) {
      nodeDiceRef.current = active
      setNodeDiceState(active)
      return active
    }
    let macro = { war_percent: active.warPercent || 0, nature_percent: active.naturePercent || 0 }
    try {
      const { data } = await supabase.from('mm3_macro_state').select('war_percent,nature_percent').eq('id', 1).maybeSingle()
      if (data) macro = data
    } catch {}
    const seed = `${active.wallet}:${dice.hourStart}`
    let hash = 0
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
    const next = {
      ...active,
      mode: Math.abs(hash) % 2 === 0 ? 'meteo' : 'war',
      hourStart: dice.hourStart,
      warPercent: Number(macro.war_percent) || 0,
      naturePercent: Number(macro.nature_percent) || 0,
    }
    nodeDiceRef.current = next
    setNodeDiceState(next)
    try { localStorage.setItem(NODE_DICE_STORAGE_KEY, JSON.stringify(next)) } catch {}
    if (broadcast) {
      // Only broadcast when hourStart, mode or wallet actually changed
      const prev = lastBroadcastNodeDiceRef.current
      if (!prev || prev.hourStart !== next.hourStart || prev.mode !== next.mode || prev.wallet !== next.wallet) {
        lastBroadcastNodeDiceRef.current = next
        channelRef.current?.send({ type: 'broadcast', event: 'node-dice', payload: next })?.catch(() => {})
      }
    }
    return next
  }, [])

  const syncNodeDiceFromServer = useCallback(async (broadcast = true) => {
    const response = await fetch('/api/node-dice', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
    const active = normalizeNodeDiceState(response?.nodeDice)
    if (!active) return null
    nodeDiceRef.current = active
    setNodeDiceState(active)
    try { localStorage.setItem(NODE_DICE_STORAGE_KEY, JSON.stringify(active)) } catch {}
    if (broadcast) {
      lastBroadcastNodeDiceRef.current = active
      channelRef.current?.send({ type: 'broadcast', event: 'node-dice', payload: active })?.catch(() => {})
    }
    return active
  }, [])

  // Preload the 3D engine in parallel with the map snapshot — same visual result, faster TTI.
  useEffect(() => {
    let mounted = true
    import('./MiningChain3DFPV').then(() => {
      if (mounted) setFpvReady(true)
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let restored = null
    try { restored = normalizeNodeDiceState(JSON.parse(localStorage.getItem(NODE_DICE_STORAGE_KEY) || 'null')) } catch {}
    if (restored) {
      nodeDiceRef.current = restored
      setNodeDiceState(restored)
      refreshNodeDiceMode(restored, false)
    }
    // Defer server dice sync until after first paint — not needed for initial world render.
    let id
    let serverId
    const bootId = requestAnimationFrame(() => {
      syncNodeDiceFromServer(false).catch(() => {})
      id = setInterval(() => refreshNodeDiceMode(nodeDiceRef.current, true), 1000)
      serverId = setInterval(() => syncNodeDiceFromServer(false).catch(() => {}), 60_000)
    })
    return () => {
      cancelAnimationFrame(bootId)
      if (id) clearInterval(id)
      if (serverId) clearInterval(serverId)
    }
  }, [refreshNodeDiceMode, syncNodeDiceFromServer])

  useEffect(() => {
    nodeDiceRef.current = normalizeNodeDiceState(nodeDiceState)
  }, [nodeDiceState])

  useEffect(() => { healthMapRef.current = healthMap }, [healthMap])
  useEffect(() => { myDeadPosRef.current = myDeadPos }, [myDeadPos])
  useEffect(() => { myDeadUntilRef.current = myDeadUntil }, [myDeadUntil])

  useEffect(() => {
    const id = setInterval(() => {
      const key = myKeyRef.current
      if (!key) return
      if (myDeadUntilRef.current && myDeadUntilRef.current > Date.now()) return
      const pos = myPosRef.current || {}
      const gx = Number.isFinite(Number(pos.gx)) ? Number(pos.gx) : Number(pos.col) + .5
      const gy = Number.isFinite(Number(pos.gy)) ? Number(pos.gy) : Number(pos.row) + .5
      if (!isInHousePoolSafeZone(gx, gy)) return
      const now = Date.now()
      if (now - lastPoolHealAtRef.current < 5 * 60 * 1000) return
      lastPoolHealAtRef.current = now
      if (key.startsWith('anon-')) {
        const next = Math.min(100, Number(healthMapRef.current[key] ?? 100) + 10)
        setHealthMap(prev => ({ ...prev, [key]: next }))
        channelRef.current?.send({ type: 'broadcast', event: 'pvp-result', payload: { victim: key, health: next, killed: false, healed: true } })?.catch(() => {})
        return
      }
      fetch('/api/pool-heal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: key }),
      }).then(r => r.json()).then(result => {
        if (!result?.ok) return
        const next = Number(result.health ?? 100)
        setHealthMap(prev => ({ ...prev, [key]: next }))
        channelRef.current?.send({ type: 'broadcast', event: 'pvp-result', payload: { victim: key, health: next, killed: false, healed: true } })?.catch(() => {})
      }).catch(() => {})
    }, 10_000)
    return () => clearInterval(id)
  }, [])

  const loadNodeDiceWalletStats = useCallback(async () => {
    const wallet = myWalletRef.current
    if (!wallet) {
      setNodeDiceWalletStats({ mm3: 0, level: 0 })
      return { mm3: 0, level: 0 }
    }
    const [{ data: progress }, { data: balance }] = await Promise.all([
      supabase.from('player_progress').select('level,mm3_sold').eq('wallet', wallet).maybeSingle(),
      supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
    ])
    const stats = {
      level: Number(progress?.level) || 0,
      mm3: (Number(balance?.total_eth) || 0) - (Number(progress?.mm3_sold) || 0),
    }
    setNodeDiceWalletStats(stats)
    return stats
  }, [])

  const handleNodeDicePanelOpen = useCallback(() => {
    setNodeDiceError('')
    setNodeDicePanelOpen(true)
    loadNodeDiceWalletStats().catch(() => {})
  }, [loadNodeDiceWalletStats])

  const loadRlMountWalletStats = useCallback(async () => {
    const wallet = myWalletRef.current
    if (!wallet) {
      setRlMountWalletStats({ mm3: 0, level: 0 })
      return { mm3: 0, level: 0 }
    }
    const [{ data: progress }, { data: balance }] = await Promise.all([
      supabase.from('player_progress').select('level,mm3_sold,rl_mount_active').eq('wallet', wallet).maybeSingle(),
      supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
    ])
    const stats = {
      level: Number(progress?.level) || 0,
      mm3: (Number(balance?.total_eth) || 0) - (Number(progress?.mm3_sold) || 0),
      active: Boolean(progress?.rl_mount_active),
    }
    setRlMountWalletStats(stats)
    return stats
  }, [])

  const handleRlMountPanelOpen = useCallback(() => {
    setRlMountError('')
    setRlMountPanelOpen(true)
    loadRlMountWalletStats().catch(() => {})
  }, [loadRlMountWalletStats])

  const clearRlMountOnDeath = useCallback(() => {
    if (!rlMountActiveRef.current) return
    rlMountActiveRef.current = false
    setRlMountActive(false)
    const wallet = myWalletRef.current
    if (wallet) {
      fetch('/api/rl-mount', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet }),
      }).catch(() => {})
    }
    const pos = myPosRef.current || {}
    channelRef.current?.track({
      wallet: myKeyRef.current,
      gx: (pos.col ?? 0) + 0.5,
      gy: (pos.row ?? 0) + 0.5,
      row: pos.row ?? 0,
      col: pos.col ?? 0,
      z: Number(pos.z) || 0,
      mapId: mapIdRef.current,
      rlMount: false,
    }).catch?.(() => {})
    channelRef.current?.send({
      type: 'broadcast', event: 'move',
      payload: {
        wallet: myKeyRef.current,
        gx: (pos.col ?? 0) + 0.5,
        gy: (pos.row ?? 0) + 0.5,
        row: pos.row ?? 0,
        col: pos.col ?? 0,
        z: Number(pos.z) || 0,
        mapId: mapIdRef.current,
        rlMount: false,
      },
    })?.catch(() => {})
  }, [])

  const handlePurchaseRlMount = useCallback(async () => {
    const wallet = myWalletRef.current
    if (!wallet) {
      setRlMountError(es ? 'Conecta wallet para comprar.' : 'Connect wallet to purchase.')
      return
    }
    if (rlMountActiveRef.current) {
      setRlMountError(es ? 'Ya tienes un coche activo.' : 'You already have an active car.')
      return
    }
    const stats = await loadRlMountWalletStats()
    if (stats.level < RL_NODE_MIN_LEVEL) {
      setRlMountError(es ? `Nivel mínimo ${RL_NODE_MIN_LEVEL}.` : `Minimum level ${RL_NODE_MIN_LEVEL}.`)
      return
    }
    if (stats.mm3 < RL_NODE_PRICE_MM3) {
      setRlMountError(es ? 'MM3 insuficiente.' : 'Not enough MM3.')
      return
    }
    const response = await fetch('/api/rl-mount', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet }),
    }).then(r => r.json()).catch(() => null)
    if (!response?.ok) {
      setRlMountError(
        response?.error === 'min_level'
          ? (es ? `Nivel mínimo ${RL_NODE_MIN_LEVEL}.` : `Minimum level ${RL_NODE_MIN_LEVEL}.`)
          : response?.error === 'not_enough_mm3'
            ? (es ? 'MM3 insuficiente.' : 'Not enough MM3.')
            : response?.error === 'already_owned'
              ? (es ? 'Ya tienes un coche activo.' : 'You already have an active car.')
              : (es ? 'No se pudo comprar el coche.' : 'Could not purchase the car.')
      )
      return
    }
    rlMountActiveRef.current = true
    setRlMountActive(true)
    setRlMountPanelOpen(false)
    setRlMountError('')
    window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet } }))
    const pos = myPosRef.current || {}
    channelRef.current?.track({
      wallet: myKeyRef.current,
      gx: (pos.col ?? 0) + 0.5,
      gy: (pos.row ?? 0) + 0.5,
      row: pos.row ?? 0,
      col: pos.col ?? 0,
      z: Number(pos.z) || 0,
      mapId: mapIdRef.current,
      poolCode: myPoolCode || null,
      nodeDice: normalizeNodeDiceState(nodeDiceRef.current),
      rlMount: true,
    }).catch?.(() => {})
    channelRef.current?.send({
      type: 'broadcast', event: 'move',
      payload: {
        wallet: myKeyRef.current,
        gx: (pos.col ?? 0) + 0.5,
        gy: (pos.row ?? 0) + 0.5,
        row: pos.row ?? 0,
        col: pos.col ?? 0,
        z: Number(pos.z) || 0,
        mapId: mapIdRef.current,
        poolCode: myPoolCode || null,
        rlMount: true,
      },
    })?.catch(() => {})
  }, [es, loadRlMountWalletStats, myPoolCode])

  const handleActivateNodeDice = useCallback(async () => {
    const wallet = myWalletRef.current
    if (!wallet) {
      setNodeDiceError(es ? 'Conecta wallet para activar.' : 'Connect wallet to activate.')
      return
    }
    const current = normalizeNodeDiceState(nodeDiceRef.current)
    if (current) {
      setNodeDiceError(es ? 'Dice Node ya está activo.' : 'Dice Node is already active.')
      return
    }
    const stats = await loadNodeDiceWalletStats()
    if (stats.level < NODE_DICE_MIN_LEVEL) {
      setNodeDiceError(es ? `Nivel mínimo ${NODE_DICE_MIN_LEVEL}.` : `Minimum level ${NODE_DICE_MIN_LEVEL}.`)
      return
    }
    if (stats.mm3 < NODE_DICE_PRICE_MM3) {
      setNodeDiceError(es ? 'MM3 insuficiente.' : 'Not enough MM3.')
      return
    }
    const response = await fetch('/api/node-dice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet }),
    }).then(r => r.json()).catch(() => null)
    if (!response?.ok) {
      setNodeDiceError(
        response?.error === 'min_level'
          ? (es ? `Nivel mínimo ${NODE_DICE_MIN_LEVEL}.` : `Minimum level ${NODE_DICE_MIN_LEVEL}.`)
          : response?.error === 'not_enough_mm3'
            ? (es ? 'MM3 insuficiente.' : 'Not enough MM3.')
            : (es ? 'No se pudo activar Dice Node.' : 'Could not activate Dice Node.')
      )
      return
    }
    const next = normalizeNodeDiceState(response.nodeDice)
    if (!next) {
      setNodeDiceError(es ? 'Dice Node no devolvió estado activo.' : 'Dice Node did not return active state.')
      return
    }
    nodeDiceRef.current = next
    setNodeDiceState(next)
    setNodeDicePanelOpen(false)
    setNodeDiceError('')
    try { localStorage.setItem(NODE_DICE_STORAGE_KEY, JSON.stringify(next)) } catch {}
    lastBroadcastNodeDiceRef.current = next
    channelRef.current?.send({ type: 'broadcast', event: 'node-dice', payload: next })?.catch(() => {})
    window.dispatchEvent(new CustomEvent('mm3-stormroll-changed'))
    refreshNodeDiceMode(next, true)
  }, [es, loadNodeDiceWalletStats, refreshNodeDiceMode])

  const loadRemoteHealth = useCallback((wallet) => {
    const key = String(wallet || '').toLowerCase()
    if (!key || key.startsWith('anon-') || healthRequestedRef.current.has(key)) return
    healthRequestedRef.current.add(key)
    fetch(`/api/pvp-hit?wallet=${encodeURIComponent(key)}`)
      .then(r => r.json())
      .then(r => {
        if (r?.ok) setHealthMap(prev => ({ ...prev, [key]: Number(r.health ?? 100) }))
      })
      .catch(() => { healthRequestedRef.current.delete(key) })
  }, [])

  // ── Death / respawn helpers ─────────────────────────────────────────────────
  const triggerRespawn = useCallback(() => {
    const deadPos = myDeadPosRef.current
    const deathMapId = deadPos?.mapId || mapIdRef.current
    let row, col
    if (deadPos?.gx != null && deadPos?.gy != null) {
      row = Math.floor(deadPos.gy)
      col = Math.floor(deadPos.gx)
    } else {
      const fallback = getSpawnForWallet(myWalletRef.current)
      row = fallback.row
      col = fallback.col
    }
    const z = 0
    const spawn = { row, col, z }
    setMyDeadUntil(null)
    setMyDeadPos(null)
    myDeadUntilRef.current = null
    myDeadPosRef.current = null
    localStorage.removeItem('mm3_pvp_dead')
    const _posKey = myWalletRef.current ? `mm3_mining_pos_${myWalletRef.current}` : 'mm3_mining_pos_anon'
    try { localStorage.setItem(_posKey, JSON.stringify({ row, col, z, mapId: deathMapId })) } catch { /* */ }
    if (myWalletRef.current) {
      fetch(`/api/pvp-death?wallet=${encodeURIComponent(myWalletRef.current)}`, { method: 'DELETE' }).catch(() => {})
    }
    setHealthMap(prev => ({ ...prev, [myKeyRef.current]: 100 }))
    if (deathMapId !== mapIdRef.current) {
      setMapId(deathMapId)
      mapIdRef.current = deathMapId
    }
    setMyPos(spawn)
    myPosRef.current = spawn
    setJumpToCell({ row, col, z, mapId: deathMapId, at: Date.now() })
    const ch = channelRef.current
    if (ch) {
      ch.track({
        wallet: myKeyRef.current,
        isDead: false,
        gx: col + 0.5,
        gy: row + 0.5,
        row,
        col,
        z,
        mapId: deathMapId,
      }).catch?.(() => {})
      ch.send({
        type: 'broadcast',
        event: 'pvp-result',
        payload: {
          victim: myKeyRef.current,
          health: 100,
          killed: false,
          respawn: true,
          mapId: deathMapId,
          gx: col + 0.5,
          gy: row + 0.5,
          row,
          col,
        },
      }).catch?.(() => {})
    }
  }, [])

  const scheduleRespawn = useCallback((delayMs) => {
    if (respawnTimerRef.current) clearTimeout(respawnTimerRef.current)
    respawnTimerRef.current = setTimeout(triggerRespawn, Math.max(0, delayMs))
  }, [triggerRespawn])

  const triggerSelfDeath = useCallback(() => {
    if (myDeadUntilRef.current && myDeadUntilRef.current > Date.now()) return
    const myP = myPosRef.current
    const deadGX = (myP?.col ?? 14) + 0.5
    const deadGY = (myP?.row ?? 14) + 0.5
    const deathMapId = mapIdRef.current
    const deadUntil = Date.now() + 5 * 60 * 1000
    const deadUntilIso = new Date(deadUntil).toISOString()
    const deadPos = { gx: deadGX, gy: deadGY, mapId: deathMapId }
    setMyDeadUntil(deadUntil)
    setMyDeadPos(deadPos)
    myDeadUntilRef.current = deadUntil
    myDeadPosRef.current = deadPos
    localStorage.setItem('mm3_pvp_dead', JSON.stringify({ until: deadUntil, gx: deadGX, gy: deadGY, mapId: deathMapId }))
    try { window.dispatchEvent(new Event('mm3-pvp-death')) } catch {}
    if (myWalletRef.current) {
      fetch('/api/pvp-death', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: myWalletRef.current, gx: deadGX, gy: deadGY }) }).catch(() => {})
    }
    clearRlMountOnDeath()
    channelRef.current?.send({ type: 'broadcast', event: 'player-death', payload: { victim: myKeyRef.current, gx: deadGX, gy: deadGY, deadUntil: deadUntilIso, mapId: deathMapId } })?.catch(() => {})
    channelRef.current?.track({ wallet: myKeyRef.current, isDead: true, deadUntil: deadUntilIso, gx: deadGX, gy: deadGY, row: myP?.row ?? 14, col: myP?.col ?? 14, mapId: deathMapId })?.catch?.(() => {})
    scheduleRespawn(5 * 60 * 1000)
  }, [scheduleRespawn])

  // ── StormRoll AoE damage: every 60s during the 15-min hourly dice window ──
  useEffect(() => {
    const id = setInterval(() => {
      const nd = nodeDiceRef.current
      if (!nd) return
      if (!getDiceState().active) return
      if (myDeadUntilRef.current && myDeadUntilRef.current > Date.now()) return
      const key = myKeyRef.current
      if (!key) return
      const pos = myPosRef.current || {}
      const safeGx = Number.isFinite(Number(pos.gx)) ? Number(pos.gx) : Number(pos.col) + .5
      const safeGy = Number.isFinite(Number(pos.gy)) ? Number(pos.gy) : Number(pos.row) + .5
      if (isInHousePoolSafeZone(safeGx, safeGy)) return
      const mode = nd.mode
      if (key.startsWith('anon-')) {
        const current = healthMapRef.current[key] ?? 100
        const dmg = mode === 'war' ? nd.warPercent : nd.naturePercent
        const newHP = Math.max(0, current - dmg)
        setHealthMap(prev => ({ ...prev, [key]: newHP }))
        channelRef.current?.send({ type: 'broadcast', event: 'stormroll-hit', payload: { victim: key, health: newHP, killed: newHP <= 0 } })?.catch(() => {})
        if (newHP <= 0) triggerSelfDeath()
      } else {
        fetch('/api/stormroll-damage', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ wallet: key, mode, gx: safeGx, gy: safeGy }),
        }).then(r => r.json()).then(result => {
          if (!result?.ok) return
          if (result.immune) return
          const newHP = Number(result.health ?? 100)
          setHealthMap(prev => ({ ...prev, [key]: newHP }))
          setReceivedHitAt(Date.now())
          channelRef.current?.send({ type: 'broadcast', event: 'stormroll-hit', payload: { victim: key, health: newHP, killed: result.killed } })?.catch(() => {})
          if (result.killed) triggerSelfDeath()
        }).catch(() => {})
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [triggerSelfDeath])

  // On mount: restore death state that survived a page refresh
  useEffect(() => {
    const stored = (() => { try { return JSON.parse(localStorage.getItem('mm3_pvp_dead') || 'null') } catch { return null } })()
    if (stored?.until && stored.until > Date.now()) {
      const deathMapId = stored.mapId || MINING_CORE_MAP_ID
      const deadPos = { gx: stored.gx, gy: stored.gy, mapId: deathMapId }
      setMyDeadUntil(stored.until)
      setMyDeadPos(deadPos)
      myDeadUntilRef.current = stored.until
      myDeadPosRef.current = deadPos
      setMapId(deathMapId)
      mapIdRef.current = deathMapId
      scheduleRespawn(stored.until - Date.now())
    } else {
      if (stored) localStorage.removeItem('mm3_pvp_dead')
      // Alive — restore persisted position so refresh doesn't change location
      try {
        const posKey = myWallet ? `mm3_mining_pos_${myWallet}` : 'mm3_mining_pos_anon'
        const saved = JSON.parse(localStorage.getItem(posKey) || 'null')
        if (saved && typeof saved.row === 'number' && typeof saved.col === 'number') {
          const savedMapId = saved.mapId || MINING_CORE_MAP_ID
          const savedPos = { row: saved.row, col: saved.col, z: Number(saved.z) || 0 }
          setMapId(savedMapId)
          mapIdRef.current = savedMapId
          setMyPos(savedPos)
          myPosRef.current = savedPos
          setJumpToCell({ ...savedPos, mapId: savedMapId })
        }
      } catch { /* */ }
    }
    // For logged-in wallets: DB is source of truth for both dead state and alive position
    if (myWallet) {
      fetch(`/api/pvp-death?wallet=${encodeURIComponent(myWallet)}`)
        .then(r => r.json())
        .then(r => {
          if (r.dead) {
            const until = new Date(r.deadUntil).getTime()
            if (until <= Date.now()) return
            if (myDeadUntilRef.current && myDeadUntilRef.current >= until) return
            const deathMapId = mapIdRef.current
            const deadPos = { gx: r.gx, gy: r.gy, mapId: deathMapId }
            setMyDeadUntil(until)
            setMyDeadPos(deadPos)
            myDeadUntilRef.current = until
            myDeadPosRef.current = deadPos
            localStorage.setItem('mm3_pvp_dead', JSON.stringify({ until, gx: r.gx, gy: r.gy, mapId: deathMapId }))
            scheduleRespawn(until - Date.now())
          } else if (r.posRow != null && r.posCol != null) {
            const dbMapId = r.mapId || MINING_CORE_MAP_ID
            const dbPos = { row: Number(r.posRow), col: Number(r.posCol), z: Number(r.posZ) || 0, mapId: dbMapId }
            setMapId(dbMapId)
            mapIdRef.current = dbMapId
            setMyPos(dbPos)
            myPosRef.current = dbPos
            setJumpToCell({ ...dbPos, mapId: dbMapId })
            const posKey = `mm3_mining_pos_${myWallet}`
            try { localStorage.setItem(posKey, JSON.stringify(dbPos)) } catch { /* */ }
          }
        })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Background: upgrade anon key to IP-derived stable hash (like relaying does)
  // Runs once; saves result to localStorage so next load uses it immediately
  useEffect(() => {
    if (myWallet) return // logged-in, no need
    // If key was already set by a previous IP fetch (marked), skip re-fetching
    const current = (() => { try { return localStorage.getItem(ANON_KEY_STORAGE) } catch {} })()
    if (current && localStorage.getItem(ANON_KEY_STORAGE + '_src') === 'ip') return
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        const ip = String(data.ip || '')
        if (!ip) return
        const ipKey = hashIpToAnonKey(ip)
        try {
          localStorage.setItem(ANON_KEY_STORAGE, ipKey)
          localStorage.setItem(ANON_KEY_STORAGE + '_src', 'ip')
        } catch { /* */ }
      })
      .catch(() => { /* silently ignore — random key stays */ })
      .finally(() => clearTimeout(timer))
  }, [myWallet]) // eslint-disable-line react-hooks/exhaustive-deps

  // FPV gets wallets that are online AND have a known position (or self)
  const presenceMap = useMemo(() => {
    const map = {}
    const selfKey = presenceKey || myWallet
    for (const w of onlineWallets) {
      const p = positions[w]
      if (p) map[w] = p
    }
    if (selfKey && positions[selfKey]) map[selfKey] = positions[selfKey]
    return map
  }, [positions, onlineWallets, myWallet, presenceKey])

  useEffect(() => {
    if (!presenceKey) return
    if (presenceKey.startsWith('anon-')) {
      setHealthMap(prev => ({ ...prev, [presenceKey]: prev[presenceKey] ?? 100 }))
      setHealthReady(true)
      return
    }
    let cancelled = false
    setHealthReady(false)
    fetch(`/api/pvp-hit?wallet=${encodeURIComponent(presenceKey)}`)
      .then(r => r.json()).then(r => {
        if (cancelled) return
        if (r?.ok) setHealthMap(prev => ({ ...prev, [presenceKey]: Number(r.health ?? 100) }))
      }).catch(() => {})
      .finally(() => { if (!cancelled) setHealthReady(true) })
    return () => { cancelled = true }
  }, [presenceKey])

  // ── Load cell data ───────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    async function load() {
      reloadCellMapRef.current = () => { if (mounted) load() }
      let mined=[]
      let market=[]
      let owners=[]
      try {
        const response=await fetch('/api/mining-snapshot?map=1')
        const snapshot=await response.json()
        if(!response.ok||!snapshot?.ok) throw new Error(snapshot?.error||'snapshot failed')
        mined=snapshot.minedBlocks||[]
        market=snapshot.blocks||[]
        owners=snapshot.owners||[]
      } catch {
        const [minedResponse,marketResponse,ownersResponse]=await Promise.all([
          supabase.from('mm3_mined_blocks').select('block_hex, wallet'),
          supabase.from('mm3_mining_blocks').select('block_key, grid_row, grid_col, emoji, title_en, title_es, price_eur'),
          supabase.from('player_progress').select('wallet, mining_nftji_key').not('mining_nftji_key', 'is', null),
        ])
        mined=minedResponse.data||[]
        market=marketResponse.data||[]
        owners=ownersResponse.data||[]
      }
      if (!mounted) return

      const map = new Map()
      const blocksByHex = new Map()
      for (const m of mined || []) {
        if (!blockHexToGrid(m.block_hex)) continue
        blocksByHex.set(m.block_hex, {
          blockHex: m.block_hex, owner: m.wallet,
          color: colorFromAddress(m.wallet), isMined: true,
        })
      }
      const ownersByKey = new Map()
      for (const o of owners || []) {
        if (o.mining_nftji_key) ownersByKey.set(o.mining_nftji_key, o.wallet.toLowerCase())
      }
      for (const m of market || []) {
        if (m.grid_row == null || m.grid_col == null) continue
        const blockHex = gridToBlockHex(m.grid_row, m.grid_col)
        const nftjiOwner = ownersByKey.get(m.block_key) || null
        // During demine, formula solve inserts a mm3_mined_blocks entry for unowned NFTJI
        // slots. Prefer mining_nftji_key owner; fall back to mm3_mined_blocks wallet so
        // the chain % reaches 100%. After demine resets mm3_mined_blocks, reverts naturally.
        const existingOwner = blocksByHex.get(blockHex)?.owner || null
        const ownerWallet = nftjiOwner || existingOwner
        blocksByHex.set(blockHex, {
          ...blocksByHex.get(blockHex),
          blockKey: m.block_key,
          blockHex,
          emoji: m.emoji, titleEn: m.title_en, titleEs: m.title_es, priceEur: m.price_eur,
          owner: ownerWallet,
          color: ownerWallet ? colorFromAddress(ownerWallet) : '#fb923c',  // amber for unowned NFTJI (matches beacon ring)
          isMarket: true, isMined: Boolean(ownerWallet),
        })
      }
      const marketPositions = new Map(
        [...blocksByHex.values()]
          .filter(block => block.isMarket)
          .sort((a,b) => a.blockHex.localeCompare(b.blockHex))
          .map((block,index) => [block.blockHex, MARKET_LANDMARK_POSITIONS[index]])
      )
      for (const [, block] of [...blocksByHex.entries()].sort(([a],[b]) => a.localeCompare(b))) {
        const pos = marketPositions.get(block.blockHex) || placeDistributedBlock(block.blockHex)
        if (pos && canPlaceMiningBlockAt(pos.row, pos.col)) map.set(`${pos.row},${pos.col}`, block)
      }
      // All unclaimed mining blocks — visible as mineable walls even without an owner
      for (const [blockHex, pos] of VISUAL_BLOCK_POSITIONS) {
        const key = `${pos.row},${pos.col}`
        if (canPlaceMiningBlockAt(pos.row, pos.col) && !map.has(key)) {
          map.set(key, { blockHex, owner: null, isMined: false, isMarket: false, color: null })
        }
      }
      for (const [key, baseHeight] of Object.entries(CIPHER_HOUSE_MINING_LEVELS)) {
        const block = map.get(key)
        if (block) {
          map.set(key, { ...block, baseHeight })
          continue
        }
        for (const [blockHex, pos] of VISUAL_BLOCK_POSITIONS) {
          if (`${pos.row},${pos.col}` !== key) continue
          map.set(key, {
            blockHex,
            owner: null,
            isMined: false,
            isMarket: false,
            color: null,
            baseHeight,
          })
          break
        }
      }
      // Chain Node: fixed special cell at grid center, always present
      map.set(`${CHAIN_NODE_ROW},${CHAIN_NODE_COL}`, {
        isChainNode: true,
        isMarket: false,
        isMined: false,
        owner: null,
        color: '#ffd700',
        emoji: '⬡',
        titleEn: 'MM3 BLOCK CHAIN',
        titleEs: 'MM3 BLOCK CHAIN',
      })
      map.set(`${NODE_DICE_POSITION.row},${NODE_DICE_POSITION.col}`, {
        isNodeDiceNode: true,
        isMarket: false,
        isMined: false,
        owner: null,
        color: '#facc15',
        emoji: '🎲',
        titleEn: 'DICE NODE',
        titleEs: 'DICE NODE',
        baseHeight: 5.80,
      })
      // Portal navigation nodes in the outer area
      for (const node of PORTAL_NODES) {
        const key = `${node.row},${node.col}`
        if (map.get(key)?.isNodeDiceNode) continue
        const insideHouse =
          node.row > CIPHER_HOUSE_BOUNDS.minRow && node.row < CIPHER_HOUSE_BOUNDS.maxRow &&
          node.col > CIPHER_HOUSE_BOUNDS.minCol && node.col < CIPHER_HOUSE_BOUNDS.maxCol
        map.set(key, {
          isPortalNode: true,
          isMarket: false,
          isMined: false,
          owner: null,
          color: node.color,
          emoji: node.emoji,
          titleEn: node.titleEn,
          titleEs: node.titleEs,
          navUrl: node.navUrl,
          ...(insideHouse ? { baseHeight: 3.48 } : {}),
        })
      }
      relocateStairOverlappingBlocks(map)
      setCellMap(map)
      marketRef.current = market || []
      setMarketLoaded(true)

      // Build wallet → { emoji, title } map for NFTJI panel
      const nftjis = {}
      const marketByKey=new Map((market||[]).map(block=>[block.block_key,block]))
      for (const o of owners || []) {
        if (!o.mining_nftji_key) continue
        const mb = marketByKey.get(o.mining_nftji_key)
        if (mb) nftjis[o.wallet.toLowerCase()] = { emoji: mb.emoji || '⬡', title: mb.title_en || o.mining_nftji_key }
      }
      setWalletNftjis(nftjis)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  // Fetch own level + ALL NFTJIs (trade, mining, squeeze) for crit chance + ability bar
  // Re-runs when market loads (marketLoaded) to resolve mining NFTJI emojis correctly
  useEffect(() => {
    if (!myWallet) {
      setPlayerLevel(0)
      setPlayerNftjiCount(0)
      setMyNftjis([])
      if (marketLoaded) setProfileReady(true)
      return
    }
    if (!marketLoaded) return
    let mounted = true
    setProfileReady(false)
    const bootId = requestAnimationFrame(() => {
      ;(async () => {
      const [{ data: pp }, { data: sq }] = await Promise.all([
        supabase.from('player_progress')
          .select('level,mining_nftji_key,mining_nftji_levels,wallet_emojis,lucky_50_level,lucky_100_level,lucky_500_level,lucky_1000_level,relay_exec_count,rl_mount_active')
          .eq('wallet', myWallet).maybeSingle(),
        supabase.from('mm3_squeezing_nftji')
          .select('equipped,attack_level,defense_level')
          .eq('wallet', myWallet).maybeSingle(),
      ])
      if (!mounted || !pp) {
        if (mounted) setProfileReady(true)
        return
      }
      setPlayerLevel(Number(pp.level) || 0)
      rlMountActiveRef.current = Boolean(pp.rl_mount_active)
      setRlMountActive(Boolean(pp.rl_mount_active))

      // Mining NFTJIs (from mm3_mining_blocks claimed blocks)
      const levels = pp.mining_nftji_levels || {}
      const activeKey = pp.mining_nftji_key || null
      // Only the currently held mining NFTJI — one at a time per wallet
      const miningNftjis = activeKey
        ? (() => {
            const mb = marketRef.current.find(m => m.block_key === activeKey)
            return [{ emoji: mb?.emoji || '⬡', level: Number(levels[activeKey] ?? 0), blockKey: activeKey, isActive: true, source:'mining' }]
          })()
        : []

      // Trade/wallet NFTJIs (🔮🍀🎰🧿❤️ from wallet_emojis)
      const walletEmojis = Array.isArray(pp.wallet_emojis) ? pp.wallet_emojis : []
      const tradeNftjis = TRADE_NFTJI_DEFS
        .filter(s => walletEmojis.includes(s.emoji))
        .map(s => ({ emoji: s.emoji, level: s.field ? Math.max(0, Number(pp[s.field] ?? 0)) : 0, blockKey: s.key, isActive: false, source:'trade' }))

      // Squeeze NFTJIs (⚔️🔰 from mm3_squeezing_nftji) — only the equipped (active) one
      const squeezeNftjis = []
      if (sq) {
        if (sq.equipped === 'attack' && (sq.attack_level ?? -1) >= 0)
          squeezeNftjis.push({ emoji: '⚔️', level: Math.max(0, Number(sq.attack_level ?? 0)), blockKey: 'sq-atk', isActive: true, source:'squeeze' })
        if (sq.equipped === 'defense' && (sq.defense_level ?? -1) >= 0)
          squeezeNftjis.push({ emoji: '🔰', level: Math.max(0, Number(sq.defense_level ?? 0)), blockKey: 'sq-def', isActive: true, source:'squeeze' })
      }

      // Relay NFTJI (🔁 from wallet_emojis + relay_exec_count)
      const relayNftjis = walletEmojis.includes('🔁')
        ? [{ emoji: '🔁', level: computeRelayLevel(pp.relay_exec_count ?? 0, pp.relay_exec_count ?? 0), blockKey: 'relay', isActive: true, source: 'relay' }]
        : []

      const allNftjis = [...tradeNftjis, ...miningNftjis, ...squeezeNftjis, ...relayNftjis]
      setMyNftjis(allNftjis)
      setPlayerNftjiCount(allNftjis.length)
      if (mounted) setProfileReady(true)
      })()
    })
    return () => { mounted = false; cancelAnimationFrame(bootId) }
  }, [myWallet, marketLoaded])

  useEffect(() => {
    // Use persisted position when alive; fall back to random spawn
    let spawn
    try {
      const dead = JSON.parse(localStorage.getItem('mm3_pvp_dead') || 'null')
      const isAlive = !dead?.until || dead.until <= Date.now()
      if (isAlive) {
        const posKey = myWallet ? `mm3_mining_pos_${myWallet}` : 'mm3_mining_pos_anon'
        const saved = JSON.parse(localStorage.getItem(posKey) || 'null')
        if (saved && typeof saved.row === 'number' && typeof saved.col === 'number') {
          const savedMapId = saved.mapId || MINING_CORE_MAP_ID
          spawn = { row: saved.row, col: saved.col, z: Number(saved.z) || 0, mapId: savedMapId }
          setMapId(savedMapId)
          mapIdRef.current = savedMapId
        }
      }
    } catch { /* */ }
    if (!spawn) spawn = getSpawnForWallet(myWallet)
    setMyPos(spawn)
    myPosRef.current = spawn
    setJumpToCell(spawn)
    setPositions(prev => {
      const next = { ...prev }
      const oldKey = myKeyRef.current
      if (oldKey) delete next[oldKey]
      if (myWallet) next[myWallet] = {
        gx: spawn.col + 0.5,
        gy: spawn.row + 0.5,
        row: spawn.row,
        col: spawn.col,
        z: Number(spawn.z) || 0,
        mapId: spawn.mapId || mapIdRef.current,
      }
      return next
    })
  }, [myWallet])

  // ── Supabase: presence (join/leave) + broadcast (real-time position) ─────────
  useEffect(() => {
    setChannelReady(false)
    let subscribed = false
    let synced = false
    const tryChannelReady = () => {
      if (subscribed && synced) setChannelReady(true)
    }
    const key = myWallet || getOrCreateAnonKey()
    myKeyRef.current = key
    setPresenceKey(key)
    const ch = supabase.channel(CHAIN3D_CHANNEL, {
      config: { broadcast: { self: false }, presence: { key } },
    })
    const pendingMoves=new Map()
    let moveFlushFrame=null
    const flushPendingMoves=()=>{
      moveFlushFrame=null
      if(!pendingMoves.size) return
      const updates=[...pendingMoves.entries()]
      pendingMoves.clear()
      setPositions(prev=>{
        let next=prev
        for(const [wallet,payload] of updates){
          if(!payload){
            if(next[wallet]){
              if(next===prev) next={...prev}
              delete next[wallet]
            }
            continue
          }
          if(next===prev) next={...prev}
          next[wallet]={
            gx:payload.gx,gy:payload.gy,
            row:Math.floor(payload.gy),col:Math.floor(payload.gx),
            z:Number(payload.z)||0,
            angle:Number(payload.angle)||0,
            pitch:Number(payload.pitch)||0,
            swingAt:Number(payload.swingAt)||prev[wallet]?.swingAt||0,
            poolCode:payload.poolCode||prev[wallet]?.poolCode||null,
            isBot:Boolean(payload.isBot||prev[wallet]?.isBot),
            task:payload.task||prev[wallet]?.task||null,
            taskLabel:payload.taskLabel||prev[wallet]?.taskLabel||null,
            taskPhase:payload.taskPhase||prev[wallet]?.taskPhase||null,
            isDead:Boolean(payload.isDead),
            deadUntil:payload.deadUntil||null,
            mapId:payload.mapId||prev[wallet]?.mapId||MINING_CORE_MAP_ID,
            rlMount:payload.rlMount!=null?Boolean(payload.rlMount):Boolean(prev[wallet]?.rlMount),
          }
        }
        return next
      })
      const visibleWallets=updates.filter(([,payload])=>payload).map(([wallet])=>wallet)
      if(visibleWallets.length){
        setOnlineWallets(prev=>{
          if(visibleWallets.every(wallet=>prev.has(wallet))) return prev
          const next=new Set(prev)
          visibleWallets.forEach(wallet=>next.add(wallet))
          return next
        })
      }
    }
    const queueMove=(wallet,payload)=>{
      pendingMoves.set(wallet,payload)
      if(moveFlushFrame==null) moveFlushFrame=requestAnimationFrame(flushPendingMoves)
    }

    // Legacy anon reset events also use the current arena respawn policy.
    ch.on('broadcast', { event: 'anon-reset' }, ({ payload }) => {
      if (payload?.target === key && !myWalletRef.current) {
        triggerRespawn()
      }
    })

    ch.on('broadcast', { event: 'anon-kill' }, ({ payload }) => {
      if (!payload?.attacker || !payload?.anonKey) return
      const killerLabel = payload.attacker.startsWith('anon-')
        ? 'anon'
        : `${payload.attacker.slice(0,6)}…${payload.attacker.slice(-4)}`
      setAnonKillMsg(`💀 ${killerLabel} killed ${payload.anonKey.slice(0,10)}…`)
    })

    // PvP hit: victim sees red flash; all spectators see attacker swing animation
    ch.on('broadcast', { event: 'pvp-hit' }, ({ payload }) => {
      const myK = myKeyRef.current, myW = myWalletRef.current
      if (payload?.victim && (payload.victim === myK || (myW && payload.victim === myW))) {
        setReceivedHitAt(Date.now())
      }
      if (payload?.attacker) {
        setSwingMap(prev => ({ ...prev, [payload.attacker]: Date.now() }))
      }
    })

    ch.on('broadcast', { event: 'pvp-result' }, ({ payload }) => {
      if (!payload?.victim) return
      if (payload?.attacker) {
        setSwingMap(prev => ({ ...prev, [payload.attacker]: Date.now() }))
      }
      setHealthMap(prev => ({ ...prev, [payload.victim]: Number(payload.health ?? 100) }))
      // Respawn: clear dead state from that player's position entry
      if (payload.respawn) {
        setPositions(prev => {
          const p = prev[payload.victim]
          if (!p?.isDead) return prev
          return {
            ...prev,
            [payload.victim]: {
              ...p,
              isDead: false,
              deadUntil: null,
              mapId: payload.mapId || p.mapId || MINING_CORE_MAP_ID,
              ...(payload.gx != null
                ? {
                    gx: Number(payload.gx),
                    gy: Number(payload.gy),
                    row: Number(payload.row ?? Math.floor(Number(payload.gy))),
                    col: Number(payload.col ?? Math.floor(Number(payload.gx))),
                  }
                : {}),
            },
          }
        })
      }
      if (payload.victim === myKeyRef.current || payload.victim === myWalletRef.current) {
        if (payload.dodged) {
          setReceivedDodgeAt(Date.now())
        } else {
          setReceivedHitAt(Date.now())
          if (payload.attacker && !payload.killed) {
            setReceivedHitFrom({ attacker: payload.attacker, at: Date.now() })
          }
        }
        if (myWalletRef.current) {
          window.dispatchEvent(new CustomEvent('mm3-db-updated', {
            detail: { pvp: true, wallet: myWalletRef.current },
          }))
        }
        if (payload.killed) {
          // Enter 5-minute death state — same for logged wallets and anon.
          // For anon: myWalletRef.current is null so the DB call below is skipped automatically.
          const myP = myPosRef.current
          const deadGX = (myP?.col ?? 14) + 0.5
          const deadGY = (myP?.row ?? 14) + 0.5
          const deathMapId = mapIdRef.current
          const deadUntil = Date.now() + 5 * 60 * 1000
          const deadPos = { gx: deadGX, gy: deadGY, mapId: deathMapId }
          setMyDeadUntil(deadUntil)
          setMyDeadPos(deadPos)
          myDeadUntilRef.current = deadUntil
          myDeadPosRef.current = deadPos
          localStorage.setItem('mm3_pvp_dead', JSON.stringify({ until: deadUntil, gx: deadGX, gy: deadGY, mapId: deathMapId }))
          try { window.dispatchEvent(new Event('mm3-pvp-death')) } catch {}
          if (myWalletRef.current) {
            fetch('/api/pvp-death', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: myWalletRef.current, gx: deadGX, gy: deadGY }) }).catch(() => {})
          }
          clearRlMountOnDeath()
          // Notify others of the corpse position via broadcast
          const deadUntilIso = new Date(deadUntil).toISOString()
          channelRef.current?.send({ type: 'broadcast', event: 'player-death', payload: { victim: payload.victim, gx: deadGX, gy: deadGY, deadUntil: deadUntilIso, mapId: deathMapId } })?.catch(() => {})
          channelRef.current?.track({ wallet: myKeyRef.current, isDead: true, deadUntil: deadUntilIso, gx: deadGX, gy: deadGY, row: myP?.row ?? 14, col: myP?.col ?? 14, mapId: deathMapId })?.catch?.(() => {})
          scheduleRespawn(5 * 60 * 1000)
        }
      }
    })

    // Demine rewards are bounded to 100 broadcasts per completed chain cycle.
    ch.on('broadcast', { event: 'demine-reward' }, ({ payload }) => {
      applyDemineReward(payload || {})
    })

    // Someone solved the global formula — refresh chain/demine status for everyone right away
    // instead of waiting for the 30s poll.
    ch.on('broadcast', { event: 'chain-formula-solved' }, () => {
      loadChainStatusRef.current?.()
    })

    ch.on('broadcast', { event: 'node-dice' }, ({ payload }) => {
      const next = normalizeNodeDiceState(payload)
      nodeDiceRef.current = next
      setNodeDiceState(next)
    })

    ch.on('broadcast', { event: 'stormroll-hit' }, ({ payload }) => {
      const w = payload?.victim
      if (!w || w === myKeyRef.current) return
      setHealthMap(prev => ({ ...prev, [w]: Number(payload.health ?? 100) }))
    })

    // Other players died — update their position to show corpse
    ch.on('broadcast', { event: 'player-death' }, ({ payload }) => {
      const w = payload?.victim
      if (!w) return
      setPositions(prev => ({
        ...prev,
        [w]: {
          ...(prev[w] || {}),
          gx: Number(payload.gx),
          gy: Number(payload.gy),
          row: Math.floor(Number(payload.gy)),
          col: Math.floor(Number(payload.gx)),
          isDead: true,
          deadUntil: payload.deadUntil,
          mapId: payload.mapId || prev[w]?.mapId || MINING_CORE_MAP_ID,
          rlMount: false,
        },
      }))
      setOnlineWallets(prev => prev.has(w) ? prev : new Set([...prev, w]))
    })

    // Anon collision push: target anon receives a velocity impulse
    ch.on('broadcast', { event: 'collision-push' }, ({ payload }) => {
      if (!payload?.target || !myKeyRef.current) return
      if (payload.target !== myKeyRef.current) return
      setExternalPush({ dx: Number(payload.dx) || 0, dy: Number(payload.dy) || 0, at: Date.now() })
    })

    // Low-latency position updates via broadcast.
    ch.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (!payload?.wallet || payload.gx == null) return
      if (payload.nodeDice) {
        const nextNodeDice = normalizeNodeDiceState(payload.nodeDice)
        if (nextNodeDice) {
          nodeDiceRef.current = nextNodeDice
          setNodeDiceState(nextNodeDice)
        }
      }
      const w = payload.wallet
      const remoteMapId = payload.mapId || MINING_CORE_MAP_ID
      const mine = myPosRef.current
      if (remoteMapId !== mapIdRef.current) {
        if (payload.isBot) loadRemoteHealth(w)
        queueMove(w, payload)
        return
      }
      const remoteDist = Math.hypot(
        Number(payload.gx) - (Number(mine?.col) + 0.5),
        Number(payload.gy) - (Number(mine?.row) + 0.5),
      )
      if (remoteDist > NETWORK_VISUAL_RANGE) {
        queueMove(w,null)
        return
      }
      if (payload.isBot) loadRemoteHealth(w)
      queueMove(w,payload)
    })

    // Presence sync: who's online + seed initial positions from track() payload
    ch.on('presence', { event: 'sync' }, () => {
      synced = true
      tryChannelReady()
      const state = ch.presenceState()
      const alive = new Set(Object.keys(state))
      setOnlineWallets(alive)
      setOnlineCount(alive.size)
      setPositions(prev => {
        const next = { ...prev }
        const myW = myWalletRef.current
        // Seed position for players we haven't received a broadcast from yet
        for (const [w, entries] of Object.entries(state)) {
          const p = entries?.[0]
          if (!p || next[w]) continue   // already have broadcast-precise position
          if (p.nodeDice) {
            const nextNodeDice = normalizeNodeDiceState(p.nodeDice)
            if (nextNodeDice) {
              nodeDiceRef.current = nextNodeDice
              setNodeDiceState(nextNodeDice)
            }
          }
          const gx = p.gx ?? ((p.col ?? 14) + 0.5)
          const gy = p.gy ?? ((p.row ?? 14) + 0.5)
          const mine = myPosRef.current
          const remoteMapId = p.mapId || MINING_CORE_MAP_ID
          if (w !== myW && remoteMapId === mapIdRef.current && Math.hypot(gx-(Number(mine?.col)+.5),gy-(Number(mine?.row)+.5)) > NETWORK_VISUAL_RANGE) continue
          if (p.isBot) loadRemoteHealth(w)
          next[w] = {
            gx, gy, row: Math.floor(gy), col: Math.floor(gx), z: Number(p.z) || 0, poolCode: p.poolCode || null,
            isBot: Boolean(p.isBot), task: p.task || null,
            taskLabel: p.taskLabel || null, taskPhase: p.taskPhase || null,
            isDead: Boolean(p.isDead),
            deadUntil: p.deadUntil || null,
            mapId: p.mapId || MINING_CORE_MAP_ID,
            rlMount: Boolean(p.rlMount),
          }
        }
        for (const [w, entries] of Object.entries(state)) {
          const p = entries?.[0]
          if (!p || !next[w] || p.rlMount == null) continue
          next[w] = { ...next[w], rlMount: Boolean(p.rlMount) }
        }
        // Remove players who left (always keep self)
        for (const w of Object.keys(next)) {
          if (w === myW) continue
          const remote = next[w]
          const mine = myPosRef.current
          const remoteMapId = remote?.mapId || MINING_CORE_MAP_ID
          const tooFar = remote && remoteMapId === mapIdRef.current && Math.hypot(
            Number(remote.gx)-(Number(mine?.col)+.5),
            Number(remote.gy)-(Number(mine?.row)+.5),
          ) > NETWORK_VISUAL_RANGE
          if (!alive.has(w) || tooFar) delete next[w]
        }
        return next
      })
    })

    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      channelRef.current = ch
      const myW = myWalletRef.current
      const selfKey = myKeyRef.current
      const { row, col, z = 0 } = myPosRef.current

      // Fetch pool code first, then track once with complete data (avoids double presence message).
      const poolRes = myW
        ? await supabase.from('mm3_wallet_pool_members').select('pool_code').eq('wallet', myW).limit(1).maybeSingle()
        : { data: null }
      const myPoolCode = poolRes?.data?.pool_code || null
      setMyPoolCode(myPoolCode)
      const { row: tr, col: tc, z: tz = 0 } = myPosRef.current
      await ch.track({
        wallet: selfKey,
        gx: tc + 0.5, gy: tr + 0.5, row: tr, col: tc, z: Number(tz) || 0,
        poolCode: myPoolCode,
        nodeDice: normalizeNodeDiceState(nodeDiceRef.current),
        rlMount: rlMountActiveRef.current,
        mapId: mapIdRef.current,
      }).catch(() => {})
      subscribed = true
      tryChannelReady()
    })

    return () => {
      if(moveFlushFrame!=null) cancelAnimationFrame(moveFlushFrame)
      pendingMoves.clear()
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWallet])

  // useCallback with no deps — reads live values via refs so game loop never restarts
  const handlePositionChange = useCallback((row, col) => {
    const z = Number(myPosRef.current?.z) || 0
    setMyPos({ row, col, z })
    myPosRef.current = { ...myPosRef.current, row, col, z }
    if (!myDeadUntilRef.current || myDeadUntilRef.current <= Date.now()) {
      const posKey = myWalletRef.current ? `mm3_mining_pos_${myWalletRef.current}` : 'mm3_mining_pos_anon'
      try { localStorage.setItem(posKey, JSON.stringify({ row, col, z, mapId: mapIdRef.current })) } catch { /* */ }
    }
  }, [])

  const handleMapChange = useCallback((nextMapId, row, col, z = 0) => {
    const next = nextMapId || MINING_CORE_MAP_ID
    setMapId(next)
    mapIdRef.current = next
    const pos = { row, col, z: Number(z) || 0 }
    setMyPos(pos)
    myPosRef.current = pos
    setJumpToCell({ row, col, z: pos.z, mapId: next, at: Date.now() })
    if (!myDeadUntilRef.current || myDeadUntilRef.current <= Date.now()) {
      const posKey = myWalletRef.current ? `mm3_mining_pos_${myWalletRef.current}` : 'mm3_mining_pos_anon'
      try { localStorage.setItem(posKey, JSON.stringify({ row, col, z: pos.z, mapId: next })) } catch { /* */ }
    }
    const myW = myKeyRef.current || myWalletRef.current
    if (myW) {
      setPositions(prev => ({
        ...prev,
        [myW]: {
          ...(prev[myW] || {}),
          gx: col + 0.5,
          gy: row + 0.5,
          row,
          col,
          z: pos.z,
          mapId: next,
        },
      }))
      channelRef.current?.track({
        wallet: myW,
        gx: col + 0.5,
        gy: row + 0.5,
        row,
        col,
        z: pos.z,
        mapId: next,
        poolCode: myPoolCode || null,
        nodeDice: normalizeNodeDiceState(nodeDiceRef.current),
        rlMount: rlMountActiveRef.current,
      }).catch(() => {})
      channelRef.current?.send({
        type: 'broadcast',
        event: 'move',
        payload: {
          wallet: myW,
          gx: col + 0.5,
          gy: row + 0.5,
          row,
          col,
          z: pos.z,
          mapId: next,
          poolCode: myPoolCode || null,
          nodeDice: normalizeNodeDiceState(nodeDiceRef.current),
        },
      }).catch(() => {})
    }
  }, [myPoolCode])

  const handleFacingChange = useCallback((row, col, cell, dist) => setFacingCell({ row, col, cell, dist }), [])
  const handleWantNavigate = useCallback((url) => router.push(url), [router])

  const handleCollisionPush = useCallback(({ key, dx, dy }) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'collision-push',
      payload: { target: key, dx, dy },
    })?.catch(() => {})
  }, [])

  const handlePvpHit = useCallback(async ({ attacker, victim, victimIsAnon, hitZone }) => {
    const victimPos = positions[victim]
    const victimGx = Number(victimPos?.gx)
    const victimGy = Number(victimPos?.gy)
    const victimGz = Number(victimPos?.z) || 0
    if (Number.isFinite(victimGx) && Number.isFinite(victimGy) && isInHousePoolSafeZone(victimGx, victimGy, victimGz)) {
      const currentHealth = Number(healthMapRef.current[victim] ?? 100)
      setHealthMap(prev => ({ ...prev, [victim]: currentHealth }))
      return { ok: true, immune: true, damage: 0, health: currentHealth, killed: false }
    }
    const response = await fetch('/api/pvp-hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ attacker, victim, victimIsAnon, hitZone, victimGx, victimGy, victimGz }),
    }).then(r => r.json()).catch(() => null)
    if (!response?.ok) return response
    if (response.immune) return response
    setHealthMap(prev => ({ ...prev, [victim]: Number(response.health ?? 100) }))
    channelRef.current?.send({
      type: 'broadcast', event: 'pvp-result',
      payload: { victim, attacker, ...response },
    })?.catch(() => {})
    if(response.killed&&victimIsAnon){
      channelRef.current?.send({
        type:'broadcast',event:'anon-kill',payload:{attacker,anonKey:victim},
      })?.catch(()=>{})
    }
    if(!attacker.startsWith('anon-')){
      window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { pvp: true, wallet: attacker } }))
    }
    return response
  }, [positions])

  // Load PvP stolen amounts (refreshed every 60s for online player list)
  const loadPvpStolen = useCallback(async () => {
    const dk = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('mm3_pvp_hits')
      .select('attacker_wallet, eur_stolen')
      .eq('day_key', dk)
      .then(r => r, () => ({ data: [] }))
    if (!data?.length) return
    const map = {}
    for (const r of data) map[r.attacker_wallet] = (map[r.attacker_wallet] || 0) + Number(r.eur_stolen)
    setPvpStolen(map)
  }, [])

  useEffect(() => {
    loadPvpStolen()
    const t = setInterval(loadPvpStolen, 60000)
    return () => clearInterval(t)
  }, [loadPvpStolen])

  const loadChainStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/chain-solve/status', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (!data.ok) return
      setChainDemineActive(Boolean(data.chainDemineActive))
      setChainDemineHitsRemaining(Number(data.chainDemineHitsRemaining ?? 100))
      setChainSolvers(data.solvers || [])
    } catch {}
  }, [])
  useEffect(() => { loadChainStatusRef.current = loadChainStatus }, [loadChainStatus])

  const handleDemineHit = useCallback(({ wallet, mm3Awarded, hitsRemaining, chainReset }) => {
    const eventId = globalThis.crypto?.randomUUID?.()
      || `demine-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const reward = { wallet, mm3Awarded, hitsRemaining, chainReset, eventId }
    applyDemineReward(reward)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'demine-reward',
      payload: reward,
    })?.catch(() => {})
    window.dispatchEvent(new CustomEvent('mm3-db-updated', {
      detail: { wallet, demine: true, deltaMm3: Number(mm3Awarded) || 0 },
    }))
    loadChainStatus()
  }, [applyDemineReward, loadChainStatus])

  useEffect(() => {
    loadChainStatus()
    const t = setInterval(loadChainStatus, 30_000)
    return () => clearInterval(t)
  }, [loadChainStatus])

  const handleChainSolveOpen = useCallback(() => setShowChainSolve(true), [])

  // Close ChainSolve overlay with Escape
  useEffect(() => {
    if (!showChainSolve) return
    const onKey = (e) => { if (e.key === 'Escape') setShowChainSolve(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showChainSolve])

  const handleNftjiPanelOpen = useCallback(({ cell, mx, my }) => {
    if (!cell?.isMarket) return
    const hex = cell.blockHex || gridToBlockHex(my, mx)
    setNftjiPanel({
      blockKey: cell.blockKey,
      blockHex: hex,
      emoji: cell.emoji,
      titleEn: cell.titleEn,
      titleEs: cell.titleEs,
      priceEur: cell.priceEur,
      owner: cell.owner || null,
    })
  }, [])

  // Close NFTJI panel overlay with Escape
  useEffect(() => {
    if (!nftjiPanel) return
    const onKey = (e) => { if (e.key === 'Escape') setNftjiPanel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nftjiPanel])

  const handlePositionRealtime = useCallback((gx, gy, avatar = {}) => {
    const myW = myKeyRef.current || myWalletRef.current
    if (!myW) return
    const row = Math.floor(gy), col = Math.floor(gx)
    const z = Number(avatar.z) || 0
    myPosRef.current = { ...myPosRef.current, gx, gy, row, col, z }
    if (!myDeadUntilRef.current || myDeadUntilRef.current <= Date.now()) {
      const posKey = myWalletRef.current ? `mm3_mining_pos_${myWalletRef.current}` : 'mm3_mining_pos_anon'
      try { localStorage.setItem(posKey, JSON.stringify({ row, col, z, mapId: mapIdRef.current })) } catch { /* */ }
      const w = myWalletRef.current
      if (w) {
        const now = Date.now()
        if (now - lastDbPosSaveRef.current >= 15_000) {
          lastDbPosSaveRef.current = now
          fetch('/api/pvp-death', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ wallet: w, row, col, z, mapId: mapIdRef.current }),
          }).catch(() => {})
        }
      }
    }
    const nextPosition = {
      gx, gy, row, col,
      z,
      angle: Number(avatar.angle) || 0,
      pitch: Number(avatar.pitch) || 0,
      swingAt: Number(avatar.swingAt) || 0,
      poolCode: myPoolCode || null,
      isDead: Boolean(avatar.isDead),
      deadUntil: avatar.deadUntil || null,
      nodeDice: normalizeNodeDiceState(nodeDiceRef.current),
      rlMount: rlMountActiveRef.current,
      mapId: mapIdRef.current,
    }
    // Update own dot on minimap
    setPositions(prev => ({ ...prev, [myW]: nextPosition }))
    // Broadcast to others
    channelRef.current?.send({
      type: 'broadcast', event: 'move',
      payload: { wallet: myW, ...nextPosition },
    })?.catch(() => {})
  }, [myPoolCode])

  const mono = { fontFamily: 'Consolas, monospace' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#04080f', ...mono }}>

      {/* ── 3D view ─────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, position:'relative', overflow:'hidden', minHeight:0 }}>
        {(loading || !fpvReady) ? (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:C, fontSize:'0.75rem', letterSpacing:'0.12em' }}>
            {es?'⟳ CARGANDO…':'⟳ LOADING…'}
          </div>
        ) : (
          <>
        {!playReady && (
          <div style={{
            position:'absolute', inset:0, zIndex:50, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            background:'rgba(2,6,16,0.96)', pointerEvents:'auto',
            fontFamily:'Consolas, monospace',
          }}>
            <div style={{ color:C, fontSize:'0.85rem', letterSpacing:'0.18em', marginBottom:'1rem' }}>
              {!worldBootstrapped
                ? (es ? 'CARGANDO MAPA…' : 'LOADING MAP…')
                : (es ? 'PREPARANDO SESIÓN…' : 'PREPARING SESSION…')}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width:8, height:8, borderRadius:'50%', background:C,
                  animation:`mm3-boot-dot 1.2s ${i * 0.2}s ease-in-out infinite`,
                  opacity:.35,
                }} />
              ))}
            </div>
            <style>{`@keyframes mm3-boot-dot{0%,80%,100%{opacity:.35;transform:scale(1)}40%{opacity:1;transform:scale(1.35)}}`}</style>
          </div>
        )}
          <MiningChain3DFPV
            onWorldReady={handleWorldBootstrapped}
            playReady={playReady}
            cellMap={cellMap}
            presenceMap={presenceMap}
            myWallet={myWallet}
            presenceKey={presenceKey}
            myColor={myColor}
            initRow={myPos.row}
            initCol={myPos.col}
            initZ={myPos.z}
            mapId={mapId}
            onMapChange={handleMapChange}
            jumpToCell={jumpToCell}
            onPositionChange={handlePositionChange}
            onFacingChange={handleFacingChange}
            onWantNavigate={handleWantNavigate}
            onPositionRealtime={handlePositionRealtime}
            onPvpHit={handlePvpHit}
            pvpStolen={pvpStolen}
            demineRewards={demineRewards}
            onChainSolveOpen={handleChainSolveOpen}
            onNftjiPanelOpen={handleNftjiPanelOpen}
            externalPvpFlash={receivedHitAt}
            externalDodgeFlash={receivedDodgeAt}
            externalKnockback={receivedHitFrom}
            externalPush={externalPush}
            onCollisionPush={handleCollisionPush}
            swingMap={swingMap}
            myPoolCode={myPoolCode}
            anonKillMsg={anonKillMsg}
            playerLevel={playerLevel}
            playerNftjiCount={playerNftjiCount}
            walletNftjis={walletNftjis}
            myNftjis={myNftjis}
            healthMap={healthMap}
            currency={currency}
            es={es}
            myDeadUntil={myDeadUntil}
            myDeadPos={myDeadPos}
            chainDemineActive={chainDemineActive}
            chainDemineHitsRemaining={chainDemineHitsRemaining}
            chainSolvers={chainSolvers}
            onDemineHit={handleDemineHit}
            nodeDiceState={nodeDiceState}
            onNodeDicePanelOpen={handleNodeDicePanelOpen}
            rlMountActive={rlMountActive}
            onRlMountPanelOpen={handleRlMountPanelOpen}
          />
          </>
        )}
      </div>

      {/* ── MM3 Block Chain formula overlay ──────────────────────────────── */}
      {showChainSolve && (
        <div
          style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(0,0,0,0.90)', zIndex:60,
          }}
          onClick={() => setShowChainSolve(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#020d06', border:'1px solid rgba(74,222,128,0.30)',
              borderRadius:10, padding:'20px 24px', width:'min(520px,94vw)',
              fontFamily:'Consolas,monospace',
            }}
          >
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color:'#ffd700', fontSize:'1.1rem' }}>⬡</span>
                <div>
                  <div style={{ color:'#4ade80', fontWeight:700, fontSize:'0.88rem', letterSpacing:'0.1em' }}>
                    MM3 BLOCK CHAIN
                  </div>
                  <div style={{ color:'rgba(74,222,128,0.4)', fontSize:'0.62rem', letterSpacing:'0.14em', marginTop:1 }}>
                    {es ? 'FÓRMULA GLOBAL · 1 INTENTO/DÍA' : 'GLOBAL FORMULA · 1 ATTEMPT/DAY'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowChainSolve(false)}
                style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'1.1rem', lineHeight:1 }}
              >
                ✕
              </button>
            </div>

            <ChainSolveCard
              wallet={myWallet}
              onWinner={() => {
                setShowChainSolve(false)
                reloadCellMapRef.current?.()
                loadChainStatus()
                channelRef.current?.send({ type: 'broadcast', event: 'chain-formula-solved', payload: null })?.catch(() => {})
              }}
            />

            <div style={{ textAlign:'center', marginTop:12, color:'rgba(74,222,128,0.25)', fontSize:'0.58rem', letterSpacing:'0.12em' }}>
              {es ? 'ESC O CLIC FUERA PARA CERRAR' : 'ESC OR CLICK OUTSIDE TO CLOSE'}
            </div>
          </div>
        </div>
      )}

      {/* ── StormRoll Node overlay ───────────────────────────────────────── */}
      {nodeDicePanelOpen && (
        <div
          style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(0,0,0,0.90)', zIndex:60,
          }}
          onClick={() => setNodeDicePanelOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#07100f', border:'1px solid rgba(250,204,21,0.34)',
              borderRadius:10, padding:'20px 24px', width:'min(420px,94vw)',
              fontFamily:'Consolas,monospace',
            }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <span style={{ color:'#facc15', fontSize:'1.15rem' }}>🎲</span>
                <div>
                  <div style={{ color:'#facc15', fontWeight:700, fontSize:'0.86rem', letterSpacing:'0.1em' }}>
                    DICE NODE
                  </div>
                  <div style={{ color:'rgba(250,204,21,0.40)', fontSize:'0.6rem', letterSpacing:'0.14em', marginTop:1 }}>
                    {es ? 'DADO HORARIO · 24H' : 'HOURLY DICE · 24H'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setNodeDicePanelOpen(false)}
                style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:'1.1rem', lineHeight:1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display:'grid', gap:8, marginBottom:14, color:'#cbd5e1', fontSize:'0.76rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>{es ? 'Precio' : 'Price'}</span><strong style={{ color:'#facc15' }}>{NODE_DICE_PRICE_MM3} MM3</strong>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>{es ? 'Nivel mínimo' : 'Min level'}</span><strong style={{ color:nodeDiceWalletStats.level >= NODE_DICE_MIN_LEVEL ? '#4ade80' : '#fb7185' }}>Lv {NODE_DICE_MIN_LEVEL}</strong>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>{es ? 'Estado' : 'Status'}</span>
                <strong style={{ color: nodeDiceState ? '#4ade80' : '#94a3b8' }}>
                  {nodeDiceState ? (es ? 'ACTIVO' : 'ACTIVE') : (es ? 'INACTIVO' : 'INACTIVE')}
                </strong>
              </div>
              {nodeDiceState ? (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span>{es ? 'Modo' : 'Mode'}</span>
                    <strong style={{ color: nodeDiceState.mode === 'war' ? '#f97316' : '#38bdf8' }}>
                      {nodeDiceState.mode === 'war' ? '🔥 WAR' : '🌪️ METEO'}
                    </strong>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span>{es ? 'Expira en' : 'Expires in'}</span>
                    <strong style={{ color:'#facc15', fontVariantNumeric:'tabular-nums' }}>
                      {(() => {
                        const ms = Math.max(0, nodeDiceState.expiresAt - Date.now())
                        const h = Math.floor(ms / 3600000)
                        const m = Math.floor((ms % 3600000) / 60000)
                        const s = Math.floor((ms % 60000) / 1000)
                        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                      })()}
                    </strong>
                  </div>
                </>
              ) : null}
              <div style={{ display:'flex', gap:8, justifyContent:'center', padding:'8px 0', color:'#e2e8f0' }}>
                <span>🔥 50%</span>
                <span style={{ color:'#475569' }}>·</span>
                <span>🌪️ 50%</span>
              </div>
            </div>
            {nodeDiceError ? (
              <div style={{ color:'#fb7185', fontSize:'0.7rem', textAlign:'center', marginBottom:10 }}>{nodeDiceError}</div>
            ) : null}
            <button
              onClick={handleActivateNodeDice}
              disabled={Boolean(nodeDiceState)}
              style={{
                width:'100%', border:'1px solid rgba(250,204,21,0.46)',
                background:nodeDiceState?'#1f2937':'#facc15', color:nodeDiceState?'#94a3b8':'#020617',
                borderRadius:8, padding:'10px 12px', fontWeight:800, letterSpacing:'0.08em',
                cursor:nodeDiceState?'not-allowed':'pointer',
              }}
            >
              {nodeDiceState ? (es ? 'ACTIVO' : 'ACTIVE') : (es ? 'ACTIVAR' : 'ACTIVATE')}
            </button>
          </div>
        </div>
      )}

      {/* ── RL Node car purchase overlay ─────────────────────────────────── */}
      {rlMountPanelOpen && (
        <div
          style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(0,0,0,0.90)', zIndex:60,
          }}
          onClick={() => setRlMountPanelOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#061018', border:'1px solid rgba(14,165,233,0.38)',
              borderRadius:10, padding:'20px 24px', width:'min(420px,94vw)',
              fontFamily:'Consolas,monospace',
            }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <span style={{ color:'#0ea5e9', fontSize:'1.15rem' }}>🏎️</span>
                <div>
                  <div style={{ color:'#0ea5e9', fontWeight:700, fontSize:'0.86rem', letterSpacing:'0.1em' }}>
                    RL NODE
                  </div>
                  <div style={{ color:'rgba(14,165,233,0.40)', fontSize:'0.6rem', letterSpacing:'0.14em', marginTop:1 }}>
                    {es ? 'COCHE RL · M2' : 'RL CAR · M2'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setRlMountPanelOpen(false)}
                style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:'1.1rem', lineHeight:1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ display:'grid', gap:8, marginBottom:14, color:'#cbd5e1', fontSize:'0.76rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>{es ? 'Precio' : 'Price'}</span><strong style={{ color:'#0ea5e9' }}>{RL_NODE_PRICE_MM3} MM3</strong>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>{es ? 'Nivel mínimo' : 'Min level'}</span>
                <strong style={{ color: rlMountWalletStats.level >= RL_NODE_MIN_LEVEL ? '#4ade80' : '#fb7185' }}>Lv {RL_NODE_MIN_LEVEL}</strong>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>{es ? 'Estado' : 'Status'}</span>
                <strong style={{ color: rlMountActive ? '#4ade80' : '#94a3b8' }}>
                  {rlMountActive ? (es ? 'COCHE ACTIVO' : 'CAR ACTIVE') : (es ? 'SIN COCHE' : 'NO CAR')}
                </strong>
              </div>
              <div style={{ color:'#94a3b8', fontSize:'0.68rem', lineHeight:1.45, paddingTop:4 }}>
                {es
                  ? '2× velocidad y salto · boost al saltar · se pierde al morir'
                  : '2× speed & jump · boost on jump · lost on death'}
              </div>
            </div>
            {rlMountError ? (
              <div style={{ color:'#fb7185', fontSize:'0.7rem', textAlign:'center', marginBottom:10 }}>{rlMountError}</div>
            ) : null}
            <button
              onClick={handlePurchaseRlMount}
              disabled={Boolean(rlMountActive)}
              style={{
                width:'100%', border:'1px solid rgba(14,165,233,0.46)',
                background: rlMountActive ? '#1f2937' : '#0ea5e9', color: rlMountActive ? '#94a3b8' : '#020617',
                borderRadius:8, padding:'10px 12px', fontWeight:800, letterSpacing:'0.08em',
                cursor: rlMountActive ? 'not-allowed' : 'pointer',
              }}
            >
              {rlMountActive ? (es ? 'YA TIENES COCHE' : 'CAR OWNED') : (es ? 'COMPRAR COCHE' : 'BUY CAR')}
            </button>
          </div>
        </div>
      )}

      {/* ── NFTJI penalty overlay ─────────────────────────────────────────── */}
      {nftjiPanel && (
        <div
          style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(0,0,0,0.92)', zIndex:60,
          }}
          onClick={() => setNftjiPanel(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#080510', border:'1px solid rgba(217,70,239,0.28)',
              borderRadius:10, padding:'20px 24px', width:'min(420px,94vw)',
              fontFamily:'Consolas,monospace',
            }}
          >
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color:'#d946ef', fontSize:'1.0rem' }}>⚡</span>
                <div>
                  <div style={{ color:'#d946ef', fontWeight:700, fontSize:'0.82rem', letterSpacing:'0.1em' }}>
                    {es ? 'BLOQUE NFTJI' : 'NFTJI BLOCK'}
                  </div>
                  <div style={{ color:'rgba(217,70,239,0.35)', fontSize:'0.6rem', letterSpacing:'0.14em', marginTop:1 }}>
                    {es ? 'PENALIZACIÓN · CÓDIGO 5 DÍGITOS' : 'PENALTY · 5-DIGIT CODE'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setNftjiPanel(null)}
                style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'1.1rem', lineHeight:1 }}
              >
                ✕
              </button>
            </div>

            <NftjiPenaltyCard
              wallet={myWallet}
              blockKey={nftjiPanel.blockKey}
              blockHex={nftjiPanel.blockHex}
              blockEmoji={nftjiPanel.emoji}
              blockTitleEn={nftjiPanel.titleEn}
              blockTitleEs={nftjiPanel.titleEs}
              blockPrice={nftjiPanel.priceEur}
              isMine={Boolean(myWallet && nftjiPanel.owner?.toLowerCase() === myWallet?.toLowerCase())}
              es={es}
              onClose={() => setNftjiPanel(null)}
            />

            <div style={{ textAlign:'center', marginTop:12, color:'rgba(217,70,239,0.22)', fontSize:'0.58rem', letterSpacing:'0.12em' }}>
              {es ? 'ESC O CLIC FUERA PARA CERRAR' : 'ESC OR CLICK OUTSIDE TO CLOSE'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
