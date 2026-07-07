'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '@/lib/i18n-context'

const C    = '#22d3ee'
const PASS = '#4ade80'
const WARN = '#fb923c'
const FAIL = '#ef4444'
const GRAY = '#94a3b8'
const DIM  = '#71839a'

const statusColor = s => ({ pass: PASS, warn: WARN, fail: FAIL, error: FAIL }[s] ?? GRAY)
const statusLabel = s => ({ pass: '✓ PASS', warn: '⚠ WARN', fail: '✗ FAIL', error: '✗ ERROR', running: '⟳ RUNNING' }[s] ?? s?.toUpperCase())
const scoreColor  = n => n >= 80 ? PASS : n >= 50 ? WARN : FAIL
const sevColor    = s => ({ CRITICAL: FAIL, HIGH: FAIL, MEDIUM: WARN, LOW: GRAY }[s] ?? GRAY)

function ScoreBadge({ score }) {
  const { language } = useI18n()
  const es = language === 'es'
  const color = scoreColor(score)
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 50 ? 'D' : 'F'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        border: `3px solid ${color}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 18px ${color}55`,
      }}>
        <span style={{ color, fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>{grade}</span>
      </div>
      <div>
        <div style={{ color, fontSize: '2rem', fontWeight: 700 }}>{score}<span style={{ fontSize: '1rem', color: GRAY }}>/100</span></div>
        <div style={{ color: GRAY, fontSize: '0.7rem', letterSpacing: '0.12em' }}>{es ? 'PUNTUACIÓN DE SEGURIDAD' : 'SECURITY SCORE'}</div>
      </div>
    </div>
  )
}

function ProbePanel({ probe }) {
  if (!probe) return null
  const entries = Object.entries(probe).filter(([, v]) => v !== null && v !== undefined)
  return (
    <div style={{ background: '#020608', border: `1px solid ${DIM}`, borderRadius: 4, padding: '8px 10px', marginTop: 4 }}>
      {entries.map(([key, val]) => {
        const display = Array.isArray(val)
          ? val.map((v, i) => (
              <div key={i} style={{ color: '#64748b', fontSize: '0.62rem', paddingLeft: 8, marginTop: 1 }}>
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </div>
            ))
          : typeof val === 'object'
            ? <span style={{ color: '#64748b' }}>{JSON.stringify(val)}</span>
            : <span style={{ color: '#94a3b8' }}>{String(val)}</span>
        return (
          <div key={key} style={{ display: 'flex', gap: 6, marginBottom: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <span style={{ color: C, fontSize: '0.62rem', fontWeight: 600, minWidth: 110, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.62rem', flex: 1, wordBreak: 'break-all' }}>
              {display}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function FindingRow({ f }) {
  const [open, setOpen] = useState(false)
  const borderColor = f.status === 'fail' || f.severity === 'CRITICAL' || f.severity === 'HIGH'
    ? FAIL : f.status === 'present' || f.status === 'pass' ? PASS : WARN

  const hasExtra = f.rationale || f.attacks || f.recommended || f.aliases?.length ||
    f.cvss || f.fixedIn || f.affectedRange || f.responsePreview || f.requestBody != null

  return (
    <div style={{ background: '#0a1020', borderRadius: 4, borderLeft: `3px solid ${borderColor}`, overflow: 'hidden' }}>
      <div
        style={{ padding: '6px 10px', cursor: hasExtra ? 'pointer' : 'default' }}
        onClick={() => hasExtra && setOpen(o => !o)}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {f.severity && f.status !== 'present' && f.status !== 'pass' && (
            <span style={{ color: sevColor(f.severity), fontSize: '0.62rem', fontWeight: 700, border: `1px solid ${sevColor(f.severity)}44`, borderRadius: 3, padding: '0 4px' }}>
              {f.severity}
            </span>
          )}
          {(f.status === 'pass' || f.status === 'present') && (
            <span style={{ color: PASS, fontSize: '0.62rem', fontWeight: 700 }}>✓</span>
          )}
          <span style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 600 }}>
            {f.label || f.package || f.endpoint || f.header || f.id}
          </span>
          {f.version && <span style={{ color: GRAY, fontSize: '0.65rem' }}>v{f.version}</span>}
          {f.cvss && <span style={{ color: sevColor(f.severity), fontSize: '0.62rem' }}>CVSS {f.cvss}</span>}
          {f.fixedIn && <span style={{ color: PASS, fontSize: '0.62rem' }}>fix: v{f.fixedIn}</span>}
          {f.scoreImpact && <span style={{ color: FAIL, fontSize: '0.62rem', marginLeft: 'auto' }}>{f.scoreImpact}</span>}
          {f.responseMs > 0 && (
            <span style={{ color: GRAY, fontSize: '0.62rem', marginLeft: 'auto' }}>{f.responseMs}ms</span>
          )}
          {hasExtra && <span style={{ color: GRAY, fontSize: '0.6rem', marginLeft: 4 }}>{open ? '▲' : '▼'}</span>}
        </div>
        {f.summary && <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 2 }}>{f.summary}</div>}
        {f.value && <div style={{ color: '#475569', fontSize: '0.63rem', marginTop: 2, wordBreak: 'break-all', fontStyle: 'italic' }}>{f.value}</div>}
        {f.actual != null && (
          <div style={{ color: GRAY, fontSize: '0.63rem', marginTop: 2 }}>
            HTTP <span style={{ color: f.status === 'pass' ? PASS : FAIL }}>{f.actual}</span>
            {' '}(expected: <span style={{ color: '#94a3b8' }}>{Array.isArray(f.expected) ? f.expected.join(' / ') : f.expected}</span>)
          </div>
        )}
        {f.aliases?.length > 0 && (
          <div style={{ color: GRAY, fontSize: '0.63rem', marginTop: 2 }}>
            CVE: {f.aliases.join(', ')}
          </div>
        )}
        {f.url && (
          <a href={f.url} target="_blank" rel="noopener noreferrer"
            style={{ color: C, fontSize: '0.62rem', display: 'block', marginTop: 2 }} onClick={e => e.stopPropagation()}>
            {f.url}
          </a>
        )}
      </div>

      {open && hasExtra && (
        <div style={{ background: '#060c18', borderTop: `1px solid ${DIM}`, padding: '6px 10px' }}>
          {f.rationale && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: C, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em' }}>WHY IT MATTERS · </span>
              <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{f.rationale}</span>
            </div>
          )}
          {f.attacks && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: FAIL, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em' }}>ATTACK VECTORS · </span>
              <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{f.attacks}</span>
            </div>
          )}
          {f.recommended && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: PASS, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em' }}>RECOMMENDED · </span>
              <span style={{ color: '#64748b', fontSize: '0.63rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{f.recommended}</span>
            </div>
          )}
          {f.affectedRange && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: WARN, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em' }}>AFFECTED RANGE · </span>
              <span style={{ color: '#94a3b8', fontSize: '0.63rem', fontFamily: 'monospace' }}>{f.affectedRange}</span>
            </div>
          )}
          {f.requestBody !== null && f.requestBody !== undefined && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: GRAY, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em' }}>REQUEST BODY · </span>
              <span style={{ color: '#64748b', fontSize: '0.63rem', fontFamily: 'monospace' }}>{f.requestBody || '(none)'}</span>
            </div>
          )}
          {f.responsePreview && (
            <div>
              <span style={{ color: GRAY, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em' }}>RESPONSE PREVIEW · </span>
              <span style={{ color: '#64748b', fontSize: '0.63rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{f.responsePreview}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CheckCard({ check }) {
  const [open, setOpen]         = useState(false)
  const [showProbe, setShowProbe] = useState(false)
  const color = statusColor(check.status)
  return (
    <div style={{ border: `1px solid ${color}44`, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: '#0a0f1a', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', color: '#cbd5e1', fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color, fontWeight: 700, minWidth: 70, fontSize: '0.75rem' }}>{statusLabel(check.status)}</span>
          <span style={{ color: C, fontSize: '0.85rem' }}>{check.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: scoreColor(check.score ?? 0), fontSize: '0.8rem' }}>{check.score ?? 0}/100</span>
          <span style={{ color: GRAY, fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ background: '#060c18', padding: '10px 14px', borderTop: `1px solid ${color}33` }}>
          <div style={{ color: GRAY, fontSize: '0.7rem', marginBottom: 6 }}>
            SOURCE: <span style={{ color: '#94a3b8' }}>{check.source}</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: 10 }}>{check.summary}</div>

          {check.probeDetails && (
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setShowProbe(o => !o)}
                style={{
                  background: 'transparent', border: `1px solid ${DIM}`, borderRadius: 4,
                  color: GRAY, fontFamily: 'monospace', fontSize: '0.62rem', cursor: 'pointer',
                  padding: '3px 8px', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ color: C }}>⌥</span> PROBE METHODOLOGY {showProbe ? '▲' : '▼'}
              </button>
              {showProbe && <ProbePanel probe={check.probeDetails} />}
            </div>
          )}

          {check.findings?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {check.findings.map((f, i) => <FindingRow key={i} f={f} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScanDetail({ scan }) {
  if (!scan?.results?.checks) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <ScoreBadge score={scan.score ?? 0} />
        <div style={{ color: GRAY, fontSize: '0.72rem', fontFamily: 'monospace', textAlign: 'right' }}>
          <div>{new Date(scan.triggered_at).toLocaleString()}</div>
          <div>BY: <span style={{ color: '#94a3b8' }}>{scan.triggered_by?.toUpperCase()}</span></div>
          {scan.duration_ms && <div>DURATION: <span style={{ color: '#94a3b8' }}>{(scan.duration_ms / 1000).toFixed(1)}s</span></div>}
        </div>
      </div>
      {scan.results.checks.map(c => <CheckCard key={c.id} check={c} />)}
    </div>
  )
}

async function exportPDF(scan) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W = 210, M = 14, CW = W - M * 2
  const cStr = '#22d3ee', passStr = '#4ade80', warnStr = '#fb923c', failStr = '#ef4444'

  const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255] }
  const setColor = (h, type = 'text') => { const [r,g,b] = hex2rgb(h); type === 'text' ? doc.setTextColor(r,g,b) : doc.setFillColor(r,g,b) }

  doc.setFillColor(6, 9, 24)
  doc.rect(0, 0, W, 297, 'F')
  doc.setFillColor(10, 15, 26)
  doc.rect(0, 0, W, 28, 'F')

  setColor(cStr, 'text')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('MATHSMINE3 · SECURITY AUDIT REPORT', M, 12)

  setColor('#475569', 'text')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(`Powered by AI Security Scanner  ·  ${new Date(scan.triggered_at).toLocaleString()}  ·  Triggered by: ${scan.triggered_by?.toUpperCase()}`, M, 19)
  if (scan.duration_ms) doc.text(`Duration: ${(scan.duration_ms / 1000).toFixed(1)}s  ·  Scan #${scan.id}`, M, 24)

  const grade = (scan.score ?? 0) >= 90 ? 'A' : (scan.score ?? 0) >= 80 ? 'B' : (scan.score ?? 0) >= 70 ? 'C' : (scan.score ?? 0) >= 50 ? 'D' : 'F'
  const scoreHex = (scan.score ?? 0) >= 80 ? passStr : (scan.score ?? 0) >= 50 ? warnStr : failStr
  setColor(scoreHex, 'text')
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(`${scan.score}/100`, W - M - 26, 12)
  doc.setFontSize(12)
  doc.text(`Grade: ${grade}`, W - M - 26, 22)

  let y = 36

  const checks = scan.results?.checks ?? []
  for (const check of checks) {
    const color = check.status === 'pass' ? passStr : check.status === 'warn' ? warnStr : failStr

    if (y > 260) { doc.addPage(); doc.setFillColor(6, 9, 24); doc.rect(0, 0, W, 297, 'F'); y = 14 }

    doc.setFillColor(10, 15, 26)
    doc.rect(M - 2, y - 3, CW + 4, 9, 'F')
    setColor(color, 'text')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(statusLabel(check.status), M, y + 3)
    setColor(cStr, 'text')
    doc.text(check.name, M + 22, y + 3)
    setColor('#94a3b8', 'text')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`${check.score ?? 0}/100`, W - M, y + 3, { align: 'right' })
    y += 10

    setColor('#64748b', 'text')
    doc.setFontSize(6.5)
    const summaryLines = doc.splitTextToSize(check.summary ?? '', CW)
    doc.text(summaryLines, M, y)
    y += summaryLines.length * 4 + 2

    // Source line
    setColor('#334155', 'text')
    doc.setFontSize(5.5)
    doc.text(`SOURCE: ${check.source ?? ''}`, M, y)
    y += 5

    for (const f of (check.findings ?? []).slice(0, 20)) {
      if (y > 275) { doc.addPage(); doc.setFillColor(6, 9, 24); doc.rect(0, 0, W, 297, 'F'); y = 14 }
      const fColor = (f.status === 'fail' || f.severity === 'CRITICAL' || f.severity === 'HIGH') ? failStr
        : f.severity === 'MEDIUM' ? warnStr
        : (f.status === 'present' || f.status === 'pass') ? passStr : warnStr
      doc.setFillColor(10, 16, 32)
      doc.rect(M, y - 2, CW, f.rationale ? 14 : 7, 'F')
      setColor(fColor, 'text')
      doc.setFontSize(6)
      doc.setFont('helvetica', 'bold')
      const label = (f.label || f.package || f.endpoint || f.id || '').slice(0, 55)
      doc.text(label, M + 1, y + 3)
      if (f.severity && f.status !== 'present' && f.status !== 'pass') {
        doc.text(`[${f.severity}]`, M + 105, y + 3)
      }
      if (f.cvss) {
        setColor('#94a3b8', 'text')
        doc.text(`CVSS ${f.cvss}`, M + 125, y + 3)
      }
      if (f.fixedIn) {
        setColor(passStr, 'text')
        doc.text(`fix: v${f.fixedIn}`, M + 145, y + 3)
      }
      if (f.summary) {
        setColor('#475569', 'text')
        doc.setFont('helvetica', 'normal')
        doc.text(f.summary.slice(0, 80), M + 1, y + 6.5)
        y += f.rationale ? 12 : 10
      } else {
        y += f.rationale ? 10 : 8
      }
      if (f.rationale) {
        setColor('#334155', 'text')
        doc.setFontSize(5.5)
        const rLines = doc.splitTextToSize(`⚡ ${f.rationale}`, CW - 2)
        doc.text(rLines.slice(0, 2), M + 1, y - 4)
        y += 2
      }
      if (f.attacks) {
        setColor('#3d1515', 'text')
        doc.setFontSize(5)
        doc.text(`Attacks: ${f.attacks.slice(0, 90)}`, M + 1, y - 2)
        y += 2
      }
    }
    if (check.findings?.length > 20) {
      setColor('#475569', 'text')
      doc.setFontSize(6)
      doc.text(`  ... and ${check.findings.length - 20} more findings`, M, y)
      y += 5
    }
    y += 6
  }

  setColor('#1e293b', 'text')
  doc.setFontSize(6)
  doc.text('MathsMine3 Security Audit · mathsmine3.xyz · Scoped exclusively to mathsmine3.xyz — no third parties targeted', W / 2, 292, { align: 'center' })

  doc.save(`security-audit-${scan.id}-${new Date(scan.triggered_at).toISOString().slice(0,10)}.pdf`)
}

const PAGE_SIZE = 5

export default function SecurityPage() {
  const { language } = useI18n()
  const es = language === 'es'
  const [history, setHistory]     = useState([])
  const [selected, setSelected]   = useState(null)
  const [scanning, setScanning]   = useState(false)
  const [scanMsg, setScanMsg]     = useState('')
  const [loadingId, setLoadingId] = useState(null)
  const [histPage, setHistPage]   = useState(0)
  const detailRef                 = useRef(null)

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/security/history')
    const data = await res.json()
    if (Array.isArray(data)) setHistory(data)
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function loadDetail(id) {
    if (selected?.id === id) { setSelected(null); return }
    setLoadingId(id)
    const res  = await fetch(`/api/security/history?id=${id}`)
    const data = await res.json()
    setSelected(data)
    setLoadingId(null)
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  async function triggerScan() {
    setScanning(true)
    setScanMsg(es ? 'Ejecutando comprobaciones de seguridad…' : 'Running security checks…')
    try {
      const res  = await fetch('/api/security/scan', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setScanMsg(es ? `✓ Análisis completado — Puntuación ${data.score}/100` : `✓ Scan complete — Score ${data.score}/100`)
        await loadHistory()
        setHistPage(0)
        const detail = await fetch(`/api/security/history?id=${data.scanId}`)
        setSelected(await detail.json())
        setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
      } else if (data.error === 'rate_limited') {
        setScanMsg(es ? `⏳ Límite de velocidad — reintenta en ${Math.ceil(data.retryAfter / 60)} min` : `⏳ Rate limited — retry in ${Math.ceil(data.retryAfter / 60)} min`)
      } else {
        setScanMsg(`✗ Error: ${data.error}`)
      }
    } catch (e) {
      setScanMsg(`✗ ${e.message}`)
    }
    setScanning(false)
  }

  const mono = { fontFamily: 'monospace' }

  return (
    <div style={{ ...mono, background: '#060918', minHeight: '100vh', color: '#cbd5e1', padding: '24px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ color: C, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.1em' }}>{es ? '🔐 AUDITORÍA DE SEGURIDAD' : '🔐 SECURITY AUDIT'}</span>
          </div>
          <div style={{ color: GRAY, fontSize: '0.72rem', lineHeight: '1.7' }}>
            {es ? 'Auditoría de seguridad automatizada dirigida exclusivamente a' : 'Automated security audit scoped exclusively to'}{' '}
            <a href="https://mathsmine3.xyz/" target="_blank" rel="noopener noreferrer" style={{ color: C }}>mathsmine3.xyz</a>
            {es ? ' y su código fuente en ' : ' and its open-source codebase at '}
            <a href="https://github.com/carlosramosgallardo/MathsMine3" target="_blank" rel="noopener noreferrer" style={{ color: C }}>github.com/carlosramosgallardo/MathsMine3</a>.
            {' '}{es
              ? 'No se apunta a sistemas de terceros, APIs externas ni infraestructura ajena. Las 20 comprobaciones son peticiones HTTP de solo lectura, handshakes TLS y análisis estático — sin operaciones destructivas, sin fuerza bruta, sin ataques a credenciales, sin intentos de denegación de servicio.'
              : 'No third-party systems, external APIs, or unrelated infrastructure are targeted at any point. All 20 checks are read-only HTTP requests, TLS handshakes, and static analysis — no destructive operations, no brute-force, no credential attacks, no denial-of-service attempts.'}
          </div>
          <div style={{ color: '#71839a', fontSize: '0.65rem', marginTop: 6, lineHeight: '1.6' }}>
            {es
              ? <>Comprobaciones: TLS &amp; certificado · cabeceras de seguridad HTTP · análisis CSP · autenticación API (61 endpoints) · firma de wallet Web3 · CVEs de dependencias (OSV/Google) · escaneo de secretos en bundle · inyección &amp; contaminación de prototipo · lógica de negocio · divulgación de errores · inyección de host · SRI · rutas sensibles · redirección abierta · CORS · limitación de velocidad · salud de página (16 páginas) · puntuación 0–100 · exportación PDF</>
              : <>Checks: TLS &amp; certificate · HTTP security headers · CSP deep analysis · API auth (61 endpoints) · Web3 wallet signature · dependency CVEs (OSV/Google) · client bundle secret scan · injection &amp; prototype pollution · business logic probes · error disclosure · host injection · SRI · sensitive paths · open redirect · CORS · rate limiting · page health (16 pages) · results scored 0–100 · PDF export</>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            onClick={triggerScan}
            disabled={scanning}
            style={{
              background: scanning ? '#1e293b' : `${C}22`,
              border: `1px solid ${scanning ? GRAY : C}`,
              color: scanning ? GRAY : C,
              padding: '8px 20px', borderRadius: 6, cursor: scanning ? 'not-allowed' : 'pointer',
              fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '0.08em',
              transition: 'all 0.2s',
            }}
          >
            {scanning ? (es ? '⟳ ANALIZANDO…' : '⟳ SCANNING…') : (es ? '▶ EJECUTAR ANÁLISIS' : '▶ RUN SCAN')}
          </button>
          {scanMsg && <span style={{ color: scanMsg.startsWith('✓') ? PASS : scanMsg.startsWith('⏳') ? WARN : FAIL, fontSize: '0.78rem' }}>{scanMsg}</span>}
        </div>

        {history.length > 0 && (() => {
          const totalPages = Math.ceil(history.length / PAGE_SIZE)
          const page       = Math.min(histPage, totalPages - 1)
          const pageItems  = history.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
          return (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <div style={{ color: GRAY, fontSize: '0.65rem', letterSpacing: '0.15em' }}>
                  {es ? 'HISTORIAL DE ANÁLISIS' : 'SCAN HISTORY'}
                  <span style={{ color: DIM, marginLeft: 8 }}>({history.length} total)</span>
                </div>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => setHistPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      style={{ background: 'transparent', border: `1px solid ${page === 0 ? DIM : GRAY + '66'}`, color: page === 0 ? DIM : GRAY, padding: '2px 8px', borderRadius: 4, cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'monospace', fontSize: '0.65rem' }}
                    >{es ? '← ant' : '← prev'}</button>
                    <span style={{ color: GRAY, fontSize: '0.65rem', minWidth: 60, textAlign: 'center' }}>
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setHistPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page === totalPages - 1}
                      style={{ background: 'transparent', border: `1px solid ${page === totalPages - 1 ? DIM : GRAY + '66'}`, color: page === totalPages - 1 ? DIM : GRAY, padding: '2px 8px', borderRadius: 4, cursor: page === totalPages - 1 ? 'default' : 'pointer', fontFamily: 'monospace', fontSize: '0.65rem' }}
                    >{es ? 'sig →' : 'next →'}</button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pageItems.map(s => {
                  const isSelected = selected?.id === s.id
                  const color = s.status === 'completed' ? scoreColor(s.score ?? 0) : s.status === 'running' ? C : GRAY
                  return (
                    <div key={s.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: isSelected ? '#0a1628' : '#080d1a',
                        border: `1px solid ${isSelected ? color + '88' : '#1e293b'}`,
                        borderRadius: 6, padding: '8px 12px', flexWrap: 'wrap', gap: 8,
                        cursor: 'pointer', transition: 'border-color 0.2s',
                      }}
                    >
                      <div onClick={() => loadDetail(s.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ color, fontWeight: 700, fontSize: '0.75rem', minWidth: 42 }}>
                          {s.status === 'completed' ? `${s.score}/100` : statusLabel(s.status)}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                          {new Date(s.triggered_at).toLocaleString()}
                        </span>
                        <span style={{ color: GRAY, fontSize: '0.65rem', border: `1px solid #1e293b`, borderRadius: 3, padding: '1px 5px' }}>
                          {s.triggered_by}
                        </span>
                        {s.summary && <span style={{ color: GRAY, fontSize: '0.65rem' }}>{s.summary}</span>}
                        {loadingId === s.id && <span style={{ color: C, fontSize: '0.65rem' }}>{es ? 'cargando…' : 'loading…'}</span>}
                      </div>
                      {s.status === 'completed' && (
                        <button
                          onClick={async e => { e.stopPropagation(); const d = selected?.id === s.id ? selected : await fetch(`/api/security/history?id=${s.id}`).then(r => r.json()); exportPDF(d) }}
                          style={{
                            background: 'transparent', border: `1px solid ${GRAY}66`, color: GRAY,
                            padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                            fontFamily: 'monospace', fontSize: '0.65rem',
                          }}
                        >
                          ↓ PDF
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {selected && selected.status === 'completed' && (
          <div ref={detailRef} style={{ border: `1px solid ${C}33`, borderRadius: 8, padding: 16, background: '#080d1a', scrollMarginTop: 80 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ color: C, fontSize: '0.75rem', letterSpacing: '0.1em' }}>{es ? `ANÁLISIS #${selected.id} DETALLE` : `SCAN #${selected.id} DETAIL`}</span>
              <button
                onClick={() => exportPDF(selected)}
                style={{
                  background: `${C}11`, border: `1px solid ${C}66`, color: C,
                  padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: '0.72rem',
                }}
              >
                {es ? '↓ EXPORTAR PDF' : '↓ EXPORT PDF'}
              </button>
            </div>
            <ScanDetail scan={selected} />
          </div>
        )}

        {history.length === 0 && !scanning && (
          <div style={{ color: GRAY, fontSize: '0.78rem', textAlign: 'center', padding: 40, border: `1px dashed #1e293b`, borderRadius: 8 }}>
            {es ? 'Sin análisis aún — pulsa EJECUTAR ANÁLISIS para comenzar' : 'No scans yet — press RUN SCAN to start'}
          </div>
        )}

        <div style={{ color: DIM, fontSize: '0.6rem', textAlign: 'center', marginTop: 32 }}>
          {es ? 'Exclusivo a mathsmine3.xyz · OSV (Google) · Sin terceros afectados · Solo lectura' : 'Scoped to mathsmine3.xyz only · OSV (Google) · No third parties targeted · Read-only probes'}
        </div>
      </div>
    </div>
  )
}
