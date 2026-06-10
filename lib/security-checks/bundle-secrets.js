const CHUNK_FETCH_TIMEOUT = 10000
const MAX_CHUNKS         = 6    // limit to avoid timeout
const MAX_CHUNK_BYTES    = 400_000  // skip chunks > 400KB (framework bundles)

// Patterns that should never appear in client-side JS bundles
const SECRET_PATTERNS = [
  {
    id:        'eth_private_key',
    label:     'Ethereum private key (0x + 64 hex chars)',
    severity:  'CRITICAL',
    re:        /\b0x[0-9a-fA-F]{64}\b/g,
    rationale: 'Raw 256-bit Ethereum private key in client bundle — full wallet takeover possible by any visitor.',
    attacks:   'Wallet compromise, instant asset drain, unauthorized on-chain transaction signing',
    // Filter out the hardhat test key which is a known public value
    filter: m => m.toLowerCase() !== '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    note:   'Hardhat test key (0xac0974...) is excluded from scoring — it is publicly known',
  },
  {
    id:        'hardhat_private_key',
    label:     'Hardhat/Foundry test private key in bundle',
    severity:  'MEDIUM',
    re:        /0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80/gi,
    rationale: 'Known public test private key found in bundle. While the key itself is public, its presence in a production bundle suggests hardcoded key patterns.',
    attacks:   'Confirms hardcoded key anti-pattern — may co-exist with real private keys',
  },
  {
    id:        'aws_access_key',
    label:     'AWS access key ID (AKIA...)',
    severity:  'CRITICAL',
    re:        /\bAKIA[0-9A-Z]{16}\b/g,
    rationale: 'AWS IAM access key ID — with the secret access key, grants full AWS API access.',
    attacks:   'Cloud infrastructure takeover, S3 data exfiltration, EC2/Lambda abuse, cost fraud',
  },
  {
    id:        'postgres_url',
    label:     'PostgreSQL connection string with credentials',
    severity:  'CRITICAL',
    re:        /postgresql:\/\/[^:@\s"'`]{1,60}:[^@\s"'`]{4,80}@/g,
    rationale: 'Database connection string with embedded credentials in client bundle — bypasses all application-level auth.',
    attacks:   'Direct database dump, table truncation, privilege escalation, full schema access',
  },
  {
    id:        'service_role_jwt',
    label:     'Supabase service_role JWT in client bundle',
    severity:  'CRITICAL',
    re:        /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    rationale: 'Supabase service_role JWT bypasses Row Level Security on all tables — any browser visitor gets full DB admin access.',
    attacks:   'Full database read/write/delete access, RLS bypass, PII exfiltration, game economy manipulation',
    filter: match => {
      try {
        const seg = match.split('.')[1]
        const pad = seg + '='.repeat((4 - (seg.length % 4)) % 4)
        const payload = JSON.parse(Buffer.from(pad, 'base64').toString('utf8'))
        return payload.role === 'service_role'
      } catch { return false }
    },
    note: 'Only flags JWTs whose decoded payload contains "role":"service_role" — anon-key JWTs are expected and safe',
  },
  {
    id:        'server_env_leaked',
    label:     'Server-only env var name + value in bundle',
    severity:  'HIGH',
    re:        /(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY|DATABASE_URL|NEXTAUTH_SECRET|JWT_SECRET|API_SECRET|SECRET_KEY|NEXT_PRIVATE_)\s*[:=]\s*["'`][^"'`]{8,}/g,
    rationale: 'A server-side environment variable (not NEXT_PUBLIC_) with its value visible in the client bundle.',
    attacks:   'Credential exfiltration by any visitor via browser console or network tab',
  },
  {
    id:        'generic_private_key_var',
    label:     'Private key variable pattern',
    severity:  'HIGH',
    re:        /(?:privateKey|private_key|PRIVATE_KEY)\s*[:=]\s*["'`]0x[0-9a-fA-F]{40,}/g,
    rationale: 'Variable named privateKey/private_key assigned a hex value — strongly indicates a leaked Ethereum key.',
    attacks:   'Wallet takeover via hardcoded private key in JS source',
  },
]

async function fetchText(url, maxBytes = MAX_CHUNK_BYTES) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(CHUNK_FETCH_TIMEOUT) })
    if (!res.ok) return null
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
    if (contentLength > maxBytes) return null
    const text = await res.text()
    return text.length > maxBytes ? text.slice(0, maxBytes) : text
  } catch { return null }
}

function extractChunkUrls(html) {
  const pattern = /<script[^>]+src="(\/_next\/static\/[^"]+\.js)"/g
  const urls = []
  let m
  while ((m = pattern.exec(html)) !== null) {
    const url = m[1]
    // Skip large static libraries
    if (/framework|polyfills|webpack|react-dom/i.test(url)) continue
    urls.push(url)
  }
  return [...new Set(urls)].slice(0, MAX_CHUNKS)
}

function scanForSecrets(content, chunkId) {
  const hits = []
  for (const pat of SECRET_PATTERNS) {
    const matches = [...content.matchAll(pat.re)]
    for (const match of matches) {
      const raw = match[0]
      const passes = pat.filter ? pat.filter(raw) : true
      if (!passes) continue
      // Redact the value in the finding (show first 8 + ... + last 4 chars)
      const redacted = raw.length > 16
        ? raw.slice(0, 8) + '…' + raw.slice(-4)
        : raw.slice(0, 6) + '…'
      hits.push({
        patternId: pat.id,
        label:     pat.label,
        severity:  pat.severity,
        chunkId,
        redacted,
        rationale: pat.rationale,
        attacks:   pat.attacks,
      })
    }
  }
  return hits
}

export async function runBundleSecretsCheck(siteUrl) {
  const findings = []

  // 1. Fetch home page HTML
  const homeHtml = await fetchText(siteUrl, 500_000)
  if (!homeHtml) {
    return {
      id: 'bundle_secrets', name: 'Bundle Secrets Scan',
      source: `Next.js client bundle · ${siteUrl}`,
      status: 'error', score: 50,
      findings: [{ label: 'Could not fetch home page HTML', status: 'warn', severity: 'LOW', summary: 'Unable to load page for chunk extraction' }],
      probeDetails: { error: 'home page fetch failed' },
      summary: 'Could not fetch page HTML — bundle scan skipped',
    }
  }

  // Scan home page HTML itself for inline secrets
  const htmlHits = scanForSecrets(homeHtml, 'inline HTML')
  findings.push(...htmlHits.map(h => ({
    label:    `${h.label} — found in page HTML`,
    status:   'fail',
    severity: h.severity,
    chunk:    'inline HTML',
    redacted: h.redacted,
    rationale: h.rationale,
    attacks:   h.attacks,
  })))

  // 2. Extract chunk URLs from HTML
  const chunkPaths = extractChunkUrls(homeHtml)

  if (chunkPaths.length === 0) {
    findings.push({
      label:    'No app JS chunks found in HTML',
      status:   'warn',
      severity: 'LOW',
      summary:  'Could not extract chunk URLs from home page — bundle scan incomplete',
    })
  }

  // 3. Fetch and scan each chunk in parallel
  const chunkContents = await Promise.all(
    chunkPaths.map(async path => {
      const text = await fetchText(`${siteUrl}${path}`)
      return { path, text }
    })
  )

  let scannedCount = 0
  let skippedCount = 0

  for (const { path, text } of chunkContents) {
    if (!text) { skippedCount++; continue }
    scannedCount++
    const chunkId = path.split('/').pop()
    const hits    = scanForSecrets(text, chunkId)
    for (const h of hits) {
      findings.push({
        label:    `${h.label} — found in ${chunkId}`,
        status:   'fail',
        severity: h.severity,
        chunk:    h.chunkId,
        redacted: h.redacted,
        rationale: h.rationale,
        attacks:   h.attacks,
      })
    }
  }

  // 4. Summary pass finding if nothing detected
  const failed   = findings.filter(f => f.status === 'fail').length
  const critical = findings.filter(f => f.severity === 'CRITICAL').length
  const high     = findings.filter(f => f.severity === 'HIGH').length

  if (failed === 0 && scannedCount > 0) {
    findings.push({
      label:    `${scannedCount} chunks scanned — no secrets detected`,
      status:   'pass',
      severity: null,
      summary:  `Scanned ${scannedCount} app chunk${scannedCount !== 1 ? 's' : ''} for ${SECRET_PATTERNS.length} secret patterns — clean`,
    })
  }

  const score = Math.max(0, 100 - critical * 40 - high * 20 - (failed - critical - high) * 10)

  return {
    id:     'bundle_secrets',
    name:   'Bundle Secrets Scan',
    source: `Next.js client bundle · ${scannedCount} chunks · ${siteUrl}`,
    status: failed > 0 ? 'fail' : 'pass',
    score,
    findings,
    probeDetails: {
      chunksDiscovered: chunkPaths.length,
      chunksScanned:    scannedCount,
      chunksSkipped:    skippedCount,
      chunkList:        chunkPaths,
      patternsChecked:  SECRET_PATTERNS.map(p => p.id),
      maxChunkSizeBytes: MAX_CHUNK_BYTES,
      skippedChunkTypes: 'framework.js, polyfills.js, webpack.js, react-dom.js (known-safe, size-excluded)',
      note:             'Values are redacted in findings — full match not stored. service_role JWT filter decodes payload to distinguish from safe anon-key JWTs.',
      timeout:          `${CHUNK_FETCH_TIMEOUT}ms per chunk`,
    },
    summary: failed === 0
      ? `No secrets found — ${scannedCount} bundle chunk${scannedCount !== 1 ? 's' : ''} scanned clean`
      : `${failed} secret pattern${failed !== 1 ? 's' : ''} found across ${scannedCount} chunk${scannedCount !== 1 ? 's' : ''} — ${critical} critical, ${high} high`,
  }
}
