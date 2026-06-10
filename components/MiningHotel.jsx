'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'
import { useActiveWallet } from '@/lib/use-active-wallet'
import { colorFromAddress } from '@/lib/wallet-colors'
import {
  gridToBlockHex, blockHexToGrid,
  MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS,
  MM3_BLOCK_REQUIREMENT_BY_HEX,
} from '@/lib/mm3-block-chain'
import supabase from '@/lib/supabaseClient'
import MiningHotelFPV from './MiningHotelFPV'

const C = '#22d3ee'
const HOTEL_CHANNEL = 'mm3-hotel-v1'

export default function MiningHotel() {
  const { language } = useI18n()
  const es = language === 'es'
  const { account } = useActiveWallet()
  const router = useRouter()
  const channelRef = useRef(null)
  const lastRealtimeTrackRef = useRef(0)

  const [cellMap,     setCellMap]     = useState(new Map())
  const [myPos,       setMyPos]       = useState({ row: 14, col: 14 })
  const [presenceMap, setPresenceMap] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [onlineCount, setOnlineCount] = useState(0)
  const [facingCell,  setFacingCell]  = useState(null)  // { row, col, cell }
  const [jumpTarget,  setJumpTarget]  = useState(null)  // { row, col }
  const [searchVal,   setSearchVal]   = useState('')
  const [searchErr,   setSearchErr]   = useState(false)
  const [copied,      setCopied]      = useState(false)

  const myWallet = account?.toLowerCase() || null
  const myColor  = myWallet ? colorFromAddress(myWallet) : '#888888'

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

  // ── Supabase Presence ────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(HOTEL_CHANNEL, {
      config: { presence: { key: myWallet || `anon-${Math.random().toString(36).slice(2,8)}` } },
    })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const flat = {}
      for (const [key, entries] of Object.entries(state)) {
        if (entries?.[0]) flat[key] = entries[0]
      }
      setPresenceMap(flat)
      setOnlineCount(Object.keys(flat).length)
    })
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && myWallet) {
        await ch.track({ wallet: myWallet, row: myPos.row, col: myPos.col })
      }
    })
    channelRef.current = ch
    return () => { supabase.removeChannel(ch); channelRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWallet])

  useEffect(() => {
    if (channelRef.current && myWallet) {
      channelRef.current.track({ wallet: myWallet, row: myPos.row, col: myPos.col }).catch(() => {})
    }
  }, [myPos, myWallet])

  const handlePositionChange    = useCallback((row, col) => setMyPos({ row, col }), [])
  const handleFacingChange      = useCallback((row, col, cell) => setFacingCell({ row, col, cell }), [])
  const handleWantNavigate      = useCallback((url) => router.push(url), [router])
  const handlePositionRealtime  = useCallback((gx, gy) => {
    const now = Date.now()
    if (now - lastRealtimeTrackRef.current < 120) return
    lastRealtimeTrackRef.current = now
    if (channelRef.current && myWallet) {
      const row = Math.floor(gy), col = Math.floor(gx)
      channelRef.current.track({ wallet: myWallet, row, col, gx, gy }).catch(() => {})
    }
  }, [myWallet])

  // ── Block search / jump ──────────────────────────────────────────────────────
  const doJump = useCallback((raw) => {
    const val = raw.trim().toUpperCase().replace(/^0X/,'0x') || raw.trim()
    const pos  = blockHexToGrid(val)
    if (!pos) { setSearchErr(true); setTimeout(() => setSearchErr(false), 1200); return }
    setJumpTarget({ ...pos, _t: Date.now() })  // _t forces useEffect to re-fire for same cell
    setSearchVal('')
    setSearchErr(false)
  }, [])

  // Copy hex to clipboard
  const copyHex = useCallback(async (hex) => {
    try { await navigator.clipboard.writeText(hex) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1400)
  }, [])

  // Derived facing cell info
  const fc     = facingCell?.cell
  const fcHex  = facingCell ? gridToBlockHex(facingCell.row, facingCell.col) : null
  const fcReq  = fcHex ? MM3_BLOCK_REQUIREMENT_BY_HEX.get(fcHex) : null
  const fcOwnColor = fc?.owner ? colorFromAddress(fc.owner) : null
  const isMine = myWallet && fc?.owner?.toLowerCase() === myWallet
  const isClaimable = !fc?.owner  // unclaimed block (may still need level req)
  const mineUrl = fcHex
    ? `/relaying?command=${encodeURIComponent(`/mine ${fcHex}`)}`
    : '/relaying'

  const mono = { fontFamily: 'Consolas, monospace' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#04080f', ...mono }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'5px 10px',
        borderBottom:`1px solid ${C}22`, background:'#06091a', flexShrink:0, flexWrap:'wrap',
        rowGap:4,
      }}>
        <span style={{ color:C, fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.12em', whiteSpace:'nowrap' }}>
          🔷 MM3 BLOCK CHAIN 3D
        </span>

        {/* Block search / jump */}
        <form onSubmit={e=>{ e.preventDefault(); doJump(searchVal) }}
          style={{ display:'flex', gap:4, alignItems:'center', marginLeft:8 }}>
          <input
            value={searchVal}
            onChange={e=>setSearchVal(e.target.value)}
            placeholder={es ? '0x… buscar bloque' : '0x… jump to block'}
            style={{
              background:'#0a111f', border:`1px solid ${searchErr ? '#ef4444' : C+'33'}`,
              borderRadius:4, color: searchErr ? '#ef4444' : '#94a3b8',
              padding:'3px 8px', fontSize:'0.65rem', fontFamily:'Consolas,monospace',
              width:150, outline:'none',
              transition:'border-color 0.2s',
            }}
          />
          <button type="submit" style={{ ...btnSm, color:C, borderColor:`${C}44` }}>↵</button>
        </form>

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
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {loading ? (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:C, fontSize:'0.75rem', letterSpacing:'0.12em' }}>
            {es?'⟳ CARGANDO…':'⟳ LOADING…'}
          </div>
        ) : (
          <MiningHotelFPV
            cellMap={cellMap}
            presenceMap={presenceMap}
            myWallet={myWallet}
            myColor={myColor}
            initRow={myPos.row}
            initCol={myPos.col}
            jumpToCell={jumpTarget}
            onPositionChange={handlePositionChange}
            onFacingChange={handleFacingChange}
            onWantNavigate={handleWantNavigate}
            onPositionRealtime={handlePositionRealtime}
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
            {/* Identity */}
            <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
              {fc?.emoji && <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{fc.emoji}</span>}
              <span style={{ color:fc?.color||C, fontWeight:700, fontSize:'0.7rem', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>
                {fcHex}
              </span>
              <span style={{ color:'#1a3040', fontSize:'0.58rem', whiteSpace:'nowrap' }}>
                [{facingCell.row},{facingCell.col}]
              </span>
            </div>

            {/* Title */}
            {fc?.isMarket && (
              <span style={{ color:'#c4d4e0', fontSize:'0.67rem', minWidth:0 }}>
                {es?(fc.titleEs||fc.titleEn):(fc.titleEn||fc.titleEs)}
              </span>
            )}

            {/* Owner */}
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

            {/* Level req */}
            {fcReq?.minLevel > 0 && (
              <span style={{ color:'#2a4560', fontSize:'0.58rem', whiteSpace:'nowrap' }}>
                {es?`lvl≥${fcReq.minLevel}`:`lvl≥${fcReq.minLevel}`}
              </span>
            )}

            {/* Price */}
            {fc?.priceEur > 0 && (
              <span style={{ color:'#fb923c', fontSize:'0.62rem', fontWeight:600, whiteSpace:'nowrap' }}>
                {fc.priceEur} EUR
              </span>
            )}

            {/* Action buttons */}
            <div style={{ display:'flex', gap:6, marginLeft:'auto', flexWrap:'wrap', alignItems:'center' }}>
              {/* Copy hex */}
              <button onClick={()=>fcHex&&copyHex(fcHex)} style={{
                ...btnSm, color: copied?'#4ade80':C+'88', borderColor: copied?'#4ade8033':`${C}22`,
              }}>
                {copied ? '✓' : '⎘'} {fcHex}
              </button>

              {/* Mine this block (unclaimed or owned by me = re-mine not applicable, show only unclaimed) */}
              {isClaimable && (
                <Link href={mineUrl} style={{
                  ...actionLink, background:`${C}0c`, borderColor:`${C}44`, color:C,
                }}>
                  ⛏ {es?'Minar bloque':'Mine block'}
                </Link>
              )}

              {/* View on 2D board */}
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
