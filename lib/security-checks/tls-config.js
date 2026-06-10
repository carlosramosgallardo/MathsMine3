import tls from 'tls'

const TLS_PORT  = 443
const WARN_DAYS = 30
const FAIL_DAYS = 7

function tlsConnect(hostname) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port: TLS_PORT, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert     = socket.getPeerCertificate(true)
        const protocol = socket.getProtocol()
        socket.destroy()
        resolve({ cert, protocol })
      }
    )
    socket.setTimeout(10000, () => { socket.destroy(); reject(new Error('TLS connect timeout')) })
    socket.on('error', reject)
  })
}

export async function runTlsConfigCheck(siteUrl) {
  const hostname = new URL(siteUrl).hostname
  const findings = []

  // 1. HTTP → HTTPS redirect
  try {
    const httpUrl = siteUrl.replace('https://', 'http://')
    const res = await fetch(httpUrl, { redirect: 'manual', signal: AbortSignal.timeout(8000) })
    const location = res.headers.get('location') || ''
    const redirects = [301, 302, 307, 308]
    if (redirects.includes(res.status) && location.startsWith('https://')) {
      findings.push({ label: 'HTTP → HTTPS redirect', status: 'pass', severity: null, detail: `HTTP ${res.status} → ${location.slice(0, 80)}` })
    } else {
      findings.push({
        label:    'HTTP → HTTPS redirect missing',
        status:   'fail', severity: 'HIGH',
        detail:   `HTTP ${res.status} — no redirect to HTTPS (Location: ${location.slice(0, 60) || 'none'})`,
        rationale: 'Requests on port 80 are served without encryption, exposing credentials and session tokens to passive network attackers.',
        attacks:  'MITM, credential theft, session hijacking over unencrypted HTTP',
      })
    }
  } catch {
    // Port 80 refused / unreachable — HTTPS-only is fine
    findings.push({ label: 'HTTP port 80 closed / unreachable (HTTPS-only)', status: 'pass', severity: null, detail: 'HTTP connection refused — server appears HTTPS-only' })
  }

  // 2. TLS handshake: protocol version + certificate
  try {
    const { cert, protocol } = await tlsConnect(hostname)

    // Protocol version
    const oldProtos = ['TLSv1', 'TLSv1.1']
    if (oldProtos.includes(protocol)) {
      findings.push({
        label:    `Deprecated TLS version negotiated: ${protocol}`,
        status:   'fail', severity: 'HIGH',
        detail:   `Server accepted ${protocol} — deprecated and cryptographically weak`,
        rationale: 'TLS 1.0 and 1.1 are vulnerable to BEAST, POODLE and downgrade attacks. Modern clients must negotiate TLS 1.2+.',
        attacks:  'BEAST (TLS 1.0), POODLE (TLS 1.0/1.1), downgrade to weak ciphers',
      })
    } else {
      findings.push({ label: `TLS version: ${protocol || 'unknown'}`, status: 'pass', severity: null, detail: `${protocol} — modern, not deprecated` })
    }

    // Certificate expiry
    const notAfter  = new Date(cert.valid_to)
    const daysLeft  = Math.floor((notAfter.getTime() - Date.now()) / 86_400_000)
    const issuerOrg = cert.issuer?.O || cert.issuer?.CN || 'unknown CA'

    if (daysLeft < 0) {
      findings.push({
        label:    `TLS certificate EXPIRED (${Math.abs(daysLeft)} days ago)`,
        status:   'fail', severity: 'CRITICAL',
        detail:   `Certificate expired ${cert.valid_to} — browsers reject this outright`,
        rationale: 'An expired certificate causes hard browser security errors for all visitors and is trivially exploitable.',
        attacks:  'Service outage, forced HTTP fallback, potential MITM if users bypass browser warnings',
      })
    } else if (daysLeft < FAIL_DAYS) {
      findings.push({
        label:    `TLS certificate expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (CRITICAL)`,
        status:   'fail', severity: 'CRITICAL',
        detail:   `Expires ${cert.valid_to} — renewal window has closed`,
        rationale: 'Imminent expiry will cause service interruption and HTTPS failures within days.',
        attacks:  'Service disruption + potential MITM window during renewal gap',
      })
    } else if (daysLeft < WARN_DAYS) {
      findings.push({
        label:    `TLS certificate expiring soon — ${daysLeft} days`,
        status:   'warn', severity: 'MEDIUM',
        detail:   `Expires ${cert.valid_to} — issued by ${issuerOrg}. Start renewal now.`,
        rationale: 'Certificate nearing expiry. Automatic renewal (e.g. Let\'s Encrypt / Vercel) should have triggered — verify it is working.',
      })
    } else {
      findings.push({ label: `TLS certificate valid — ${daysLeft} days remaining`, status: 'pass', severity: null, detail: `Valid until ${cert.valid_to} · issued by ${issuerOrg}` })
    }

    // Wildcard scope
    const san = cert.subjectaltname || ''
    if (san.includes('*.')) {
      findings.push({
        label:    'Wildcard TLS certificate in use',
        status:   'warn', severity: 'LOW',
        detail:   `SAN: ${san.slice(0, 120)}`,
        rationale: 'Wildcard certs cover all subdomains — compromise of the private key affects the entire domain. Acceptable on managed platforms but worth documenting.',
      })
    } else if (san) {
      findings.push({ label: 'Certificate scope: specific SANs (no wildcard)', status: 'pass', severity: null, detail: san.slice(0, 120) })
    }

  } catch (e) {
    findings.push({ label: 'TLS handshake error', status: 'error', severity: 'HIGH', detail: e.message?.slice(0, 80) || 'unknown', rationale: 'Unable to complete TLS handshake — certificate may be invalid or unreachable.' })
  }

  // 3. HSTS depth check
  try {
    const res = await fetch(siteUrl, { signal: AbortSignal.timeout(8000) })
    const hsts = res.headers.get('strict-transport-security')

    if (!hsts) {
      findings.push({
        label:    'HSTS header absent',
        status:   'fail', severity: 'HIGH',
        detail:   'No Strict-Transport-Security on HTTPS response',
        rationale: 'Without HSTS, browsers can be tricked into downgrading to HTTP via MITM redirects.',
        attacks:  'SSL stripping, HTTPS downgrade via first-request redirect manipulation',
      })
    } else {
      const maxAge = parseInt((hsts.match(/max-age=(\d+)/i) || [])[1] || '0')
      const hasPreload = /preload/i.test(hsts)

      if (maxAge < 31_536_000) {
        findings.push({
          label:    `HSTS max-age too short (${maxAge}s — minimum 31536000 for preload)`,
          status:   'warn', severity: 'MEDIUM',
          detail:   `Strict-Transport-Security: ${hsts}`,
          rationale: 'Short max-age means browsers discard the HSTS policy quickly, reducing the protection window.',
        })
      } else {
        findings.push({ label: `HSTS max-age: ${maxAge}s`, status: 'pass', severity: null, detail: `Strict-Transport-Security: ${hsts}` })
      }

      if (!hasPreload) {
        findings.push({
          label:    'HSTS preload directive absent',
          status:   'warn', severity: 'LOW',
          detail:   'Add preload to Strict-Transport-Security to qualify for browser HSTS preload list',
          rationale: 'Without preload, first-time visitors can still be intercepted before the HSTS policy is cached.',
        })
      } else {
        findings.push({ label: 'HSTS preload directive present', status: 'pass', severity: null, detail: 'Domain eligible for HSTS preload list submission (hstspreload.org)' })
      }
    }
  } catch {}

  const failed = findings.filter(f => f.status === 'fail').length
  const warns  = findings.filter(f => f.status === 'warn').length
  const score  = Math.max(0, 100 - failed * 20 - warns * 5)

  return {
    id:     'tls_config',
    name:   'TLS & Certificate Security',
    source: `tls.connect(${hostname}:${TLS_PORT}) · HTTP redirect · HSTS depth`,
    status: failed > 0 ? 'fail' : warns > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      hostname,
      port: TLS_PORT,
      method: 'Direct TLS handshake via Node.js tls.connect() — reads protocol version and certificate metadata without downloading data',
      checks: ['HTTP→HTTPS redirect (port 80)', 'TLS protocol version', 'Certificate expiry', 'Certificate SAN scope', 'HSTS max-age', 'HSTS preload'],
      warnThreshold:  `Certificate < ${WARN_DAYS} days to expiry, HSTS max-age < 31536000, wildcard SAN`,
      failThreshold:  `Certificate < ${FAIL_DAYS} days or expired, deprecated TLS (1.0/1.1), no HTTP redirect, no HSTS`,
    },
    summary: failed === 0 && warns === 0
      ? `TLS configuration clean — valid certificate, modern protocol, HSTS enforced`
      : `${failed} TLS issue${failed !== 1 ? 's' : ''}, ${warns} warning${warns !== 1 ? 's' : ''} — transport layer security`,
  }
}
