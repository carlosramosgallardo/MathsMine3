'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import { useActiveWallet } from '@/lib/use-active-wallet'
import { colorFromAddress } from '@/lib/wallet-colors'
import {
  gridToBlockHex,
  blockHexToGrid,
  MM3_BLOCK_GRID_ROWS,
  MM3_BLOCK_GRID_COLS,
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
  const channelRef = useRef(null)

  const [cellMap,     setCellMap]     = useState(new Map())
  const [myPos,       setMyPos]       = useState({ row: 14, col: 14 })
  const [presenceMap, setPresenceMap] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [onlineCount, setOnlineCount] = useState(0)
  const [viewMode,    setViewMode]    = useState('3p')  // '3p' | 'fpv'
  const [facingCell,  setFacingCell]  = useState(null)  // { row, col, cell }

  const myWallet = account?.toLowerCase() || null
  const myColor  = myWallet ? colorFromAddress(myWallet) : '#888888'

  // ── Load cell data ───────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    async function load() {
      const [{ data: mined }, { data: market }, { data: owners }] = await Promise.all([
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

  const handlePositionChange = useCallback((row, col) => setMyPos({ row, col }), [])
  const handleFacingChange   = useCallback((row, col, cell) => setFacingCell({ row, col, cell }), [])

  // Facing cell info
  const fc     = facingCell?.cell
  const fcHex  = facingCell ? gridToBlockHex(facingCell.row, facingCell.col) : null
  const fcReq  = fcHex ? MM3_BLOCK_REQUIREMENT_BY_HEX.get(fcHex) : null
  const fcOwnerColor = fc?.owner ? colorFromAddress(fc.owner) : null

  const mono = { fontFamily: 'Consolas, monospace' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#04080f', ...mono }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'8px 16px',
        borderBottom:`1px solid ${C}22`, background:'#06091a', flexShrink:0, flexWrap:'wrap',
      }}>
        <span style={{ color:C, fontWeight:700, fontSize:'0.9rem', letterSpacing:'0.12em' }}>
          🏨 {es ? 'HOTEL MM3' : 'MM3 HOTEL'}
        </span>

        <div style={{ display:'flex', gap:4, marginLeft:8 }}>
          {[
            { id:'3p',  label: es ? '👤 3ª P' : '👤 3P'  },
            { id:'fpv', label: es ? '👁 1ª P' : '👁 FPV' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setViewMode(id)} style={{
              ...btnStyle,
              ...(viewMode===id ? { borderColor:C, color:C, background:`${C}11` } : {}),
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display:'flex', gap:12, marginLeft:'auto', alignItems:'center', flexWrap:'wrap' }}>
          {onlineCount > 0 && (
            <span style={{ color:'#4ade80', fontSize:'0.65rem', letterSpacing:'0.08em' }}>
              ● {onlineCount} {es ? 'en línea' : 'online'}
            </span>
          )}
          {myWallet ? (
            <span style={{ color:myColor, fontSize:'0.65rem', border:`1px solid ${myColor}44`, borderRadius:4, padding:'2px 8px' }}>
              {myWallet.slice(0,6)}…{myWallet.slice(-4)}
            </span>
          ) : (
            <span style={{ color:'#334155', fontSize:'0.65rem' }}>
              {es ? 'conecta wallet para moverte' : 'connect wallet to move'}
            </span>
          )}
          <Link href="/mining" style={{ color:'#475569', fontSize:'0.65rem', textDecoration:'none', border:'1px solid #1e293b', borderRadius:4, padding:'2px 8px' }}>
            ← {es ? 'Tablero 2D' : '2D Board'}
          </Link>
        </div>
      </div>

      {/* ── 3D view ─────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {loading ? (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:C, fontSize:'0.75rem', letterSpacing:'0.12em' }}>
            {es ? '⟳ CARGANDO HOTEL…' : '⟳ LOADING HOTEL…'}
          </div>
        ) : (
          <MiningHotelFPV
            cellMap={cellMap}
            presenceMap={presenceMap}
            myWallet={myWallet}
            myColor={myColor}
            initRow={myPos.row}
            initCol={myPos.col}
            onPositionChange={handlePositionChange}
            onFacingChange={handleFacingChange}
            es={es}
            mode={viewMode}
          />
        )}
      </div>

      {/* ── Facing cell info panel ────────────────────────────────────────── */}
      <div style={{
        flexShrink:0, borderTop:`1px solid ${C}18`, background:'#060c18',
        padding:'8px 16px', minHeight:54, display:'flex', alignItems:'center',
        gap:14, flexWrap:'wrap',
      }}>
        {facingCell ? (
          <>
            {/* Hex + emoji */}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              {fc?.emoji && <span style={{ fontSize:'1.2rem' }}>{fc.emoji}</span>}
              <span style={{ color: fc?.color||C, fontWeight:700, fontSize:'0.72rem', letterSpacing:'0.08em' }}>
                {fcHex}
              </span>
              <span style={{ color:'#1e3a50', fontSize:'0.6rem' }}>
                [{facingCell.row},{facingCell.col}]
              </span>
            </div>

            {/* Title */}
            {fc?.isMarket && (
              <span style={{ color:'#cbd5e1', fontSize:'0.68rem' }}>
                {es ? (fc.titleEs||fc.titleEn) : (fc.titleEn||fc.titleEs)}
              </span>
            )}

            {/* Owner */}
            {fc?.owner ? (
              <span style={{
                color: fcOwnerColor, fontSize:'0.63rem',
                border:`1px solid ${fcOwnerColor}33`, borderRadius:3, padding:'1px 6px',
              }}>
                {fc.owner.slice(0,8)}…{fc.owner.slice(-5)}
              </span>
            ) : (
              <span style={{ color:'#1e3a50', fontSize:'0.63rem' }}>
                {es ? 'sin reclamar' : 'unclaimed'}
              </span>
            )}

            {/* Level req */}
            {fcReq && (
              <span style={{ color:'#334155', fontSize:'0.6rem' }}>
                {es ? `nivel mín. ${fcReq.minLevel}` : `min level ${fcReq.minLevel}`}
              </span>
            )}

            {/* Price */}
            {fc?.priceEur > 0 && (
              <span style={{ color:'#fb923c', fontSize:'0.63rem', fontWeight:600 }}>
                {fc.priceEur} EUR
              </span>
            )}

            {/* Action link */}
            <Link href="/mining" style={{
              marginLeft:'auto', display:'inline-flex', alignItems:'center', gap:5,
              color:C, fontSize:'0.65rem', textDecoration:'none',
              border:`1px solid ${C}33`, borderRadius:4, padding:'4px 12px',
              background:`${C}08`, letterSpacing:'0.07em',
              whiteSpace:'nowrap',
            }}>
              ⛏ {es ? 'Abrir en tablero' : 'Open in board'}
            </Link>
          </>
        ) : (
          <span style={{ color:'#1e3a50', fontSize:'0.62rem', letterSpacing:'0.1em' }}>
            {es
              ? 'MUÉVETE CON WASD O LAS FLECHAS · APUNTA A UNA SALA PARA VER SU INFO'
              : 'MOVE WITH WASD OR ARROWS · AIM AT A ROOM TO SEE ITS INFO'}
          </span>
        )}
      </div>
    </div>
  )
}

const btnStyle = {
  background:'transparent', border:'1px solid #1e293b', color:'#475569',
  padding:'2px 8px', borderRadius:4, cursor:'pointer',
  fontFamily:'Consolas, monospace', fontSize:'0.7rem',
}
