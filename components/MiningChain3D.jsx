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

const C = '#22d3ee'
const CHAIN3D_CHANNEL = 'mm3-chain3d-v1'

export default function MiningChain3D() {
  const { language } = useI18n()
  const es = language === 'es'
  const { account } = useActiveWallet()
  const router = useRouter()

  // myWallet MUST be declared before any hook that references it
  const myWallet = account?.toLowerCase() || null
  const myColor  = myWallet ? colorFromAddress(myWallet) : '#888888'

  // Compute initial spawn once: random for logged-in, center for anon
  const initialPos = useMemo(() => {
    if (!myWallet) return { row: 14, col: 14 }
    return {
      row: 2 + Math.floor(Math.random() * (MM3_BLOCK_GRID_ROWS - 4)),
      col: 2 + Math.floor(Math.random() * (MM3_BLOCK_GRID_COLS - 4)),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

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
  // positions: wallet → { gx, gy, row, col } — populated from presence payload, broadcast, and DB
  const [positions,     setPositions]     = useState({})
  // onlineWallets: who is currently in the channel (from presence sync)
  const [onlineWallets, setOnlineWallets] = useState(new Set())
  const [loading,       setLoading]       = useState(true)
  const [onlineCount,   setOnlineCount]   = useState(0)
  const [facingCell,    setFacingCell]    = useState(null)
  const [copied,        setCopied]        = useState(false)

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
      setCellMap(map)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

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

    // High-frequency position updates (~8/sec) via broadcast — low latency
    ch.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (!payload?.wallet || payload.gx == null) return
      setPositions(prev => ({
        ...prev,
        [payload.wallet]: {
          gx: payload.gx, gy: payload.gy,
          row: Math.floor(payload.gy), col: Math.floor(payload.gx),
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
          next[w] = { gx, gy, row: Math.floor(gy), col: Math.floor(gx) }
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
      const { row, col } = myPosRef.current

      // Run track + DB load in parallel
      const [, { data }] = await Promise.all([
        // Track WITH position so other online clients know where we are immediately
        myW
          ? ch.track({ wallet: myW, gx: col + 0.5, gy: row + 0.5, row, col })
          : Promise.resolve(),
        // Load last-known positions from DB (fallback for players who haven't moved yet)
        supabase.from('mm3_player_positions').select('wallet, gx, gy'),
      ])

      if (data?.length) {
        setPositions(prev => {
          const next = { ...prev }
          for (const r of data) {
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

  const handleFacingChange = useCallback((row, col, cell) => setFacingCell({ row, col, cell }), [])
  const handleWantNavigate = useCallback((url) => router.push(url), [router])

  const handlePvpHit = useCallback(({ attacker, victim, victimIsAnon }) => {
    fetch('/api/pvp-hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ attacker, victim, victimIsAnon }),
    }).catch(() => {})
  }, [])

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

  // Copy hex to clipboard
  const copyHex = useCallback(async (hex) => {
    try { await navigator.clipboard.writeText(hex) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1400)
  }, [])

  // Derived facing cell info
  const fc         = facingCell?.cell
  const fcHex      = facingCell ? gridToBlockHex(facingCell.row, facingCell.col) : null
  const fcReq      = fcHex ? MM3_BLOCK_REQUIREMENT_BY_HEX.get(fcHex) : null
  const fcOwnColor = fc?.owner ? colorFromAddress(fc.owner) : null
  const isMine     = myWallet && fc?.owner?.toLowerCase() === myWallet
  const isClaimable = !fc?.owner
  const mineUrl    = fcHex
    ? `/relaying?command=${encodeURIComponent(`/mine ${fcHex}`)}`
    : '/relaying'

  const mono = { fontFamily: 'Consolas, monospace' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#04080f', ...mono }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'5px 10px',
        borderBottom:`1px solid ${C}22`, background:'#06091a', flexShrink:0, flexWrap:'wrap',
        rowGap:4,
      }}>
        <span style={{ color:C, fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.12em', whiteSpace:'nowrap' }}>
          🔷 MM3 BLOCK CHAIN 3D
        </span>

        <div style={{ display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexWrap:'wrap' }}>
          {onlineCount > 0 && (
            <span style={{ color:'#4ade80', fontSize:'0.63rem', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>
              ● {onlineCount} {es?'en línea':'online'}
            </span>
          )}
          {myWallet ? (
            <span style={{ color:myColor, fontSize:'0.63rem', border:`1px solid ${myColor}44`, borderRadius:4, padding:'2px 7px', whiteSpace:'nowrap' }}>
              {myWallet.slice(0,6)}…{myWallet.slice(-4)}
            </span>
          ) : (
            <span style={{ color:'#334155', fontSize:'0.63rem', whiteSpace:'nowrap' }}>
              {es?'sin wallet':'no wallet'}
            </span>
          )}
          <Link href="/mining" style={{ color:'#475569', fontSize:'0.63rem', textDecoration:'none', border:'1px solid #1e293b', borderRadius:4, padding:'2px 7px', whiteSpace:'nowrap' }}>
            ← {es?'Tablero':'Board'}
          </Link>
        </div>
      </div>

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
            es={es}
          />
        )}
      </div>

      {/* ── Facing-block info panel ───────────────────────────────────────── */}
      <div style={{
        flexShrink:0, borderTop:`1px solid ${C}18`, background:'#060c18',
        padding:'5px 10px', minHeight:44, display:'flex', alignItems:'center',
        gap:8, flexWrap:'wrap', rowGap:4,
      }}>
        {facingCell ? (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
              {fc?.emoji && <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{fc.emoji}</span>}
              <span style={{ color:fc?.color||C, fontWeight:700, fontSize:'0.7rem', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>
                {fcHex}
              </span>
              <span style={{ color:'#1a3040', fontSize:'0.58rem', whiteSpace:'nowrap' }}>
                [{facingCell.row},{facingCell.col}]
              </span>
            </div>

            {fc?.isMarket && (
              <span style={{ color:'#c4d4e0', fontSize:'0.67rem', minWidth:0 }}>
                {es?(fc.titleEs||fc.titleEn):(fc.titleEn||fc.titleEs)}
              </span>
            )}

            {fc?.owner ? (
              <span style={{
                color: isMine ? C : fcOwnColor,
                fontSize:'0.62rem',
                border:`1px solid ${(isMine?C:fcOwnColor)+'33'}`,
                borderRadius:3, padding:'1px 6px', whiteSpace:'nowrap',
              }}>
                {isMine ? (es?'🔑 tuyo':'🔑 yours') : `${fc.owner.slice(0,8)}…${fc.owner.slice(-5)}`}
              </span>
            ) : (
              <span style={{ color:'#1a3040', fontSize:'0.62rem' }}>
                {es?'sin reclamar':'unclaimed'}
              </span>
            )}

            {fcReq?.minLevel > 0 && (
              <span style={{ color:'#2a4560', fontSize:'0.58rem', whiteSpace:'nowrap' }}>
                {es?`lvl≥${fcReq.minLevel}`:`lvl≥${fcReq.minLevel}`}
              </span>
            )}

            {fc?.priceEur > 0 && (
              <span style={{ color:'#fb923c', fontSize:'0.62rem', fontWeight:600, whiteSpace:'nowrap' }}>
                {fc.priceEur} EUR
              </span>
            )}

            <div style={{ display:'flex', gap:6, marginLeft:'auto', flexWrap:'wrap', alignItems:'center' }}>
              <button onClick={()=>fcHex&&copyHex(fcHex)} style={{
                ...btnSm, color: copied?'#4ade80':C+'88', borderColor: copied?'#4ade8033':`${C}22`,
              }}>
                {copied ? '✓' : '⎘'} {fcHex}
              </button>

              {isClaimable && (
                <Link href={mineUrl} style={{
                  ...actionLink, background:`${C}0c`, borderColor:`${C}44`, color:C,
                }}>
                  ⛏ {es?'Minar bloque':'Mine block'}
                </Link>
              )}

              <Link href="/mining" style={{
                ...actionLink, background:'#1e293b', borderColor:'#334155', color:'#94a3b8',
              }}>
                {es?'Tablero 2D':'2D Board'}
              </Link>
            </div>
          </>
        ) : (
          <span style={{ color:'#1a3040', fontSize:'0.61rem', letterSpacing:'0.09em' }}>
            {es
              ? 'WASD / FLECHAS → MOVER · DRAG → ROTAR · APUNTA A UNA SALA PARA VER SU INFO'
              : 'WASD / ARROWS → MOVE · DRAG → LOOK · AIM AT A ROOM TO INSPECT IT'}
          </span>
        )}
      </div>
    </div>
  )
}

const btnSm = {
  background:'transparent', border:'1px solid #1e293b', color:'#475569',
  padding:'2px 8px', borderRadius:4, cursor:'pointer',
  fontFamily:'Consolas,monospace', fontSize:'0.65rem', whiteSpace:'nowrap',
}

const actionLink = {
  display:'inline-flex', alignItems:'center', gap:4,
  fontSize:'0.64rem', textDecoration:'none',
  border:'1px solid transparent', borderRadius:4, padding:'3px 10px',
  fontFamily:'Consolas,monospace', whiteSpace:'nowrap',
  letterSpacing:'0.05em',
}
