'use client'

import { useState, useEffect, useCallback } from 'react'

const C    = '#22d3ee'
const PASS = '#4ade80'
const WARN = '#fb923c'
const FAIL = '#ef4444'
const GRAY = '#475569'

const statusColor = s => ({ pass: PASS, warn: WARN, fail: FAIL, error: FAIL }[s] ?? GRAY)
const statusLabel = s => ({ pass: '✓ PASS', warn: '⚠ WARN', fail: '✗ FAIL', error: '✗ ERROR', running: '⟳ RUNNING' }[s] ?? s?.toUpperCase())
const scoreColor  = n => n >= 80 ? PASS : n >= 50 ? WARN : FAIL

function ScoreBadge({ score }) {
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
        <div style={{ color: GRAY, fontSize: '0.7rem', letterSpacing: '0.12em' }}>SECURITY SCORE</div>
      </div>
    </div>
  )
}

function CheckCard({ check }) {
  const [open, setOpen] = useState(false)
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
          <div style={{ color: GRAY, fontSize: '0.7rem', marginBottom: 8 }}>
            SOURCE: <span style={{ color: '#94a3b8' }}>{check.source}</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: 10 }}>{check.summary}</div>

          {check.findings?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {check.findings.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  background: '#0a1020', borderRadius: 4, padding: '6px 10px',
                  borderLeft: `3px solid ${f.status === 'fail' || f.severity === 'CRITICAL' || f.severity === 'HIGH' ? FAIL : f.status === 'present' || f.status === 'pass' ? PASS : WARN}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {f.severity && f.status !== 'present' && f.status !== 'pass' && (
                        <span style={{ color: f.severity === 'CRITICAL' || f.severity === 'HIGH' ? FAIL : WARN, fontSize: '0.65rem', fontWeight: 700 }}>
                          [{f.severity}]
                        </span>
                      )}
                      <span style={{ color: '#e2e8f0', fontSize: '0.75rem' }}>
                        {f.label || f.package || f.endpoint || f.header || f.id}
                      </span>
                      {f.version && <span style={{ color: GRAY, fontSize: '0.65rem' }}>{f.version}</span>}
                    </div>
                    {f.summary && <div style={{ color: GRAY, fontSize: '0.7rem', marginTop: 2 }}>{f.summary}</div>}
                    {f.value && <div style={{ color: GRAY, fontSize: '0.65rem', marginTop: 2, wordBreak: 'break-all' }}>{f.value}</div>}
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: C, fontSize: '0.65rem', display: 'block', marginTop: 2 }}>{f.url}</a>
                    )}
                    {f.actual != null && (
                      <div style={{ color: GRAY, fontSize: '0.65rem', marginTop: 2 }}>
                        HTTP {f.actual} (expected: {Array.isArray(f.expected) ? f.expected.join('/') : f.expected})
                      </div>
                    )}
                  </div>
                </div>
              ))}
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

  // Background
  doc.setFillColor(6, 9, 24)
  doc.rect(0, 0, W, 297, 'F')

  // Header bar
  doc.setFillColor(10, 15, 26)
  doc.rect(0, 0, W, 28, 'F')

  // Title
  setColor(cStr, 'text')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('MATHSMINE3 · SECURITY AUDIT REPORT', M, 12)

  setColor('#475569', 'text')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(`Powered by AI Security Scanner  ·  ${new Date(scan.triggered_at).toLocaleString()}  ·  Triggered by: ${scan.triggered_by?.toUpperCase()}`, M, 19)
  if (scan.duration_ms) doc.text(`Duration: ${(scan.duration_ms / 1000).toFixed(1)}s`, M, 24)

  // Score badge
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

    // Check header
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

    // Summary
    setColor('#64748b', 'text')
    doc.setFontSize(6.5)
    doc.text(check.summary ?? '', M, y)
    y += 5

    // Findings
    for (const f of (check.findings ?? []).slice(0, 15)) {
      if (y > 275) { doc.addPage(); doc.setFillColor(6, 9, 24); doc.rect(0, 0, W, 297, 'F'); y = 14 }
      const fColor = (f.status === 'fail' || f.severity === 'CRITICAL' || f.severity === 'HIGH') ? failStr
        : (f.status === 'present' || f.status === 'pass') ? passStr : warnStr
      doc.setFillColor(10, 16, 32)
      doc.rect(M, y - 2, CW, 7, 'F')
      setColor(fColor, 'text')
      doc.setFontSize(6)
      doc.setFont('helvetica', 'bold')
      const label = f.label || f.package || f.endpoint || f.id || ''
      doc.text(label.slice(0, 45), M + 1, y + 3)
      if (f.severity && f.status !== 'present' && f.status !== 'pass') {
        setColor(fColor, 'text')
        doc.text(`[${f.severity}]`, M + 90, y + 3)
      }
      if (f.summary) {
        setColor('#475569', 'text')
        doc.setFont('helvetica', 'normal')
        doc.text(f.summary.slice(0, 60), M + 1, y + 6.5)
        y += 10
      } else {
        y += 8
      }
    }
    if (check.findings?.length > 15) {
      setColor('#475569', 'text')
      doc.setFontSize(6)
      doc.text(`  ... and ${check.findings.length - 15} more findings`, M, y)
      y += 5
    }
    y += 4
  }

  // Footer
  setColor('#1e293b', 'text')
  doc.setFontSize(6)
  doc.text('MathsMine3 · AI-Powered Security Audit · mathsmine3.xyz', W / 2, 292, { align: 'center' })

  doc.save(`security-audit-${scan.id}-${new Date(scan.triggered_at).toISOString().slice(0,10)}.pdf`)
}

export default function SecurityPage() {
  const [history, setHistory]       = useState([])
  const [selected, setSelected]     = useState(null)
  const [scanning, setScanning]     = useState(false)
  const [scanMsg, setScanMsg]       = useState('')
  const [loadingId, setLoadingId]   = useState(null)

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
  }

  async function triggerScan() {
    setScanning(true)
    setScanMsg('Running security checks…')
    try {
      const res  = await fetch('/api/security/scan', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setScanMsg(`✓ Scan complete — Score ${data.score}/100`)
        await loadHistory()
        const detail = await fetch(`/api/security/history?id=${data.scanId}`)
        setSelected(await detail.json())
      } else if (data.error === 'rate_limited') {
        setScanMsg(`⏳ Rate limited — retry in ${Math.ceil(data.retryAfter / 60)} min`)
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

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ color: C, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.1em' }}>🔐 SECURITY AUDIT</span>
            <span style={{ color: GRAY, fontSize: '0.7rem', border: `1px solid ${GRAY}44`, borderRadius: 4, padding: '1px 6px' }}>AI-POWERED</span>
          </div>
          <div style={{ color: GRAY, fontSize: '0.75rem' }}>
            Automated security scans · OSV · Direct API testing · mathsmine3.xyz
          </div>
        </div>

        {/* Trigger */}
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
            {scanning ? '⟳ SCANNING…' : '▶ RUN SCAN'}
          </button>
          {scanMsg && <span style={{ color: scanMsg.startsWith('✓') ? PASS : scanMsg.startsWith('⏳') ? WARN : FAIL, fontSize: '0.78rem' }}>{scanMsg}</span>}
        </div>

        {/* History list */}
        {history.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: GRAY, fontSize: '0.65rem', letterSpacing: '0.15em', marginBottom: 8 }}>SCAN HISTORY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.map(s => {
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
                      {loadingId === s.id && <span style={{ color: C, fontSize: '0.65rem' }}>loading…</span>}
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
        )}

        {/* Detail */}
        {selected && selected.status === 'completed' && (
          <div style={{ border: `1px solid ${C}33`, borderRadius: 8, padding: 16, background: '#080d1a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ color: C, fontSize: '0.75rem', letterSpacing: '0.1em' }}>SCAN #{selected.id} DETAIL</span>
              <button
                onClick={() => exportPDF(selected)}
                style={{
                  background: `${C}11`, border: `1px solid ${C}66`, color: C,
                  padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: '0.72rem',
                }}
              >
                ↓ EXPORT PDF
              </button>
            </div>
            <ScanDetail scan={selected} />
          </div>
        )}

        {history.length === 0 && !scanning && (
          <div style={{ color: GRAY, fontSize: '0.78rem', textAlign: 'center', padding: 40, border: `1px dashed #1e293b`, borderRadius: 8 }}>
            No scans yet — press RUN SCAN to start
          </div>
        )}

        <div style={{ color: '#1e293b', fontSize: '0.6rem', textAlign: 'center', marginTop: 32 }}>
          AI-Powered Security · OSV (Google) · mathsmine3.xyz
        </div>
      </div>
    </div>
  )
}
