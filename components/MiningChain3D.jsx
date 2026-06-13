'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'
import { useCurrency } from '@/lib/currency-context'
import { useActiveWallet } from '@/lib/use-active-wallet'
import { colorFromAddress } from '@/lib/wallet-colors'
import {
  gridToBlockHex, blockHexToGrid,
  MM3_BLOCK_REQUIREMENT_BY_HEX,
  MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS,
} from '@/lib/mm3-block-chain'
import supabase from '@/lib/supabaseClient'
import MiningChain3DFPV from './MiningChain3DFPV'
import ChainSolveCard from './ChainSolveCard'

const C = '#22d3ee'
const CHAIN3D_CHANNEL = 'mm3-chain3d-v1'

// Trade/wallet NFTJIs — matches TRADE_SLOT_ORDER in wallet-decorations.js
const TRADE_NFTJI_DEFS = [
  { key: 'lucky50',   emoji: '🔮', field: 'lucky_50_level'   },
  { key: 'lucky100',  emoji: '🍀', field: 'lucky_100_level'  },
  { key: 'lucky500',  emoji: '🎰', field: 'lucky_500_level'  },
  { key: 'lucky1000', emoji: '🧿', field: 'lucky_1000_level' },
  { key: 'revive',    emoji: '❤️', field: null                },
]
const CHAIN_NODE_ROW = 27
const CHAIN_NODE_COL = 27

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

const MARKET_LANDMARK_POSITIONS = [
  [4,14],[4,27],[4,41],
  [12,4],[12,26],[12,52],
  [23,8],[23,19],[23,36],[23,48],
  [36,15],[36,40],
  [44,4],[44,18],[44,38],[44,52],
  [52,16],[52,40],
].map(([row,col]) => ({ row, col }))

const VISUAL_BLOCK_REGIONS = [
  { row:3,  col:3,  size:22 },
  { row:3,  col:31, size:22 },
  { row:31, col:3,  size:22 },
  { row:31, col:31, size:22 },
]

const VISUAL_BLOCK_POSITIONS = (() => {
  const occupied = new Set(PORTAL_NODES.map(node => `${node.row},${node.col}`))
  MARKET_LANDMARK_POSITIONS.forEach(pos => occupied.add(`${pos.row},${pos.col}`))
  occupied.add(`${CHAIN_NODE_ROW},${CHAIN_NODE_COL}`)
  const positions = new Map()
  for (let index = 0; index < MM3_BLOCK_GRID_ROWS * MM3_BLOCK_GRID_COLS; index++) {
    const blockHex = `#${index.toString(16).toUpperCase().padStart(3, '0')}`
    const region = VISUAL_BLOCK_REGIONS[index % VISUAL_BLOCK_REGIONS.length]
    const slots = region.size * region.size
    for (let probe = 0; probe < slots; probe++) {
      const slot = (Math.floor(index / 4) * 137 + (index % 4) * 17 + probe * 53) % slots
      const row = region.row + Math.floor(slot / region.size)
      const col = region.col + (slot % region.size)
      const key = `${row},${col}`
      if (!occupied.has(key)) {
        occupied.add(key)
        positions.set(blockHex, { row, col })
        break
      }
    }
  }
  return positions
})()

function placeDistributedBlock(blockHex) {
  const index = Number.parseInt(String(blockHex || '').replace('#', ''), 16)
  const normalized = Number.isFinite(index) ? `#${index.toString(16).toUpperCase().padStart(3, '0')}` : ''
  return VISUAL_BLOCK_POSITIONS.get(normalized) || blockHexToGrid(blockHex)
}

function getRandomLoggedSpawn() {
  return {
    row: 2 + Math.floor(Math.random() * (MM3_BLOCK_GRID_ROWS - 4)),
    col: 2 + Math.floor(Math.random() * (MM3_BLOCK_GRID_COLS - 4)),
  }
}

function getSpawnForWallet(wallet) {
  return wallet ? getRandomLoggedSpawn() : { row: 14, col: 14 }
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

  // Compute initial spawn once: random for logged-in, center for anon
  const initialPos = useMemo(() => getSpawnForWallet(myWallet), [])

  // Refs: avoid stale closures in channel callbacks and game loop
  const channelRef     = useRef(null)
  const myWalletRef    = useRef(myWallet)
  const myPosRef       = useRef(initialPos)
  const myKeyRef       = useRef(null)     // presence key (wallet or 'anon-XXXX')
  const lastDbWriteRef = useRef(0)

  // Keep refs current each render
  myWalletRef.current = myWallet

  const [cellMap,       setCellMap]       = useState(new Map())
  const [myPos,         setMyPos]         = useState(initialPos)
  const [jumpToCell,    setJumpToCell]    = useState(null)
  const [pvpStolen,     setPvpStolen]     = useState({})
  const [showDetail,    setShowDetail]    = useState(false)
  const [showChainSolve, setShowChainSolve] = useState(false)
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
  const [externalPush, setExternalPush] = useState(null)
  const [swingMap,      setSwingMap]      = useState({})
  const [myPoolCode,    setMyPoolCode]    = useState(null)
  const [presenceKey,   setPresenceKey]   = useState(myWallet)
  const [healthMap,     setHealthMap]     = useState({})
  const healthRequestedRef = useRef(new Set())

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
      const [
        { data: mined },
        { data: market },
        { data: owners },
      ] = await Promise.all([
        supabase.from('mm3_mined_blocks').select('block_hex, wallet'),
        supabase.from('mm3_mining_blocks').select('block_key, grid_row, grid_col, emoji, title_en, title_es, price_eur'),
        supabase.from('player_progress').select('wallet, mining_nftji_key').not('mining_nftji_key', 'is', null),
      ])
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
          color: ownerWallet ? colorFromAddress(ownerWallet) : C,
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
        if (pos) map.set(`${pos.row},${pos.col}`, block)
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
      // Portal navigation nodes in the outer area
      for (const node of PORTAL_NODES) {
        map.set(`${node.row},${node.col}`, {
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
      for (const o of owners || []) {
        if (!o.mining_nftji_key) continue
        const mb = (market || []).find(m => m.block_key === o.mining_nftji_key)
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
          .select('level,mining_nftji_key,mining_nftji_levels,wallet_emojis,lucky_50_level,lucky_100_level,lucky_500_level,lucky_1000_level')
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
      const miningNftjis = Object.entries(levels)
        .map(([blockKey, level]) => {
          const mb = marketRef.current.find(m => m.block_key === blockKey)
          return { emoji: mb?.emoji || '⬡', level: Number(level) || 0, blockKey, isActive: blockKey === activeKey }
        })
        .sort((a, b) => b.level - a.level)

      // Trade/wallet NFTJIs (🔮🍀🎰🧿❤️ from wallet_emojis)
      const walletEmojis = Array.isArray(pp.wallet_emojis) ? pp.wallet_emojis : []
      const tradeNftjis = TRADE_NFTJI_DEFS
        .filter(s => walletEmojis.includes(s.emoji))
        .map(s => ({ emoji: s.emoji, level: s.field ? Math.max(0, Number(pp[s.field] ?? 0)) : 0, blockKey: s.key, isActive: false }))

      // Squeeze NFTJIs (⚔️🔰 from mm3_squeezing_nftji)
      const squeezeNftjis = []
      if (sq) {
        if ((sq.attack_level ?? -1) >= 0)
          squeezeNftjis.push({ emoji: '⚔️', level: Math.max(0, Number(sq.attack_level ?? 0)), blockKey: 'sq-atk', isActive: sq.equipped === 'attack' })
        if ((sq.defense_level ?? -1) >= 0)
          squeezeNftjis.push({ emoji: '🔰', level: Math.max(0, Number(sq.defense_level ?? 0)), blockKey: 'sq-def', isActive: sq.equipped === 'defense' })
      }

      const allNftjis = [...tradeNftjis, ...miningNftjis, ...squeezeNftjis]
      setMyNftjis(allNftjis)
      setPlayerNftjiCount(allNftjis.length)
    })()
    return () => { mounted = false }
  }, [myWallet, marketLoaded])

  useEffect(() => {
    const spawn = getSpawnForWallet(myWallet)
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
    const key = myWallet || `anon-${Math.random().toString(36).slice(2, 8)}`
    myKeyRef.current = key
    setPresenceKey(key)
    const ch = supabase.channel(CHAIN3D_CHANNEL, {
      config: { broadcast: { self: false }, presence: { key } },
    })

    // Anon reset: if I'm the target anon, teleport to center
    ch.on('broadcast', { event: 'anon-reset' }, ({ payload }) => {
      if (payload?.target === key && !myWalletRef.current) {
        setMyPos({ row: 14, col: 14 })
        setJumpToCell({ row: 14, col: 14 })
        supabase.from('mm3_player_positions')
          .upsert({ wallet: key, gx: 14.5, gy: 14.5, updated_at: new Date().toISOString() })
          .then(null, () => {})
      }
    })

    ch.on('broadcast', { event: 'anon-kill' }, ({ payload }) => {
      if (!payload?.attacker || !payload?.anonKey) return
      const killerLabel = payload.attacker.startsWith('anon-')
        ? 'anon'
        : `${payload.attacker.slice(0,6)}…${payload.attacker.slice(-4)}`
      setAnonKillMsg(`💀 ${killerLabel} killed ${payload.anonKey.slice(0,10)}… +2 EUR`)
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
      setHealthMap(prev => ({ ...prev, [payload.victim]: Number(payload.health ?? 100) }))
      if (payload.victim === myKeyRef.current || payload.victim === myWalletRef.current) {
        setReceivedHitAt(Date.now())
        if (payload.attacker && !payload.killed) {
          setReceivedHitFrom({ attacker: payload.attacker, at: Date.now() })
        }
        if (myWalletRef.current) {
          window.dispatchEvent(new CustomEvent('mm3-db-updated', {
            detail: { pvp: true, wallet: myWalletRef.current },
          }))
        }
        if (payload.killed) {
          const spawn = myWalletRef.current ? getRandomLoggedSpawn() : { row: 14, col: 14 }
          setTimeout(() => {
            setMyPos(spawn); myPosRef.current = spawn; setJumpToCell(spawn)
            setHealthMap(prev => ({ ...prev, [payload.victim]: 100 }))
            channelRef.current?.send({
              type:'broadcast',event:'pvp-result',
              payload:{victim:payload.victim,health:100,killed:false,respawn:true},
            })?.catch(() => {})
          }, 450)
        }
      }
    })

    // Anon collision push: target anon receives a velocity impulse
    ch.on('broadcast', { event: 'collision-push' }, ({ payload }) => {
      if (!payload?.target || !myKeyRef.current) return
      if (payload.target !== myKeyRef.current) return
      setExternalPush({ dx: Number(payload.dx) || 0, dy: Number(payload.dy) || 0, at: Date.now() })
    })

    // High-frequency position updates (~8/sec) via broadcast — low latency
    ch.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (!payload?.wallet || payload.gx == null) return
      const w = payload.wallet
      if (payload.isBot) loadRemoteHealth(w)
      setPositions(prev => ({
        ...prev,
        [w]: {
          gx: payload.gx, gy: payload.gy,
          row: Math.floor(payload.gy), col: Math.floor(payload.gx),
          z: Number(payload.z) || 0,
          angle: Number(payload.angle) || 0,
          pitch: Number(payload.pitch) || 0,
          swingAt: Number(payload.swingAt) || prev[w]?.swingAt || 0,
          poolCode: payload.poolCode || prev[w]?.poolCode || null,
          isBot: Boolean(payload.isBot || prev[w]?.isBot),
          task: payload.task || prev[w]?.task || null,
          taskLabel: payload.taskLabel || prev[w]?.taskLabel || null,
          taskPhase: payload.taskPhase || prev[w]?.taskPhase || null,
        },
      }))
      // Ensure the wallet is visible even if presence sync hasn't fired yet
      setOnlineWallets(prev => prev.has(w) ? prev : new Set([...prev, w]))
    })

    // Presence sync: who's online + seed initial positions from track() payload
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const alive = new Set(Object.keys(state))
      for (const [wallet, entries] of Object.entries(state)) {
        if (entries?.[0]?.isBot) loadRemoteHealth(wallet)
      }
      setOnlineWallets(alive)
      setOnlineCount(alive.size)
      setPositions(prev => {
        const next = { ...prev }
        // Seed position for players we haven't received a broadcast from yet
        for (const [w, entries] of Object.entries(state)) {
          const p = entries?.[0]
          if (!p || next[w]) continue   // already have broadcast-precise position
          const gx = p.gx ?? ((p.col ?? 14) + 0.5)
          const gy = p.gy ?? ((p.row ?? 14) + 0.5)
          next[w] = {
            gx, gy, row: Math.floor(gy), col: Math.floor(gx), poolCode: p.poolCode || null,
            isBot: Boolean(p.isBot), task: p.task || null,
            taskLabel: p.taskLabel || null, taskPhase: p.taskPhase || null,
          }
        }
        // Remove players who left (always keep self)
        const myW = myWalletRef.current
        for (const w of Object.keys(next)) {
          if (!alive.has(w) && w !== myW) delete next[w]
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

      // Load pool code + last-known positions in parallel
      const [poolRes, , { data }] = await Promise.all([
        myW
          ? supabase.from('mm3_wallet_pool_members').select('pool_code').eq('wallet', myW).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
        // Track WITH position so other online clients know where we are immediately
        ch.track({ wallet: selfKey, gx: col + 0.5, gy: row + 0.5, row, col }),
        // Load last-known positions from DB (fallback for players who haven't moved yet)
        supabase.from('mm3_player_positions').select('wallet, gx, gy'),
      ])
      const myPoolCode = poolRes?.data?.pool_code || null
      setMyPoolCode(myPoolCode)
      // Re-track with pool code now that we have it
      if (myW && myPoolCode) {
        const { row: r2, col: c2 } = myPosRef.current
        ch.track({ wallet: myW, gx: c2 + 0.5, gy: r2 + 0.5, row: r2, col: c2, poolCode: myPoolCode }).catch(() => {})
      }

      if (data?.length) {
        setPositions(prev => {
          const next = { ...prev }
          for (const r of data) {
            if (r.wallet === myW || r.wallet === selfKey || String(r.wallet || '').startsWith('anon-')) continue
            if (!next[r.wallet]) {
              next[r.wallet] = { gx: r.gx, gy: r.gy, row: Math.floor(r.gy), col: Math.floor(r.gx) }
            }
          }
          return next
        })
      }
    })

    return () => { supabase.removeChannel(ch); channelRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWallet])

  // useCallback with no deps — reads live values via refs so game loop never restarts
  const handlePositionChange = useCallback((row, col) => {
    setMyPos({ row, col })
    myPosRef.current = { row, col }
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
      type: 'broadcast', event: 'pvp-hit',
      payload: { victim, attacker },
    })?.catch(() => {})
    channelRef.current?.send({
      type: 'broadcast', event: 'pvp-result',
      payload: { victim, attacker, ...response },
    })?.catch(() => {})
    window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { pvp: true, wallet: attacker } }))
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

  const handleChainSolveOpen = useCallback(() => setShowChainSolve(true), [])

  // Close ChainSolve overlay with Escape
  useEffect(() => {
    if (!showChainSolve) return
    const onKey = (e) => { if (e.key === 'Escape') setShowChainSolve(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showChainSolve])

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
    }
    // Update own dot on minimap
    setPositions(prev => ({ ...prev, [myW]: nextPosition }))
    // Broadcast to others
    channelRef.current?.send({
      type: 'broadcast', event: 'move',
      payload: { wallet: myW, ...nextPosition },
    })?.catch(() => {})
    // Persist to DB (throttled 1/sec) for players who join later
    const now = Date.now()
    if (now - lastDbWriteRef.current > 1000) {
      lastDbWriteRef.current = now
      supabase.from('mm3_player_positions')
        .upsert({ wallet: myW, gx, gy, updated_at: new Date().toISOString() })
        .then(null, () => {})
    }
  }, [myPoolCode])

  // Interaction range (must be within 2 cells to act on or inspect a block)
  const INTERACT_DIST = 2.0
  const isInRange = !facingCell?.dist || facingCell.dist <= INTERACT_DIST

  // Derived facing cell info
  const fc         = facingCell?.cell
  const isStaticInteraction = Boolean(fc?.isChainNode || fc?.isPortalNode)
  const fcHex      = isStaticInteraction ? null : (fc?.blockHex || (facingCell ? gridToBlockHex(facingCell.row, facingCell.col) : null))
  const fcReq      = fcHex ? MM3_BLOCK_REQUIREMENT_BY_HEX.get(fcHex) : null
  const fcOwnColor = fc?.owner ? colorFromAddress(fc.owner) : null
  const isMine     = myWallet && fc?.owner?.toLowerCase() === myWallet
  const isClaimable = Boolean(fc && !fc.owner && !isStaticInteraction)
  const portalTitle = fc?.isPortalNode
    ? (es ? (fc.titleEs || fc.titleEn) : (fc.titleEn || fc.titleEs))
    : null
  const mineUrl    = fcHex
    ? `/relaying?command=${encodeURIComponent(`/mine block ${fcHex}`)}`
    : '/relaying'
  // NFTJI utility URLs for the detail overlay and actions
  const nftjiResellUrl = fcHex
    ? `/relaying?command=${encodeURIComponent(`/resell ${fcHex}`)}`
    : null
  const nftjiBuyUrl = fcHex
    ? `/relaying?command=${encodeURIComponent(`/buy ${fcHex}`)}`
    : null
  const nftjiPanelUrl = fc?.blockKey
    ? `/mining?block=${encodeURIComponent(fc.blockKey)}`
    : null

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
            onChainSolveOpen={handleChainSolveOpen}
            externalPvpFlash={receivedHitAt}
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
          />
        )}
      </div>

      {/* ── Facing-block info panel ───────────────────────────────────────── */}
      <div style={{
        flexShrink:0, borderTop:`1px solid ${C}18`, background:'#060c18',
        padding:'6px 12px', minHeight:46, display:'flex', alignItems:'center',
        gap:8, flexWrap:'wrap', rowGap:4,
      }}>
        {facingCell && isInRange ? (
          <>
            {/* Block identity: emoji + hex + title */}
            <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0, flex:'0 0 auto' }}>
              {fc?.emoji && <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{fc.emoji}</span>}
              {fcHex && <span style={{ color:fc?.color||C, fontWeight:700, fontSize:'0.82rem', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>
                {fcHex}
              </span>}
              {(fc?.titleEn||fc?.titleEs) && (
                <span style={{ color:'#7a90a3', fontSize:'0.76rem', whiteSpace:'nowrap', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', maxWidth:140 }}>
                  {es?(fc.titleEs||fc.titleEn):(fc.titleEn||fc.titleEs)}
                </span>
              )}
            </div>

            {/* Owner status */}
            {fc?.owner ? (
              <span style={{
                color: isMine ? C : fcOwnColor,
                fontSize:'0.74rem',
                border:`1px solid ${(isMine?C:fcOwnColor)+'33'}`,
                borderRadius:3, padding:'1px 5px', whiteSpace:'nowrap', flex:'0 0 auto',
              }}>
                {isMine ? (es?'🔑 tuyo':'🔑 yours') : `${fc.owner.slice(0,6)}…${fc.owner.slice(-4)}`}
              </span>
            ) : !isStaticInteraction && (
              <span style={{ color:'#3d5468', fontSize:'0.74rem', flex:'0 0 auto' }}>
                {es?'libre':'unclaimed'}
              </span>
            )}

            {fcReq?.minLevel > 0 && (
              <span style={{ color:'#4d6a7e', fontSize:'0.72rem', whiteSpace:'nowrap', flex:'0 0 auto' }}>
                lvl≥{fcReq.minLevel}
              </span>
            )}

            {fc?.priceEur > 0 && (
              <span style={{ color:'#fb923c', fontSize:'0.76rem', fontWeight:700, whiteSpace:'nowrap', flex:'0 0 auto' }}>
                {fc.priceEur} EUR
              </span>
            )}

            {/* Action buttons — pushed to the right */}
            <div style={{ display:'flex', gap:6, marginLeft:'auto', flexWrap:'wrap', alignItems:'center', flex:'0 0 auto' }}>
              {/* Chain node */}
              {fc?.isChainNode && isInRange && (
                <button onClick={() => setShowChainSolve(true)} style={{
                  ...actionLink, background:'#1a1000', borderColor:'#ffd70044', color:'#ffd700', cursor:'pointer',
                }}>
                  ⬡ {es?'Cadena':'Chain'}
                </button>
              )}
              {fc?.isChainNode && !isInRange && (
                <span style={{ color:'#ffd70033', fontSize:'0.72rem', fontFamily:'monospace', fontStyle:'italic' }}>
                  {es?'acércate':'get closer'}
                </span>
              )}
              {fc?.isPortalNode && fc?.navUrl && (
                <button onClick={() => router.push(fc.navUrl)} style={{
                  ...actionLink, background:`${fc.color || C}12`, borderColor:`${fc.color || C}55`, color:fc.color || C, cursor:'pointer',
                }}>
                  {fc.emoji || '◆'} {es ? `Ir a ${portalTitle}` : `Go to ${portalTitle}`}
                </button>
              )}
              {/* NFTJI block: always show both buy + resell options */}
              {fc?.isMarket && !fc?.isChainNode && isInRange && (
                <>
                  {isClaimable ? (
                    <Link href={nftjiBuyUrl || '#'} style={{
                      ...actionLink, background:'#1a0800', borderColor:'#fb923c55', color:'#fb923c',
                    }}>
                      ⛏ {es?'Comprar':'Buy'}
                    </Link>
                  ) : (
                    <span style={{ ...actionLink, borderColor:'#fb923c11', color:'#fb923c33' }}>
                      ⛏ {es?'Comprar':'Buy'}
                    </span>
                  )}
                  {isMine && nftjiResellUrl ? (
                    <Link href={nftjiResellUrl} style={{
                      ...actionLink, background:'#001a0c', borderColor:'#4ade8055', color:'#4ade80',
                    }}>
                      💰 {es?'Liberar':'Resell'}
                    </Link>
                  ) : (
                    <span style={{ ...actionLink, borderColor:'#4ade8011', color:'#4ade8033' }}>
                      💰 {es?'Liberar':'Resell'}
                    </span>
                  )}
                </>
              )}
              {fc?.isMarket && !fc?.isChainNode && !isInRange && (
                <span style={{ color:`${C}33`, fontSize:'0.72rem', fontFamily:'monospace', fontStyle:'italic' }}>
                  {es?'acércate':'get closer'}
                </span>
              )}
              {/* Regular free block */}
              {!fc?.isMarket && isClaimable && isInRange && (
                <Link href={mineUrl} style={{
                  ...actionLink, background:`${C}0c`, borderColor:`${C}44`, color:C,
                }}>
                  ⛏ {es?'Minar':'Mine'}
                </Link>
              )}
              {!fc?.isMarket && isClaimable && !isInRange && (
                <span style={{ color:`${C}33`, fontSize:'0.72rem', fontFamily:'monospace', fontStyle:'italic' }}>
                  {es?'acércate':'get closer'}
                </span>
              )}
              <button onClick={()=>setShowDetail(true)} style={{
                ...actionLink, background:'transparent', borderColor:`${C}22`, color:`${C}55`, cursor:'pointer',
              }}>
                {es?'Detalle':'Detail'}
              </button>
            </div>
          </>
        ) : (
          <span style={{ color:'#3a5060', fontSize:'0.72rem', letterSpacing:'0.06em' }}>
            {es
              ? 'WASD · MOVER  ·  RATÓN/DRAG · MIRAR  ·  SHIFT · CORRER  ·  SPC · SALTAR'
              : 'WASD · MOVE  ·  MOUSE/DRAG · LOOK  ·  SHIFT · SPRINT  ·  SPC · JUMP'}
          </span>
        )}
      </div>

      {/* ── Block detail overlay ──────────────────────────────────────────── */}
      {showDetail && facingCell && (
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.72)', zIndex:50,
        }} onClick={()=>setShowDetail(false)}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:'#060c18', border:`1px solid ${C}44`, borderRadius:10,
            padding:'18px 22px', minWidth:260, maxWidth:340,
            fontFamily:'Consolas,monospace', color:'#c4d4e0',
          }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              {fc?.emoji && <span style={{ fontSize:'1.5rem' }}>{fc.emoji}</span>}
              <div style={{ flex:1 }}>
                {fcHex && <div style={{ color:fc?.color||C, fontWeight:700, fontSize:'0.94rem', letterSpacing:'0.08em' }}>
                  {fcHex}
                </div>}
                {(fc?.titleEn||fc?.titleEs) && (
                  <div style={{ color:'#b8c7d4', fontSize:'0.80rem', marginTop:2 }}>
                    {es?(fc.titleEs||fc.titleEn):(fc.titleEn||fc.titleEs)}
                  </div>
                )}
              </div>
              <button onClick={()=>setShowDetail(false)} style={{
                background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'1rem',
              }}>✕</button>
            </div>

            {/* Owner */}
            {!isStaticInteraction && <div style={{ fontSize:'0.78rem', marginBottom:8 }}>
              {fc?.owner ? (
                <span style={{ color: isMine ? C : (fcOwnColor||'#94a3b8') }}>
                  {isMine ? (es?'🔑 Tu bloque':'🔑 Yours') : `◈ ${fc.owner.slice(0,10)}…${fc.owner.slice(-6)}`}
                </span>
              ) : (
                <span style={{ color:'#64748b' }}>{es?'Sin reclamar':'Unclaimed'}</span>
              )}
            </div>}

            {/* Chain node description */}
            {fc?.isChainNode && (
              <div style={{ color:'#ffb020', fontSize:'0.76rem', marginBottom:8 }}>
                {es
                  ? 'Resuelve fórmulas para minar todos los bloques de la cadena.'
                  : 'Solve formulas to mine all blocks in the chain.'}
              </div>
            )}

            {fc?.isPortalNode && (
              <div style={{ color:fc.color || C, fontSize:'0.76rem', marginBottom:8 }}>
                {es
                  ? `Acceso directo al apartado ${portalTitle} del portal.`
                  : `Direct access to the ${portalTitle} portal section.`}
              </div>
            )}

            {/* Price */}
            {fc?.priceEur > 0 && (
              <div style={{ color:'#fb923c', fontWeight:700, fontSize:'0.86rem', marginBottom:8 }}>
                {fc.priceEur} EUR
              </div>
            )}

            {/* Level requirement */}
            {fcReq?.minLevel > 0 && (
              <div style={{ color:'#6d849a', fontSize:'0.76rem', marginBottom:8 }}>
                {es?`Nivel mínimo: ${fcReq.minLevel}`:`Min level: ${fcReq.minLevel}`}
              </div>
            )}

            {/* Actions */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {isClaimable && isInRange && (
                <Link href={mineUrl} style={{
                  ...actionLink, background:`${C}0c`, borderColor:`${C}44`, color:C,
                }} onClick={()=>setShowDetail(false)}>
                  ⛏ {es?'Minar':'Mine'}
                </Link>
              )}
              {(fc?.isChainNode && isInRange) && (
                <button onClick={() => { setShowDetail(false); setShowChainSolve(true); }} style={{
                  ...actionLink, background:'#1a1000', borderColor:'#ffd70044', color:'#ffd700', cursor:'pointer',
                }}>
                  ⬡ {es?'Resolver cadena':'Solve chain'}
                </button>
              )}
              {fc?.isPortalNode && fc?.navUrl && isInRange && (
                <button onClick={() => { setShowDetail(false); router.push(fc.navUrl); }} style={{
                  ...actionLink, background:`${fc.color || C}12`, borderColor:`${fc.color || C}55`, color:fc.color || C, cursor:'pointer',
                }}>
                  {fc.emoji || '◆'} {es ? `Ir a ${portalTitle}` : `Go to ${portalTitle}`}
                </button>
              )}
              {isMine && fc?.isMarket && nftjiResellUrl && (
                <Link href={nftjiResellUrl} style={{
                  ...actionLink, background:'#001a0c', borderColor:'#4ade8044', color:'#4ade80',
                }} onClick={()=>setShowDetail(false)}>
                  💰 {es?'Revender':'Resell'}
                </Link>
              )}
              {fc?.blockKey && (
                <Link href={`/mining-short/${fc.blockKey}`} style={{
                  ...actionLink, background:'transparent', borderColor:'#1e293b', color:'#475569',
                }} onClick={()=>setShowDetail(false)}>
                  YT {es?'Comando oculto':'Hidden command'}
                </Link>
              )}
              {nftjiPanelUrl && isMine && (
                <Link href={nftjiPanelUrl} style={{
                  ...actionLink, background:'transparent', borderColor:'#a21caf44', color:'#e879f9',
                }} onClick={()=>setShowDetail(false)}>
                  # {es?'Código fórmula':'Formula code'}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}

const actionLink = {
  display:'inline-flex', alignItems:'center', gap:4,
  fontSize:'0.78rem', textDecoration:'none',
  border:'1px solid transparent', borderRadius:4, padding:'5px 11px',
  fontFamily:'Consolas,monospace', whiteSpace:'nowrap',
  letterSpacing:'0.04em',
}
