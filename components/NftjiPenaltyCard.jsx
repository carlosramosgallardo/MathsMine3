'use client'

import { useEffect, useRef, useState } from 'react'

const C_PENALTY = '#d946ef'
const C_GOLD    = '#facc15'
const C_AMBER   = '#fb923c'
const C_CYAN    = '#22d3ee'

function clampDigits(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 5)
}

export default function NftjiPenaltyCard({
  wallet, blockKey, blockHex, blockEmoji, blockTitleEn, blockTitleEs, blockPrice,
  isMine, es, onClose,
}) {
  const [penalty,        setPenalty]        = useState(null)
  const [activeCommand,  setActiveCommand]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [code,     setCode]     = useState('')
  const [busy,     setBusy]     = useState(false)
  const [result,   setResult]   = useState(null) // 'ok' | 'wrong' | null
  const inputRef = useRef(null)

  useEffect(() => {
    if (!wallet || !blockKey) { setLoading(false); return }
    fetch(`/api/mining-snapshot?details=1&wallet=${encodeURIComponent(wallet)}&blockKey=${encodeURIComponent(blockKey)}`)
      .then(r => r.json())
      .then(data => {
        setPenalty(data.activePenalty || null)
        setActiveCommand(data.activeBlockCommand || null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [wallet, blockKey])

  useEffect(() => {
    if (!loading && penalty && !penalty.attempted_at) {
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [loading, penalty])

  const handleRedeem = async () => {
    if (!penalty || busy || result || penalty.attempted_at) return
    const typed = clampDigits(code)
    if (typed.length < 5) return
    setBusy(true)
    try {
      const res = await fetch('/api/redeem-penalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          penaltyId: penalty.id,
          code: typed,
          blockHex,
          blockEmoji,
          language: es ? 'es' : 'en',
        }),
      })
      const data = await res.json()
      if (data.redeemed) {
        setResult('ok')
        window.dispatchEvent(new CustomEvent('mm3-toast', {
          detail: { msg: es ? 'penalización eliminada ✓' : 'penalty cleared ✓', type: 'success' },
        }))
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet, penalty: true } }))
        if (typeof localStorage !== 'undefined') localStorage.setItem('lb_dirty_at', String(Date.now()))
      } else if (data.wrong) {
        setResult('wrong')
        window.dispatchEvent(new CustomEvent('mm3-toast', {
          detail: { msg: es ? 'código incorrecto' : 'wrong code', type: 'error' },
        }))
      } else {
        setResult('wrong')
      }
    } catch {
      window.dispatchEvent(new CustomEvent('mm3-toast', {
        detail: { msg: es ? 'error de conexión' : 'connection error', type: 'error' },
      }))
    } finally {
      setBusy(false)
    }
  }

  const effectLabel = penalty?.penalty_effect === 'mm3' ? 'MM3' : 'EUR'
  const amount = penalty?.penalty_effect === 'mm3'
    ? Number(penalty?.penalty_value || 0)
    : Number(penalty?.penalty_eur || penalty?.penalty_value || 0)

  const blockTitle = es ? (blockTitleEs || blockTitleEn || '') : (blockTitleEn || blockTitleEs || '')

  const mono = { fontFamily: 'Consolas, monospace' }
  const row  = { display: 'flex', alignItems: 'center', gap: 8 }

  return (
    <div style={mono}>
      {/* ── Block header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...row, marginBottom: 4 }}>
          <span style={{ fontSize: '1.2rem' }}>{blockEmoji}</span>
          <span style={{ color: C_GOLD, fontWeight: 900, fontSize: '1.0rem', letterSpacing: '0.1em' }}>
            {blockHex}
          </span>
        </div>
        {blockTitle && (
          <div style={{ color: '#8b9aa8', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: 3 }}>
            {blockTitle}
          </div>
        )}
        {blockPrice > 0 && (
          <div style={{ color: C_AMBER, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em' }}>
            {blockPrice} EUR
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'rgba(34,211,238,0.12)', marginBottom: 14 }} />

      {/* ── Active command formula ─────────────────────────────────── */}
      {activeCommand && (
        <div style={{ marginBottom: 14, padding: '8px 10px', background: 'rgba(250,204,21,0.04)', border: '1px solid rgba(250,204,21,0.14)', borderRadius: 5 }}>
          {activeCommand.command && (
            <div style={{ color: '#78716c', fontSize: '0.62rem', letterSpacing: '0.1em', marginBottom: 5, wordBreak: 'break-all' }}>
              $ {activeCommand.command.split('=>')[0].trim()}
            </div>
          )}
          {activeCommand.formula && activeCommand.formula_x != null && (
            <>
              <div style={{ color: '#a3a3a3', fontSize: '0.62rem', letterSpacing: '0.08em', marginBottom: 3 }}>
                {es ? 'fórmula (x =' : 'formula (x ='}{' '}
                <span style={{ color: C_GOLD, fontWeight: 700 }}>{activeCommand.formula_x}</span>
                {')'}
              </div>
              <div style={{ color: C_GOLD, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', wordBreak: 'break-all', lineHeight: 1.5 }}>
                f({activeCommand.formula_x}) = {activeCommand.formula.replace(/\bx\b/g, String(activeCommand.formula_x))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Penalty section ───────────────────────────────────────── */}
      {loading ? (
        <div style={{ color: '#4a5568', fontSize: '0.68rem', letterSpacing: '0.12em', padding: '6px 0 10px' }}>
          {es ? '⟳ comprobando penalizaciones…' : '⟳ checking penalties…'}
        </div>
      ) : !penalty ? (
        <div style={{ color: '#374151', fontSize: '0.65rem', letterSpacing: '0.12em', padding: '6px 0 10px' }}>
          {es ? '· sin penalización activa en este bloque' : '· no active penalty on this block'}
        </div>
      ) : result === 'ok' ? (
        <div style={{ color: '#4ade80', fontSize: '0.82rem', letterSpacing: '0.1em', padding: '6px 0 10px' }}>
          {es ? '✓ penalización eliminada' : '✓ penalty cleared'}
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: C_PENALTY, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', marginBottom: 6 }}>
            {es ? '⚡ PENALIZACIÓN ACTIVA' : '⚡ ACTIVE PENALTY'}
          </div>
          <div style={{
            color: C_PENALTY, fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.04em', marginBottom: 10,
            textShadow: '0 0 20px rgba(217,70,239,0.7)',
          }}>
            -{amount > 0 ? (amount < 1 ? amount.toFixed(8).replace(/\.?0+$/, '') : amount.toFixed(2)) : '?'} {effectLabel}
          </div>

          {result === 'wrong' ? (
            <div style={{ color: '#ef4444', fontSize: '0.68rem', letterSpacing: '0.1em' }}>
              {es ? '✗ código incorrecto · penalización bloqueada' : '✗ wrong code · penalty locked'}
            </div>
          ) : penalty.attempted_at ? (
            <div style={{ color: '#6b7280', fontSize: '0.65rem', letterSpacing: '0.1em' }}>
              {es ? '· código ya usado en este intento' : '· code already used for this attempt'}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={code}
                onChange={e => setCode(clampDigits(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRedeem() } }}
                placeholder={es ? 'código 5 dígitos' : '5-digit code'}
                style={{
                  flex: 1,
                  background: '#08060e',
                  border: `1px solid ${C_PENALTY}44`,
                  borderRadius: 4,
                  color: C_PENALTY,
                  fontFamily: 'Consolas, monospace',
                  fontSize: '0.88rem',
                  letterSpacing: '0.22em',
                  padding: '6px 10px',
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
              <button
                type="button"
                onClick={handleRedeem}
                disabled={busy || clampDigits(code).length < 5}
                style={{
                  background: 'transparent',
                  border: `1px solid ${clampDigits(code).length === 5 ? C_PENALTY + '66' : '#1e293b'}`,
                  borderRadius: 4,
                  color: clampDigits(code).length === 5 && !busy ? C_PENALTY : '#374151',
                  fontFamily: 'Consolas, monospace',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  letterSpacing: '0.1em',
                  padding: '6px 14px',
                  cursor: clampDigits(code).length === 5 && !busy ? 'pointer' : 'not-allowed',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {busy ? '…' : 'OK'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────── */}
      <div style={{ height: 1, background: 'rgba(34,211,238,0.10)', margin: '12px 0' }} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid #1e293b',
            borderRadius: 4,
            color: '#4a5568',
            fontFamily: 'Consolas, monospace',
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            padding: '5px 10px',
            cursor: 'pointer',
          }}
        >
          {es ? 'cerrar' : 'close'}
        </button>
        {!isMine && blockPrice > 0 && (
          <a
            href={`/relaying?command=${encodeURIComponent(`/buy ${blockHex}`)}`}
            style={{
              background: 'transparent',
              border: `1px solid ${C_AMBER}44`,
              borderRadius: 4,
              color: C_AMBER,
              fontFamily: 'Consolas, monospace',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '5px 12px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            /buy {blockHex}
          </a>
        )}
        {isMine && (
          <a
            href={`/relaying?command=${encodeURIComponent(`/resell ${blockHex}`)}`}
            style={{
              background: 'transparent',
              border: '1px solid rgba(100,116,139,0.35)',
              borderRadius: 4,
              color: '#94a3b8',
              fontFamily: 'Consolas, monospace',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '5px 12px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            /resell {blockHex}
          </a>
        )}
      </div>
    </div>
  )
}
