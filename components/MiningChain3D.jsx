'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'
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
const CHAIN_NODE_ROW = 4
const CHAIN_NODE_COL = 4

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
  const [facingCell,    setFacingCell]    = useState(null)
  const [receivedHitAt, setReceivedHitAt] = useState(0)
  const [swingMap,      setSwingMap]      = useState({})

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
      for (const m of mined || []) {
        const pos = blockHexToGrid(m.block_hex)
        if (!pos) continue
        map.set(`${pos.row},${pos.col}`, {
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
        const key = `${m.grid_row},${m.grid_col}`
        const ownerWallet = ownersByKey.get(m.block_key) || null
        map.set(key, {
          ...map.get(key),
          blockKey: m.block_key,
          blockHex: gridToBlockHex(m.grid_row, m.grid_col),
          emoji: m.emoji, titleEn: m.title_en, titleEs: m.title_es, priceEur: m.price_eur,
          owner: ownerWallet,
          color: ownerWallet ? colorFromAddress(ownerWallet) : C,
          isMarket: true, isMined: Boolean(ownerWallet),
        })
      }
      // Chain Node: fixed special cell at grid center, always present
      map.set(`${CHAIN_NODE_ROW},${CHAIN_NODE_COL}`, {
        blockHex: gridToBlockHex(CHAIN_NODE_ROW, CHAIN_NODE_COL),
        isChainNode: true,
        isMarket: false,
        isMined: false,
        owner: null,
        color: '#ffd700',
        emoji: '⬡',
        titleEn: 'MM3 BLOCK CHAIN',
        titleEs: 'MM3 BLOCK CHAIN',
      })
      setCellMap(map)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

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
    const ch = supabase.channel(CHAIN3D_CHANNEL, {
      config: { broadcast: { self: false }, presence: { key } },
    })

    // Anon reset: if I'm the target anon, teleport to center
    ch.on('broadcast', { event: 'anon-reset' }, ({ payload }) => {
      if (payload?.target === key && !myWalletRef.current) {
        setMyPos({ row: 14, col: 14 })
        setJumpToCell({ row: 14, col: 14 })
        // Clear our DB position entry
        supabase.from('mm3_player_positions')
          .upsert({ wallet: key, gx: 14.5, gy: 14.5, updated_at: new Date().toISOString() })
          .then(null, () => {})
      }
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

    // High-frequency position updates (~8/sec) via broadcast — low latency
    ch.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (!payload?.wallet || payload.gx == null) return
      setPositions(prev => ({
        ...prev,
        [payload.wallet]: {
          gx: payload.gx, gy: payload.gy,
          row: Math.floor(payload.gy), col: Math.floor(payload.gx),
          poolCode: prev[payload.wallet]?.poolCode || null,  // preserve from presence
        },
      }))
    })

    // Presence sync: who's online + seed initial positions from track() payload
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const alive = new Set(Object.keys(state))
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
          next[w] = { gx, gy, row: Math.floor(gy), col: Math.floor(gx), poolCode: p.poolCode || null }
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

    channelRef.current = ch
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

  const handlePvpHit = useCallback(({ attacker, victim, victimIsAnon }) => {
    fetch('/api/pvp-hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ attacker, victim, victimIsAnon }),
    }).catch(() => {})
    // Broadcast hit: victim flashes red, spectators see attacker swing
    channelRef.current?.send({
      type: 'broadcast', event: 'pvp-hit',
      payload: { victim, attacker },
    })?.catch(() => {})
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

  const handleAnonReset = useCallback((anonKey) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'anon-reset',
      payload: { target: anonKey },
    })?.catch(() => {})
  }, [])

  const handlePositionRealtime = useCallback((gx, gy) => {
    const myW = myWalletRef.current
    if (!myW) return
    const row = Math.floor(gy), col = Math.floor(gx)
    // Update own dot on minimap
    setPositions(prev => ({ ...prev, [myW]: { gx, gy, row, col } }))
    // Broadcast to others
    channelRef.current?.send({
      type: 'broadcast', event: 'move',
      payload: { wallet: myW, gx, gy },
    })?.catch(() => {})
    // Persist to DB (throttled 1/sec) for players who join later
    const now = Date.now()
    if (now - lastDbWriteRef.current > 1000) {
      lastDbWriteRef.current = now
      supabase.from('mm3_player_positions')
        .upsert({ wallet: myW, gx, gy, updated_at: new Date().toISOString() })
        .then(null, () => {})
    }
  }, [])

  // Interaction range (must be within 2.5 cells to act on a block/element)
  const INTERACT_DIST = 2.5
  const isInRange = !facingCell?.dist || facingCell.dist <= INTERACT_DIST

  // Derived facing cell info
  const fc         = facingCell?.cell
  const fcHex      = facingCell ? gridToBlockHex(facingCell.row, facingCell.col) : null
  const fcReq      = fcHex ? MM3_BLOCK_REQUIREMENT_BY_HEX.get(fcHex) : null
  const fcOwnColor = fc?.owner ? colorFromAddress(fc.owner) : null
  const isMine     = myWallet && fc?.owner?.toLowerCase() === myWallet
  const isClaimable = !fc?.owner
  const mineUrl    = fcHex
    ? `/relaying?command=${encodeURIComponent(`/mine block ${fcHex}`)}`
    : '/relaying'
  // NFTJI utility URLs for the detail overlay
  const nftjiResellUrl = fcHex
    ? `/relaying?command=${encodeURIComponent(`/resell ${fcHex}`)}`
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
            myColor={myColor}
            initRow={myPos.row}
            initCol={myPos.col}
            jumpToCell={jumpToCell}
            onPositionChange={handlePositionChange}
            onFacingChange={handleFacingChange}
            onWantNavigate={handleWantNavigate}
            onPositionRealtime={handlePositionRealtime}
            onPvpHit={handlePvpHit}
            onAnonReset={handleAnonReset}
            pvpStolen={pvpStolen}
            onChainSolveOpen={handleChainSolveOpen}
            externalPvpFlash={receivedHitAt}
            swingMap={swingMap}
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
        {facingCell ? (
          <>
            {/* Block identity: emoji + hex + title */}
            <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0, flex:'0 0 auto' }}>
              {fc?.emoji && <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{fc.emoji}</span>}
              <span style={{ color:fc?.color||C, fontWeight:700, fontSize:'0.82rem', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>
                {fcHex}
              </span>
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
            ) : !fc?.isChainNode && (
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
              {isClaimable && !fc?.isChainNode && isInRange && (
                <Link href={mineUrl} style={{
                  ...actionLink, background:`${C}0c`, borderColor:`${C}44`, color:C,
                }}>
                  ⛏ {es?'Minar':'Mine'}
                </Link>
              )}
              {isClaimable && !fc?.isChainNode && !isInRange && (
                <span style={{ color:`${C}33`, fontSize:'0.72rem', fontFamily:'monospace', fontStyle:'italic' }}>
                  {es?'acércate':'get closer'}
                </span>
              )}
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
              {isMine && fc?.isMarket && nftjiResellUrl && (
                <Link href={nftjiResellUrl} style={{
                  ...actionLink, background:'#001a0c', borderColor:'#4ade8044', color:'#4ade80',
                }}>
                  💰 {es?'Revender':'Resell'}
                </Link>
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
              ? 'WASD · MOVER  ·  DRAG · ROTAR  ·  ↵ · ACCIÓN'
              : 'WASD · MOVE  ·  DRAG · LOOK  ·  ↵ · ACTION'}
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
                <div style={{ color:fc?.color||C, fontWeight:700, fontSize:'0.94rem', letterSpacing:'0.08em' }}>
                  {fcHex}
                </div>
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
            <div style={{ fontSize:'0.78rem', marginBottom:8 }}>
              {fc?.owner ? (
                <span style={{ color: isMine ? C : (fcOwnColor||'#94a3b8') }}>
                  {isMine ? (es?'🔑 Tu bloque':'🔑 Yours') : `◈ ${fc.owner.slice(0,10)}…${fc.owner.slice(-6)}`}
                </span>
              ) : (
                <span style={{ color:'#64748b' }}>{es?'Sin reclamar':'Unclaimed'}</span>
              )}
            </div>

            {/* Chain node description */}
            {fc?.isChainNode && (
              <div style={{ color:'#ffb020', fontSize:'0.76rem', marginBottom:8 }}>
                {es
                  ? 'Resuelve fórmulas para minar todos los bloques de la cadena.'
                  : 'Solve formulas to mine all blocks in the chain.'}
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
              {(!fc?.owner && !fc?.isChainNode && isInRange) && (
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
              {nftjiPanelUrl && (
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
