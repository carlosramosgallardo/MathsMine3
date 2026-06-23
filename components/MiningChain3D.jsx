'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
import { CIPHER_HOUSE_BOUNDS, CIPHER_HOUSE_MINING_LEVELS, MINING_CHAIN_NODE_POSITION } from '@/lib/mining-world-layout'
import {
  MINING_MARKET_LANDMARK_POSITIONS,
  MINING_VISUAL_BLOCK_POSITIONS,
  placeMiningVisualBlock,
} from '@/lib/mining-visual-layout'
import supabase from '@/lib/supabaseClient'
import MiningChain3DFPV from './MiningChain3DFPV'
import ChainSolveCard from './ChainSolveCard'
import NftjiPenaltyCard from './NftjiPenaltyCard'

const C = '#22d3ee'
const NETWORK_VISUAL_RANGE = 22
const CHAIN3D_CHANNEL = 'mm3-chain3d-v1'

function isInCipherHouseClearance(row, col) {
  return row >= CIPHER_HOUSE_BOUNDS.minRow - 2 && row <= CIPHER_HOUSE_BOUNDS.maxRow + 2
    && col >= CIPHER_HOUSE_BOUNDS.minCol - 2 && col <= CIPHER_HOUSE_BOUNDS.maxCol + 2
}
const NODE_DICE_PRICE_MM3 = 500
const NODE_DICE_MIN_LEVEL = 30
const NODE_DICE_STORAGE_KEY = 'mm3_stormroll_node'
const NODE_DICE_DURATION_MS = 24 * 60 * 60 * 1000
const NODE_DICE_POSITION = Object.freeze({ row: 5, col: 8 })

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
  const myWalletRef    = useRef(myWallet)
  const myPosRef       = useRef(initialPos)
  const myKeyRef       = useRef(null)     // presence key (wallet or 'anon-XXXX')
  const lastDbPosSaveRef = useRef(0)      // throttle DB position saves

  // Keep refs current each render
  myWalletRef.current = myWallet

  const [cellMap,       setCellMap]       = useState(new Map())
  const [myPos,         setMyPos]         = useState(initialPos)
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
  // Death / respawn state — ms timestamp (null = alive)
  const [myDeadUntil,   setMyDeadUntil]   = useState(null)
  const [myDeadPos,     setMyDeadPos]     = useState(null)
  const myDeadUntilRef = useRef(null)
  const respawnTimerRef = useRef(null)
  const [chainDemineActive, setChainDemineActive] = useState(false)
  const [chainDemineHitsRemaining, setChainDemineHitsRemaining] = useState(100)
  const [chainSolvers, setChainSolvers] = useState([])
  const [nodeDiceState, setNodeDiceState] = useState(null)
  const [nodeDicePanelOpen, setNodeDicePanelOpen] = useState(false)
  const [nodeDiceWalletStats, setNodeDiceWalletStats] = useState({ mm3: 0, level: 0 })
  const [nodeDiceError, setNodeDiceError] = useState('')
  const demineRewardIdsRef = useRef(new Set())
  const nodeDiceRef = useRef(null)

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
      if (broadcast) channelRef.current?.send({ type: 'broadcast', event: 'node-dice', payload: null })?.catch(() => {})
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
      channelRef.current?.send({
        type: 'broadcast',
        event: 'node-dice',
        payload: next,
      })?.catch(() => {})
    }
    return next
  }, [])

  useEffect(() => {
    let restored = null
    try { restored = normalizeNodeDiceState(JSON.parse(localStorage.getItem(NODE_DICE_STORAGE_KEY) || 'null')) } catch {}
    if (restored) {
      nodeDiceRef.current = restored
      setNodeDiceState(restored)
      refreshNodeDiceMode(restored, false)
    }
    const id = setInterval(() => refreshNodeDiceMode(nodeDiceRef.current, true), 1000)
    return () => clearInterval(id)
  }, [refreshNodeDiceMode])

  useEffect(() => {
    nodeDiceRef.current = normalizeNodeDiceState(nodeDiceState)
  }, [nodeDiceState])

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

  const handleActivateNodeDice = useCallback(async () => {
    const wallet = myWalletRef.current
    if (!wallet) {
      setNodeDiceError(es ? 'Conecta wallet para activar.' : 'Connect wallet to activate.')
      return
    }
    const current = normalizeNodeDiceState(nodeDiceRef.current)
    if (current) {
      setNodeDiceError(es ? 'StormRoll Node ya está activo.' : 'StormRoll Node is already active.')
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
    const now = Date.now()
    const next = {
      wallet,
      startedAt: now,
      expiresAt: now + NODE_DICE_DURATION_MS,
      mode: Math.random() < .5 ? 'meteo' : 'war',
      hourStart: 0,
      warPercent: 0,
      naturePercent: 0,
    }
    nodeDiceRef.current = next
    setNodeDiceState(next)
    setNodeDicePanelOpen(false)
    setNodeDiceError('')
    try { localStorage.setItem(NODE_DICE_STORAGE_KEY, JSON.stringify(next)) } catch {}
    channelRef.current?.send({ type: 'broadcast', event: 'node-dice', payload: next })?.catch(() => {})
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
    const spawn = getSpawnForWallet(myWalletRef.current)
    setMyPos(spawn); myPosRef.current = spawn; setJumpToCell(spawn)
    setMyDeadUntil(null); setMyDeadPos(null)
    myDeadUntilRef.current = null
    localStorage.removeItem('mm3_pvp_dead')
    const _posKey = myWalletRef.current ? `mm3_mining_pos_${myWalletRef.current}` : 'mm3_mining_pos_anon'
    localStorage.removeItem(_posKey)
    if (myWalletRef.current) {
      fetch(`/api/pvp-death?wallet=${encodeURIComponent(myWalletRef.current)}`, { method: 'DELETE' }).catch(() => {})
    }
    setHealthMap(prev => ({ ...prev, [myKeyRef.current]: 100 }))
    const ch = channelRef.current
    if (ch) {
      const { row, col } = spawn
      ch.track({ wallet: myKeyRef.current, isDead: false, gx: col + 0.5, gy: row + 0.5, row, col }).catch?.(() => {})
      ch.send({ type: 'broadcast', event: 'pvp-result', payload: { victim: myKeyRef.current, health: 100, killed: false, respawn: true } }).catch?.(() => {})
    }
  }, [])

  const scheduleRespawn = useCallback((delayMs) => {
    if (respawnTimerRef.current) clearTimeout(respawnTimerRef.current)
    respawnTimerRef.current = setTimeout(triggerRespawn, Math.max(0, delayMs))
  }, [triggerRespawn])

  // On mount: restore death state that survived a page refresh
  useEffect(() => {
    const stored = (() => { try { return JSON.parse(localStorage.getItem('mm3_pvp_dead') || 'null') } catch { return null } })()
    if (stored?.until && stored.until > Date.now()) {
      setMyDeadUntil(stored.until)
      setMyDeadPos({ gx: stored.gx, gy: stored.gy })
      myDeadUntilRef.current = stored.until
      scheduleRespawn(stored.until - Date.now())
    } else {
      if (stored) localStorage.removeItem('mm3_pvp_dead')
      // Alive — restore persisted position so refresh doesn't change location
      try {
        const posKey = myWallet ? `mm3_mining_pos_${myWallet}` : 'mm3_mining_pos_anon'
        const saved = JSON.parse(localStorage.getItem(posKey) || 'null')
        if (saved && typeof saved.row === 'number' && typeof saved.col === 'number') {
          setMyPos({ row: saved.row, col: saved.col })
          myPosRef.current = { row: saved.row, col: saved.col }
          setJumpToCell({ row: saved.row, col: saved.col })
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
            setMyDeadUntil(until)
            setMyDeadPos({ gx: r.gx, gy: r.gy })
            myDeadUntilRef.current = until
            localStorage.setItem('mm3_pvp_dead', JSON.stringify({ until, gx: r.gx, gy: r.gy }))
            scheduleRespawn(until - Date.now())
          } else if (r.posRow != null && r.posCol != null) {
            // DB alive position overrides localStorage (anti-cheat)
            const dbPos = { row: Number(r.posRow), col: Number(r.posCol) }
            setMyPos(dbPos)
            myPosRef.current = dbPos
            setJumpToCell(dbPos)
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
    for (const w of onlineWallets) {
      const p = positions[w]
      if (p) map[w] = p
    }
    if (myWallet && positions[myWallet]) map[myWallet] = positions[myWallet]
    return map
  }, [positions, onlineWallets, myWallet])

  useEffect(() => {
    if (!presenceKey) return
    if (presenceKey.startsWith('anon-')) {
      setHealthMap(prev => ({ ...prev, [presenceKey]: prev[presenceKey] ?? 100 }))
      return
    }
    fetch(`/api/pvp-hit?wallet=${encodeURIComponent(presenceKey)}`)
      .then(r => r.json()).then(r => {
        if (r?.ok) setHealthMap(prev => ({ ...prev, [presenceKey]: Number(r.health ?? 100) }))
      }).catch(() => {})
  }, [presenceKey])

  // ── Load cell data ───────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    async function load() {
      let mined=[]
      let market=[]
      let owners=[]
      try {
        const response=await fetch('/api/mining-snapshot')
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
        const ownerWallet = ownersByKey.get(m.block_key) || null
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
        if (pos && !isInCipherHouseClearance(pos.row, pos.col)) map.set(`${pos.row},${pos.col}`, block)
      }
      // All unclaimed mining blocks — visible as mineable walls even without an owner
      for (const [blockHex, pos] of VISUAL_BLOCK_POSITIONS) {
        const key = `${pos.row},${pos.col}`
        if (!isInCipherHouseClearance(pos.row, pos.col) && !map.has(key)) {
          map.set(key, { blockHex, owner: null, isMined: false, isMarket: false, color: null })
        }
      }
      for (const [key, baseHeight] of Object.entries(CIPHER_HOUSE_MINING_LEVELS)) {
        const block = map.get(key)
        if (block) map.set(key, { ...block, baseHeight })
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
        titleEn: 'STORMROLL NODE',
        titleEs: 'STORMROLL NODE',
        baseHeight: 5.80,
      })
      // Portal navigation nodes in the outer area
      for (const node of PORTAL_NODES) {
        const key = `${node.row},${node.col}`
        if (map.get(key)?.isNodeDiceNode) continue
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
        })
      }
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
    if (!myWallet) { setPlayerLevel(0); setPlayerNftjiCount(0); setMyNftjis([]); return }
    let mounted = true
    ;(async () => {
      const [{ data: pp }, { data: sq }] = await Promise.all([
        supabase.from('player_progress')
          .select('level,mining_nftji_key,mining_nftji_levels,wallet_emojis,lucky_50_level,lucky_100_level,lucky_500_level,lucky_1000_level,relay_exec_count')
          .eq('wallet', myWallet).maybeSingle(),
        supabase.from('mm3_squeezing_nftji')
          .select('equipped,attack_level,defense_level')
          .eq('wallet', myWallet).maybeSingle(),
      ])
      if (!mounted || !pp) return
      setPlayerLevel(Number(pp.level) || 0)

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
    })()
    return () => { mounted = false }
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
        if (saved && typeof saved.row === 'number' && typeof saved.col === 'number') spawn = saved
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
      if (myWallet) next[myWallet] = { gx: spawn.col + 0.5, gy: spawn.row + 0.5, row: spawn.row, col: spawn.col }
      return next
    })
  }, [myWallet])

  // ── Supabase: presence (join/leave) + broadcast (real-time position) ─────────
  useEffect(() => {
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
          return { ...prev, [payload.victim]: { ...p, isDead: false, deadUntil: null } }
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
          const deadUntil = Date.now() + 5 * 60 * 1000
          setMyDeadUntil(deadUntil)
          setMyDeadPos({ gx: deadGX, gy: deadGY })
          myDeadUntilRef.current = deadUntil
          localStorage.setItem('mm3_pvp_dead', JSON.stringify({ until: deadUntil, gx: deadGX, gy: deadGY }))
          try { window.dispatchEvent(new Event('mm3-pvp-death')) } catch {}
          if (myWalletRef.current) {
            fetch('/api/pvp-death', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: myWalletRef.current, gx: deadGX, gy: deadGY }) }).catch(() => {})
          }
          // Notify others of the corpse position via broadcast
          const deadUntilIso = new Date(deadUntil).toISOString()
          channelRef.current?.send({ type: 'broadcast', event: 'player-death', payload: { victim: payload.victim, gx: deadGX, gy: deadGY, deadUntil: deadUntilIso } })?.catch(() => {})
          channelRef.current?.track({ wallet: myKeyRef.current, isDead: true, deadUntil: deadUntilIso, gx: deadGX, gy: deadGY, row: myP?.row ?? 14, col: myP?.col ?? 14 })?.catch?.(() => {})
          scheduleRespawn(5 * 60 * 1000)
        }
      }
    })

    // Demine rewards are bounded to 100 broadcasts per completed chain cycle.
    ch.on('broadcast', { event: 'demine-reward' }, ({ payload }) => {
      applyDemineReward(payload || {})
    })

    ch.on('broadcast', { event: 'node-dice' }, ({ payload }) => {
      const next = normalizeNodeDiceState(payload)
      nodeDiceRef.current = next
      setNodeDiceState(next)
    })

    // Other players died — update their position to show corpse
    ch.on('broadcast', { event: 'player-death' }, ({ payload }) => {
      const w = payload?.victim
      if (!w) return
      setPositions(prev => ({
        ...prev,
        [w]: { ...(prev[w] || {}), gx: Number(payload.gx), gy: Number(payload.gy), row: Math.floor(Number(payload.gy)), col: Math.floor(Number(payload.gx)), isDead: true, deadUntil: payload.deadUntil },
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
      const mine = myPosRef.current
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
          if (w !== myW && Math.hypot(gx-(Number(mine?.col)+.5),gy-(Number(mine?.row)+.5)) > NETWORK_VISUAL_RANGE) continue
          if (p.isBot) loadRemoteHealth(w)
          next[w] = {
            gx, gy, row: Math.floor(gy), col: Math.floor(gx), poolCode: p.poolCode || null,
            isBot: Boolean(p.isBot), task: p.task || null,
            taskLabel: p.taskLabel || null, taskPhase: p.taskPhase || null,
            isDead: Boolean(p.isDead),
            deadUntil: p.deadUntil || null,
          }
        }
        // Remove players who left (always keep self)
        for (const w of Object.keys(next)) {
          if (w === myW) continue
          const remote = next[w]
          const mine = myPosRef.current
          const tooFar = remote && Math.hypot(
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
      const { row, col } = myPosRef.current

      // Presence contains the spawn position; subsequent broadcasts carry the
      // live state, so joining mining does not need a positions-table scan.
      const [poolRes] = await Promise.all([
        myW
          ? supabase.from('mm3_wallet_pool_members').select('pool_code').eq('wallet', myW).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
        // Track with position so other online clients know where we are immediately.
        ch.track({ wallet: selfKey, gx: col + 0.5, gy: row + 0.5, row, col, nodeDice: normalizeNodeDiceState(nodeDiceRef.current) }),
      ])
      const myPoolCode = poolRes?.data?.pool_code || null
      setMyPoolCode(myPoolCode)
      // Re-track with pool code now that we have it
      if (myW && myPoolCode) {
        const { row: r2, col: c2 } = myPosRef.current
        ch.track({ wallet: myW, gx: c2 + 0.5, gy: r2 + 0.5, row: r2, col: c2, poolCode: myPoolCode, nodeDice: normalizeNodeDiceState(nodeDiceRef.current) }).catch(() => {})
      }
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
    setMyPos({ row, col })
    myPosRef.current = { row, col }
    if (!myDeadUntilRef.current || myDeadUntilRef.current <= Date.now()) {
      const posKey = myWalletRef.current ? `mm3_mining_pos_${myWalletRef.current}` : 'mm3_mining_pos_anon'
      try { localStorage.setItem(posKey, JSON.stringify({ row, col })) } catch { /* */ }
      // Persist to DB for logged wallets (throttled — max once per 15s, anti-cheat)
      const w = myWalletRef.current
      if (w) {
        const now = Date.now()
        if (now - lastDbPosSaveRef.current >= 15_000) {
          lastDbPosSaveRef.current = now
          fetch('/api/pvp-death', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ wallet: w, row, col }),
          }).catch(() => {})
        }
      }
    }
  }, [])

  const handleFacingChange = useCallback((row, col, cell, dist) => setFacingCell({ row, col, cell, dist }), [])
  const handleWantNavigate = useCallback((url) => router.push(url), [router])

  const handleCollisionPush = useCallback(({ key, dx, dy }) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'collision-push',
      payload: { target: key, dx, dy },
    })?.catch(() => {})
  }, [])

  const handlePvpHit = useCallback(async ({ attacker, victim, victimIsAnon, hitZone }) => {
    const response = await fetch('/api/pvp-hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ attacker, victim, victimIsAnon, hitZone }),
    }).then(r => r.json()).catch(() => null)
    if (!response?.ok) return response
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
  }, [])

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
    const nextPosition = {
      gx, gy, row, col,
      z: Number(avatar.z) || 0,
      angle: Number(avatar.angle) || 0,
      pitch: Number(avatar.pitch) || 0,
      swingAt: Number(avatar.swingAt) || 0,
      poolCode: myPoolCode || null,
      isDead: Boolean(avatar.isDead),
      deadUntil: avatar.deadUntil || null,
      nodeDice: normalizeNodeDiceState(nodeDiceRef.current),
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
        {loading ? (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:C, fontSize:'0.75rem', letterSpacing:'0.12em' }}>
            {es?'⟳ CARGANDO…':'⟳ LOADING…'}
          </div>
        ) : (
          <MiningChain3DFPV
            cellMap={cellMap}
            presenceMap={presenceMap}
            myWallet={myWallet}
            presenceKey={presenceKey}
            myColor={myColor}
            initRow={myPos.row}
            initCol={myPos.col}
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
          />
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
              onWinner={() => setShowChainSolve(false)}
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
                    STORMROLL NODE
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
                <span>{es ? 'Tu wallet' : 'Your wallet'}</span><strong style={{ color:'#67e8f9' }}>Lv {nodeDiceWalletStats.level} · {nodeDiceWalletStats.mm3.toFixed(2)} MM3</strong>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', padding:'8px 0', color:'#e2e8f0' }}>
                <span>🔥 50%</span>
                <span style={{ color:'#475569' }}>·</span>
                <span>🌪️ 50%</span>
              </div>
            </div>

            {nodeDiceState ? (
              <div style={{ color:'#4ade80', fontSize:'0.72rem', textAlign:'center', marginBottom:10 }}>
                {es ? 'Activo por' : 'Active by'} {nodeDiceState.wallet.slice(0,6)}…{nodeDiceState.wallet.slice(-4)}
                {' · '}
                {nodeDiceState.mode === 'war' ? '🔥 WAR' : '🌪️ METEO'}
              </div>
            ) : null}
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
