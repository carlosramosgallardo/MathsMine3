'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { getDiceWindowForHour } from '@/lib/dice'
import { formatWalletLabel } from '@/lib/wallet-format'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

const C    = '#22d3ee'
const UP   = '#4ade80'
const DN   = '#f97316'
const RANGES = ['1h', '24h', '7d', '30d', '360d', 'all']

const CHART_FILTER_KEYS = ['dice', 'mining', 'trading', 'squeeze', 'relaying']
const DEFAULT_CHART_FILTERS = { dice: true, mining: true, trading: true, squeeze: true, market: true, relaying: true }
const CHART_FILTER_LABELS = { dice: 'dice', mining: 'mining', trading: 'trading', squeeze: 'squeezing', market: 'market', relaying: 'relaying' }

function chartEventCategory(ev) {
  const emoji = ev.emoji
  const et = ev.event_type
  if (et === 'relaying' || emoji === '🔁') return 'relaying'
  if (emoji === '⚔️' || emoji === '🔰') return 'squeeze'
  if (emoji === '📈' || emoji === '📉') return 'trading'
  return 'mining'
}

// negative modifier = cheaper commissions (good for miners) → cyan (distinct from UP green)
// positive modifier = pricier commissions (bad for miners)  → amber (distinct from DN orange)
const chartDiceColor = (mod) => mod < 0 ? C : '#fb923c'

function lastMinuteKey(dataArr) {
  return dataArr.length ? dataArr[dataArr.length - 1].time : null
}

function visibleMinuteKey(timeStr, dataArr) {
  return dataArr.some(d => d.time === timeStr) ? timeStr : null
}

function visibleMinuteBoundary(dataArr, timeStr, direction = 'after') {
  if (!dataArr.length || !timeStr) return null
  const [targetHour, targetMinute] = timeStr.split(':').map(Number)
  if (!Number.isFinite(targetHour) || !Number.isFinite(targetMinute)) return null
  const rawTarget = targetHour * 60 + targetMinute
  let offset = 0
  let previous = null
  const points = dataArr.map((d) => {
    const [hour, minute] = String(d.time || '').split(':').map(Number)
    let value = hour * 60 + minute + offset
    if (previous != null && value < previous) {
      offset += 1440
      value += 1440
    }
    previous = value
    return { key: d.time, value }
  })
  const middle = (points[0].value + points[points.length - 1].value) / 2
  const target = [rawTarget - 1440, rawTarget, rawTarget + 1440]
    .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0]
  const match = direction === 'before'
    ? [...points].reverse().find(point => point.value <= target)
    : points.find(point => point.value >= target)
  return match?.key ?? null
}

function setIfChanged(setter, next) {
  setter(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
}

function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

function sourceDeltas(row = {}) {
  const mined_delta = parseFloat(row.mined_delta || 0)
  const trade_delta = parseFloat(row.trade_delta || 0)
  const trade_wallet_count = parseInt(row.trade_wallet_count || 0, 10)
  const trade_google_count = parseInt(row.trade_google_count || 0, 10)
  const nftmoji_delta = parseFloat(row.nftmoji_delta || 0)
  const market_delta = parseFloat(row.market_delta || 0)
  return { mined_delta, trade_delta, trade_wallet_count, trade_google_count, nftmoji_delta, market_delta }
}

function formatTradeSourceCounts(walletCount, googleCount, t) {
  const parts = []
  if (walletCount > 0) parts.push(`${walletCount}W`)
  if (googleCount > 0) parts.push(`${googleCount}G`)
  return parts.length ? ` (${parts.join(` ${t('chart.countJoin')} `)})` : ''
}

const RANGE_MS = { '1h': 36e5, '24h': 864e5, '7d': 6048e5, '30d': 2592e6, '360d': 360 * 864e5 }

// Count dice rolls whose startMs falls within [max(nowMs-rangeMs, dataStartMs), nowMs]
// expected = total rolls when the full range is covered (rangeMs / 1h)
// count    = only actually-started rolls within the real data period
function getDiceRollStats(rangeMs, nowMs, dataStartMs = 0) {
  const nowHour       = Math.floor(nowMs / 3_600_000) * 3_600_000
  const rangeStart    = nowMs - rangeMs
  const effectiveStart = dataStartMs > 0 ? Math.max(rangeStart, dataStartMs) : rangeStart
  const expected      = Math.round(rangeMs / 3_600_000)
  const hoursBack     = expected + 2
  let count = 0, sum = 0
  for (let i = 0; i <= hoursBack; i++) {
    const win = getDiceWindowForHour(nowHour - i * 3_600_000)
    if (win.startMs >= effectiveStart && win.startMs <= nowMs) { count++; sum += win.modifier }
  }
  return { count, expected, net: count > 0 ? Math.round((sum / count) * 100) : 0 }
}

function emojiColor(emoji) {
  if (emoji === '🧿') return '#c084fc'
  if (emoji === '🎰') return '#f59e0b'
  if (emoji === '🍀') return UP
  if (emoji === '❤️') return '#ef4444'
  if (emoji === '⚔️') return '#f97316'
  if (emoji === '🔰') return '#3b82f6'
  if (emoji === '📈') return '#22c55e'
  if (emoji === '📉') return '#f43f5e'
  return C
}

function groupColor(evts) {
  if (evts.some(e => e.emoji === '🧿')) return '#c084fc'
  if (evts.some(e => e.emoji === '🎰')) return '#f59e0b'
  if (evts.some(e => e.emoji === '❤️')) return '#ef4444'
  if (evts.some(e => e.emoji === '🍀')) return UP
  if (evts.some(e => e.emoji === '⚔️')) return '#f97316'
  if (evts.some(e => e.emoji === '🔰')) return '#3b82f6'
  if (evts.some(e => e.emoji === '📈')) return '#22c55e'
  if (evts.some(e => e.emoji === '📉')) return '#f43f5e'
  return C
}

const BOT_WALLET_ADDRS = new Set([
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233',
  '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab',
])

function WalletTag({ wallet, className = '' }) {
  const addr = String(wallet || '').toLowerCase()
  const short = formatWalletLabel(addr)
  if (!short) return <span className={className}>—</span>
  if (BOT_WALLET_ADDRS.has(addr)) {
    return (
      <>
        <span className={className}>{short}</span>
        <span className="text-slate-600 text-[0.65em] uppercase tracking-wider ml-0.5">(bot)</span>
      </>
    )
  }
  return <span className={className}>{short.toUpperCase()}</span>
}

/* ── Mobile detection hook ── */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

/* ── Shared raw history hook (hourly) — auto-refresh every 60 s ── */
function useRawHistory() {
  const [raw, setRaw] = useState([])
  useEffect(() => {
    let lastFetch = 0
    const load = () => {
      lastFetch = Date.now()
      fetch('/api/token-history')
        .then(r => r.json())
        .then(j => Array.isArray(j) && setIfChanged(setRaw, j))
        .catch(() => {})
    }
    const onFocus = () => { if (Date.now() - lastFetch > 25_000) load() }
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 30_000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('mm3-db-updated', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('mm3-db-updated', onFocus)
    }
  }, [])
  return raw
}

/* ── Minute-level history hook (1h range only) — auto-refresh without flicker ── */
function useRawMinutes(enabled) {
  const [raw, setRaw] = useState([])
  useEffect(() => {
    if (!enabled) return
    let lastFetch = 0
    const load = () => {
      lastFetch = Date.now()
      fetch('/api/token-history-minutes')
        .then(r => r.json())
        .then(j => Array.isArray(j) && setIfChanged(setRaw, j))
        .catch(() => {})
    }
    const onFocus = () => { if (Date.now() - lastFetch > 12_000) load() }
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 15_000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('mm3-db-updated', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('mm3-db-updated', onFocus)
    }
  }, [enabled])
  return raw
}

function useChartClock() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])
  return tick
}

/* ── Chart data hook ── */
function useChartData(rawHourly, rawMinutes, range) {
  return useMemo(() => {
    if (range === '1h') {
      if (rawMinutes.length) {
        return rawMinutes.map(row => ({
          time:  row.minute,
          value: parseFloat(row.value),
          delta: parseFloat(row.delta || 0),
          ...sourceDeltas(row),
        }))
      }
      // No minute activity yet — synthesise a flat line from the last hourly value
      if (!rawHourly.length) return []
      const sorted = [...rawHourly].sort((a, b) => new Date(a.hour) - new Date(b.hour))
      const lastVal = parseFloat(sorted[sorted.length - 1].cumulative_reward)
      if (!lastVal) return []
      const now = Date.now()
      const points = []
      for (let i = 60; i >= 0; i -= 5) {
        const d = new Date(now - i * 60_000)
        points.push({
          time:  `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
          value: lastVal,
          delta: 0,
          ...sourceDeltas(),
        })
      }
      return points
    }

    if (!rawHourly.length) return []
    const now    = Date.now()
    const cutoff = RANGE_MS[range]

    const sorted = [...rawHourly]
      .filter(({ hour }) => {
        const d = new Date(hour)
        return !isNaN(d) && (!cutoff || now - d.getTime() <= cutoff)
      })
      .sort((a, b) => new Date(a.hour) - new Date(b.hour))

    if (range === '24h') {
      if (!sorted.length) return []

      const allSameLocalDay = sorted.every(({ hour }) => {
        const d = new Date(hour)
        return localDateStr(d) === localDateStr(new Date(sorted[sorted.length - 1].hour))
      })

      if (!allSameLocalDay) {
        return sorted.map((e, i, arr) => {
          const val  = parseFloat(e.cumulative_reward)
          const prev = parseFloat(arr[i - 1]?.cumulative_reward ?? e.cumulative_reward)
          const d    = new Date(e.hour)
          return {
            time:  `${String(d.getHours()).padStart(2, '0')}:00`,
            value:  val,
            delta: parseFloat(e.delta ?? val - prev),
            ...sourceDeltas(e),
          }
        })
      }

      const lastDate = new Date(sorted[sorted.length - 1].hour)
      const start = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate(), 0, 0, 0, 0).getTime()
      const end = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate(), lastDate.getHours(), 0, 0, 0).getTime()
      const valueByHour = new Map(
        sorted.map(({ hour, cumulative_reward }) => {
          const d = new Date(hour)
          return [`${String(d.getHours()).padStart(2, '0')}:00`, parseFloat(cumulative_reward)]
        })
      )
      const deltasByHour = new Map(
        sorted.map(row => {
          const d = new Date(row.hour)
          return [`${String(d.getHours()).padStart(2, '0')}:00`, {
            delta: parseFloat(row.delta || 0),
            ...sourceDeltas(row),
          }]
        })
      )

      let carry = parseFloat(sorted[0].cumulative_reward)
      const filled = []
      for (let ts = start; ts <= end; ts += 3_600_000) {
        const d = new Date(ts)
        const key = `${String(d.getHours()).padStart(2, '0')}:00`
        const nextValue = valueByHour.has(key) ? valueByHour.get(key) : carry
        filled.push({ time: key, value: nextValue, ...(deltasByHour.get(key) ?? { delta: 0, ...sourceDeltas() }) })
        carry = nextValue
      }

      return filled
    }

    // Group by day for 7d / 30d / all
    const map = {}
    const dailyDeltas = {}
    sorted.forEach(row => {
      const { hour, cumulative_reward } = row
      const d = new Date(hour)
      if (!isNaN(d)) {
        const key = localDateStr(d)
        map[key] = parseFloat(cumulative_reward)
        if (!dailyDeltas[key]) dailyDeltas[key] = { delta: 0, ...sourceDeltas() }
        dailyDeltas[key].delta += parseFloat(row.delta || 0)
        const deltas = sourceDeltas(row)
        dailyDeltas[key].mined_delta += deltas.mined_delta
        dailyDeltas[key].trade_delta += deltas.trade_delta
        dailyDeltas[key].trade_wallet_count += deltas.trade_wallet_count
        dailyDeltas[key].trade_google_count += deltas.trade_google_count
        dailyDeltas[key].nftmoji_delta += deltas.nftmoji_delta
        dailyDeltas[key].market_delta += deltas.market_delta
      }
    })
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, val], i, arr) => ({
        time:   day.slice(5),
        dayIso: day,
        value:  val,
        ...(dailyDeltas[day] ?? {
          delta: val - (i > 0 ? arr[i - 1][1] : val),
          ...sourceDeltas(),
        }),
      }))
  }, [rawHourly, rawMinutes, range])
}

/* ── NFT events hook — auto-refresh without flicker ── */
function useNftEvents(range) {
  const [rawEvts, setRawEvts] = useState([])
  useEffect(() => {
    let lastFetch = 0
    const load = () => {
      lastFetch = Date.now()
      fetch('/api/nft-events')
        .then(r => r.json())
        .then(j => Array.isArray(j) && setIfChanged(setRawEvts, j))
        .catch(() => {})
    }
    const onFocus = () => { if (Date.now() - lastFetch > 55_000) load() }
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 60_000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('mm3-db-updated', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('mm3-db-updated', onFocus)
    }
  }, [])

  return useMemo(() => {
    if (!rawEvts.length) return {}
    const now    = Date.now()
    const cutoff = RANGE_MS[range]

    const filtered = rawEvts.filter(({ created_at }) => {
      const d = new Date(created_at)
      return !isNaN(d) && (!cutoff || now - d.getTime() <= cutoff)
    })

    const grouped = {}
    filtered.forEach(ev => {
      const d   = new Date(ev.created_at)
      const key = range === '1h'
        ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        : range === '24h'
          ? `${String(d.getHours()).padStart(2, '0')}:00`
          : localDateStr(d).slice(5)
      if (!grouped[key]) grouped[key] = []
      grouped[key].push({
        wallet:     ev.wallet,
        delta_mm3:  parseFloat(ev.delta_mm3),
        emoji:      ev.emoji ?? '🔮',
        event_type: ev.event_type,
      })
    })
    return grouped
  }, [rawEvts, range])
}

/* ── Fixed detail panel ── */
function ChartPointDetail({ point, label, nftEvents, range, t, isMobile }) {
  if (!point) return null
  const val   = point.value
  const row   = point
  const delta = row.delta
  const evts  = nftEvents?.[label] ?? []
  const deltas = sourceDeltas(row)
  const dec = isMobile ? 6 : 8
  const breakdown = [
    [t('chart.breakdownMined'), deltas.mined_delta, UP],
    [t('chart.breakdownNFTJI'), deltas.nftmoji_delta, C],
    [
      `${t('chart.breakdownTrade')}${formatTradeSourceCounts(deltas.trade_wallet_count, deltas.trade_google_count, t)}`,
      deltas.trade_delta,
      '#facc15',
    ],
    [`🧾 ${t('chart.breakdownMarket')}`, deltas.market_delta, deltas.market_delta >= 0 ? UP : '#ef4444'],
  ].filter(([, amount]) => Math.abs(amount) > 0)
  const diceModifier = Number.isFinite(row.dice_modifier) ? row.dice_modifier : null
  const diceActive = diceModifier != null

  const sz   = isMobile ? 'text-[0.72rem]' : 'text-[0.85rem]'

  return (
    <div className={`mt-2 rounded-lg border bg-[#050810] px-3 py-2 font-mono ${sz}`}
      style={{ borderColor: `${C}30`, color: '#cbd5e1' }}>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)] sm:items-start">
        <div className="min-w-0">
          <div className="mb-1 uppercase tracking-[0.18em]" style={{ color: C }}>⏱ {label}</div>
          {val != null && (
            <div>{t('chart.tooltipValue')} <span style={{ color: C }}>{val.toFixed(dec)}</span> MM3</div>
          )}
          {delta != null && delta !== 0 && (
            <div>{t('chart.tooltipChange')} <span style={{ color: delta >= 0 ? UP : '#ef4444' }}>{delta >= 0 ? '+' : ''}{delta.toFixed(dec)}</span></div>
          )}
        </div>

        <div className="min-w-0 border-t pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0" style={{ borderColor: `${C}20` }}>
          <div className="mb-1 uppercase tracking-widest text-[0.72rem]" style={{ color: `${C}b3` }}>
            {t('chart.breakdownTitle')}
          </div>
          {breakdown.map(([name, amount, clr]) => (
            <div key={name} className="flex justify-between gap-2">
              <span className="text-gray-500 truncate">{name}</span>
              <span style={{ color: clr }} className="font-black shrink-0">
                {amount >= 0 ? '+' : ''}{amount.toFixed(dec)}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">🎲{isMobile ? '' : ` ${range === '1h' ? t('chart.breakdownDice') : t('chart.breakdownDiceAvg')}`}</span>
            <span style={{ color: diceActive ? chartDiceColor(diceModifier) : '#64748b' }} className="font-black">
              {diceActive ? `${diceModifier >= 0 ? '+' : ''}${Math.round(diceModifier * 100)}%` : (isMobile ? '—' : t('chart.diceInactive'))}
            </span>
          </div>
        </div>

        <div className="min-w-0 border-t pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0" style={{ borderColor: `${C}20` }}>
          <div className="mb-1 uppercase tracking-widest text-[0.72rem]" style={{ color: `${C}b3` }}>
            {t('chart.tooltipNftSection')}
          </div>
          {evts.length > 0 ? evts.map((ev, i) => {
              const clr  = emojiColor(ev.emoji)
              const pct  = ev.delta_mm3 !== 0 && val
                ? ((ev.delta_mm3 / val) * 100).toFixed(2)
                : null
              return (
                <div key={i} className="mb-0.5 flex items-center justify-between gap-2">
                  <span>
                    {ev.emoji}{' '}
                    <WalletTag wallet={ev.wallet} className="text-gray-500" />
                  </span>
                  {pct && (
                    <span style={{ color: clr }} className="shrink-0 font-black">
                      {ev.delta_mm3 >= 0 ? '+' : ''}{pct}%
                    </span>
                  )}
                </div>
              )
            }) : (
              <span className="text-gray-600">{t('chart.noNftEvents')}</span>
            )}
        </div>
      </div>
    </div>
  )
}

/* ── NFT legend items — built inside component to pick up t() ── */
const NFT_LEGEND_BASE = [
  { emoji: '🧿', key: 'legendFate',       clr: '#c084fc' },
  { emoji: '🎰', key: 'legendJackpot',    clr: '#f59e0b' },
  { emoji: '🍀', key: 'legendFortune',    clr: UP },
  { emoji: '🔮', key: 'legendVoid',       clr: C },
  { emoji: '❤️', key: 'legendLife',       clr: '#ef4444' },
  { emoji: '⚔️', key: 'legendSqAttack',  clr: '#f97316' },
  { emoji: '🔰', key: 'legendSqDefense', clr: '#3b82f6' },
  { emoji: '📈', key: 'legendTradeBuy',  clr: '#22c55e' },
  { emoji: '📉', key: 'legendTradeSell', clr: '#f43f5e' },
]

/* ── Dice windows hook ── */
function useDiceChartWindows(data, range, clockTick) {
  return useMemo(() => {
    const now = Date.now()
    const toMinKey  = ms => { const d = new Date(ms); return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}` }
    const toHourKey = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2,'0')}:00` }
    const toDayKey  = ms => localDateStr(new Date(ms)).slice(5)

    if (range === '1h') {
      const chartRangeStart = now - 3_600_000
      const areas = [], lines = []
      for (const offset of [0, -1]) {
        const hourStart = (Math.floor(now / 3_600_000) + offset) * 3_600_000
        const win = getDiceWindowForHour(hourStart)
        // Skip if the dice window has completely passed out of the 1h chart range
        if (win.endMs <= chartRangeStart) continue
        if (win.startMs > now) continue
        const startKey = toMinKey(win.startMs)
        const x1 = visibleMinuteKey(startKey, data)
        const areaStart = x1 ?? visibleMinuteBoundary(data, startKey, 'after')
        const endKey = toMinKey(win.endMs)
        const visibleEnd = visibleMinuteKey(endKey, data)
        const x2 = win.endMs > now
          ? lastMinuteKey(data)
          : visibleEnd ?? visibleMinuteBoundary(data, endKey, 'before')
        if (areaStart && x2 && x2 !== areaStart) areas.push({ x1: areaStart, x2, win })
        if (x1) lines.push({ x: x1, win, isEnd: false })
        if (win.endMs <= now && visibleEnd) lines.push({ x: visibleEnd, win, isEnd: true })
      }
      return { areas, lines, diceByKey: {}, showStandalone: false }
    }

    if (range === '24h') {
      const dataKeySet = new Set(data.map(d => d.time))
      const diceByKey = {}
      for (let h = 0; h < 24; h++) {
        const hourStart = (Math.floor(now / 3_600_000) - h) * 3_600_000
        const win = getDiceWindowForHour(hourStart)
        const key = toHourKey(hourStart)
        if (dataKeySet.has(key)) diceByKey[key] = { ...win, showPct: true }
      }
      return { areas: [], lines: [], diceByKey, showStandalone: true }
    }

    if (range === '7d' || range === '30d' || range === '360d') {
      const dataKeySet = new Set(data.map(d => d.time))
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 360
      const diceByKey = {}
      for (let d = 0; d < days; d++) {
        const dayStart = Math.floor((now - d * 86_400_000) / 86_400_000) * 86_400_000
        const win = getDiceWindowForHour(dayStart + 12 * 3_600_000)
        const key = toDayKey(dayStart)
        if (dataKeySet.has(key)) diceByKey[key] = { ...win, showPct: true }
      }
      return { areas: [], lines: [], diceByKey, showStandalone: true }
    }

    return { areas: [], lines: [], diceByKey: {}, showStandalone: false }
  }, [data, range, clockTick])
}

function CombinedMarkerLabel({ viewBox, dice, nft }) {
  if (!viewBox || (!dice && !nft?.length)) return null
  const { x, y } = viewBox
  const cy = y - 12

  const hasNft  = nft?.length > 0
  const hasDice = !!dice
  const nftEmojis = hasNft ? [...new Set(nft.map(e => e.emoji))] : []
  const nftCount  = hasNft ? nft.length : 0
  const nftClr    = hasNft ? groupColor(nft) : null
  const diceIsEnd = hasDice && dice.isEnd
  const diceClr   = hasDice ? (diceIsEnd ? '#475569' : chartDiceColor(dice.modifier)) : '#64748b'
  const dicePct   = hasDice ? (diceIsEnd ? '0%' : `${dice.modifier >= 0 ? '+' : ''}${Math.round(dice.modifier * 100)}%`) : null

  const nftW  = hasNft ? Math.max(26, nftEmojis.length * 12 + 4) : 0
  const diceW = hasDice ? 52 : 0
  const gap   = hasNft && hasDice ? 4 : 0
  const pillH = 20
  const totalW = nftW + gap + diceW
  const startX = x - totalW / 2
  const nftCx  = startX + nftW / 2
  const diceCx = startX + nftW + gap + diceW / 2

  return (
    <g style={{ pointerEvents: 'none' }}>
      {hasNft && (
        <>
          {/* glitch shadow offset */}
          <rect x={nftCx - nftW / 2 + 2} y={cy - pillH / 2 + 2}
            width={nftW} height={pillH} rx={0}
            fill={nftClr} fillOpacity={0.12} stroke="none" />
          {/* outer border */}
          <rect x={nftCx - nftW / 2} y={cy - pillH / 2}
            width={nftW} height={pillH} rx={0}
            fill={nftClr} fillOpacity={0.13}
            stroke={nftClr} strokeOpacity={0.85} strokeWidth={1} />
          {/* inner border (double border effect) */}
          <rect x={nftCx - nftW / 2 + 2} y={cy - pillH / 2 + 2}
            width={nftW - 4} height={pillH - 4} rx={0}
            fill="none"
            stroke={nftClr} strokeOpacity={0.3} strokeWidth={0.5} />
          <text x={nftCx} y={cy + 5}
            textAnchor="middle" fontSize={nftEmojis.length > 2 ? 9 : 12}
            style={{ userSelect: 'none' }}>
            {nftEmojis.join('')}
          </text>
          {nftCount > 1 && (
            <g>
              {/* glitch shadow for badge */}
              <rect x={nftCx + nftW / 2 - 8} y={cy - pillH / 2 - 4}
                width={13} height={9} rx={0}
                fill={nftClr} fillOpacity={0.3} stroke="none"
                transform="translate(1,1)" />
              <rect x={nftCx + nftW / 2 - 8} y={cy - pillH / 2 - 4}
                width={13} height={9} rx={0}
                fill={nftClr} stroke="#060910" strokeWidth={1} />
              <text x={nftCx + nftW / 2 - 1} y={cy - pillH / 2 + 4}
                textAnchor="middle" fontSize={7}
                fontFamily="Consolas,monospace" fontWeight="bold" fill="#000">
                {nftCount}
              </text>
            </g>
          )}
        </>
      )}

      {hasDice && (
        <>
          {/* glitch shadow offset */}
          <rect x={diceCx - diceW / 2 + 2} y={cy - pillH / 2 + 2}
            width={diceW} height={pillH} rx={0}
            fill={diceClr} fillOpacity={0.12} stroke="none" />
          {/* outer border */}
          <rect x={diceCx - diceW / 2} y={cy - pillH / 2}
            width={diceW} height={pillH} rx={0}
            fill={diceClr} fillOpacity={0.13}
            stroke={diceClr} strokeOpacity={0.85} strokeWidth={1} />
          {/* inner border */}
          <rect x={diceCx - diceW / 2 + 2} y={cy - pillH / 2 + 2}
            width={diceW - 4} height={pillH - 4} rx={0}
            fill="none"
            stroke={diceClr} strokeOpacity={0.3} strokeWidth={0.5} />
          <text x={diceCx - 10} y={cy + 5}
            textAnchor="middle" fontSize={12}
            style={{ userSelect: 'none' }}>
            🎲
          </text>
          <text x={diceCx + 12} y={cy + 5}
            textAnchor="middle" fontSize={8}
            fontFamily="Consolas,monospace" fontWeight="bold"
            fill={diceClr} fillOpacity={0.95}>
            {dicePct}
          </text>
        </>
      )}
    </g>
  )
}

/* ── Main component ── */
export default function TokenChart() {
  const { t }      = useI18n()
  const isMobile   = useIsMobile()
  const chartClock  = useChartClock()

  const [range, setRange] = useState(() => {
    if (typeof window === 'undefined') return '1h'
    return localStorage.getItem('mm3-chart-range') || '1h'
  })
  const [activePoint, setActivePoint] = useState(null)
  const userLabelRef  = useRef(null)  // label the user last moved onto
  const prevRangeRef  = useRef(range)
  const [chartFilters, setChartFilters] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CHART_FILTERS
    try {
      return { ...DEFAULT_CHART_FILTERS, ...JSON.parse(localStorage.getItem('mm3-chart-filters') || 'null') }
    } catch { return DEFAULT_CHART_FILTERS }
  })

  const handleRangeChange = useCallback((r) => {
    setRange(r)
    if (typeof window !== 'undefined') localStorage.setItem('mm3-chart-range', r)
  }, [])

  const toggleChartFilter = useCallback((key) => {
    setChartFilters(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (typeof window !== 'undefined') localStorage.setItem('mm3-chart-filters', JSON.stringify(next))
      return next
    })
  }, [])

  const rawHistory  = useRawHistory()
  const rawMinutes  = useRawMinutes(range === '1h')
  const data        = useChartData(rawHistory, rawMinutes, range)
  const nftEvents   = useNftEvents(range)
  const diceWindows = useDiceChartWindows(data, range, chartClock)

  // Earliest hour in real DB data — clamps executed dice count to actual project lifetime
  const firstDataMs = useMemo(() => {
    if (!rawHistory.length) return 0
    let earliest = Infinity
    for (const { hour } of rawHistory) {
      const t = new Date(hour).getTime()
      if (!isNaN(t) && t < earliest) earliest = t
    }
    return isFinite(earliest) ? earliest : 0
  }, [rawHistory])

  const stats = useMemo(() => {
    if (data.length < 2) return null
    const vals   = data.map(d => d.value)
    const first  = vals[0]
    const last   = vals[vals.length - 1]
    const change = last - first
    const pct    = first ? (change / first) * 100 : 0
    return { first, last, change, pct, high: Math.max(...vals), low: Math.min(...vals), isUp: change >= 0 }
  }, [data])

  const color  = stats?.isUp === false ? DN : UP
  const baseChartColor = range === '1h' ? UP : color
  const gradId = `mm3-grad-${stats?.isUp === false ? 'dn' : 'up'}`

  const nftEventCount = useMemo(
    () => Object.values(nftEvents).reduce((acc, evts) => acc + evts.length, 0),
    [nftEvents]
  )
  const nftKeys = Object.keys(nftEvents)

  const filteredNftEvents = useMemo(() => {
    const allOn = CHART_FILTER_KEYS.filter(k => k !== 'dice').every(k => chartFilters[k])
    if (allOn) return nftEvents
    return Object.fromEntries(
      Object.entries(nftEvents)
        .map(([key, evts]) => [key, evts.filter(ev => chartFilters[chartEventCategory(ev)])])
        .filter(([, evts]) => evts.length > 0)
    )
  }, [nftEvents, chartFilters])

  const mergedMarkers = useMemo(() => {
    const map = {}
    for (const [key, evts] of Object.entries(filteredNftEvents)) {
      map[key] = { nft: evts, dice: null }
    }
    if (range === '1h' && chartFilters.dice) {
      for (const { x, win, isEnd } of diceWindows.lines) {
        const diceEntry = isEnd ? { ...win, isEnd: true } : win
        if (!map[x]) map[x] = { nft: null, dice: diceEntry }
        else map[x].dice = diceEntry
      }
    }
    return map
  }, [filteredNftEvents, diceWindows, range, chartFilters.dice])

  // Overlays for 1H dice windows — separate Areas so they work in all browsers.
  const diceOverlays = useMemo(() => {
    if (range !== '1h' || !data.length || !diceWindows.areas.length || !chartFilters.dice) return []
    return diceWindows.areas.flatMap(({ x1, x2, win }, idx) => {
      const si = data.findIndex(d => d.time === x1)
      const ei = data.findIndex(d => d.time === x2)
      if (si === -1 || ei <= si) return []
      return [{ key: `diceValue${idx}`, si, end: ei, color: chartDiceColor(win.modifier), modifier: win.modifier }]
    })
  }, [range, data, diceWindows, chartFilters.dice])

  // Enrich data: diceValue is only set within the dice window segment
  const chartData = useMemo(() => {
    return data.map((d, i) => {
      const next = { ...d }
      const activeDice = diceOverlays.find(overlay => i >= overlay.si && i <= overlay.end)
      const standaloneDice = diceWindows.diceByKey?.[d.time]
      const insideDiceWindow = diceOverlays.some(overlay => i > overlay.si && i < overlay.end)
      next.baseLineValue = insideDiceWindow ? null : d.value
      next.dice_modifier = activeDice?.modifier ?? standaloneDice?.modifier ?? null
      for (const overlay of diceOverlays) {
        next[overlay.key] = i >= overlay.si && i <= overlay.end ? d.value : null
      }
      return next
    })
  }, [data, diceOverlays, diceWindows])

  useEffect(() => {
    if (!chartData.length) {
      setActivePoint(null)
      return
    }
    const rangeChanged = prevRangeRef.current !== range
    prevRangeRef.current = range
    if (rangeChanged) {
      userLabelRef.current = null
      const last = chartData[chartData.length - 1]
      setActivePoint({ label: last.time, point: last })
      return
    }
    // Data refresh: restore user's selected point if still present
    const label = userLabelRef.current
    if (label) {
      const match = chartData.find(d => d.time === label)
      if (match) {
        setActivePoint({ label, point: match })
        return
      }
      userLabelRef.current = null
    }
    const last = chartData[chartData.length - 1]
    setActivePoint({ label: last.time, point: last })
  }, [range, chartData])

  const detailPoint = activePoint?.point || chartData[chartData.length - 1] || null
  const detailLabel = activePoint?.label || detailPoint?.time || ''

  const isFlatLine = !!stats && stats.high === stats.low

  // When all values are identical (flat line), auto domain collapses and hides the line
  const yDomain = useMemo(() => {
    if (!stats) return ['auto', 'auto']
    if (stats.high === stats.low) {
      const pad = stats.last * 0.002 || 0.000001
      return [stats.last - pad, stats.last + pad]
    }
    return ['auto', 'auto']
  }, [stats])

  const chartHeight  = isMobile ? 185 : 248
  const chartMargin  = isMobile
    ? { top: 32, right: 40, bottom: 4, left: 0 }
    : { top: 28, right: 60, bottom: 4, left: 0 }
  const yAxisWidth   = isMobile ? 40 : 54
  const yAxisDecimals = isMobile ? 3 : 4

  return (
    <div className="w-full font-mono select-none">
      <style>{`
        .crt-chart {
          background-image: repeating-linear-gradient(
            0deg, rgba(0,0,0,.06) 0, rgba(0,0,0,.06) 1px, transparent 1px, transparent 3px
          );
          pointer-events: none;
        }
        .mm3-chart-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          margin: 0 0 0.5rem;
          padding: 0 0.1rem;
          font-family: var(--font-geist-mono), monospace;
        }
        .mm3-chart-filter {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          border: 1px solid rgba(34,211,238,0.18);
          background: rgba(2,6,23,0.55);
          padding: 0.18rem 0.38rem;
          color: rgba(165,243,252,0.80);
          font-size: 0.58rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          user-select: none;
        }
        .mm3-chart-filter input {
          width: 0.68rem;
          height: 0.68rem;
          accent-color: #22d3ee;
        }
        .mm3-chart-filter[data-active='false'] {
          color: rgba(100,116,139,0.70);
          border-color: rgba(100,116,139,0.16);
          opacity: 0.62;
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-y-1.5 mb-2 px-0.5">
        <div className="min-w-0">
          {stats ? (
            <div className={`${isMobile ? 'text-[0.75rem]' : 'text-[0.85rem]'} font-bold flex items-center gap-1.5 flex-wrap`}>
              <span style={{ color }}>
                {stats.isUp ? '▲' : '▼'} {Math.abs(stats.change).toFixed(isMobile ? 6 : 8)}
              </span>
              <span className={`${isMobile ? 'px-1 py-px text-[0.78rem]' : 'px-1.5 py-px text-[0.88rem]'} font-black`}
                style={{ background: `${color}22`, color }}>
                {stats.isUp ? '+' : ''}{stats.pct.toFixed(2)}%
              </span>
              <span className={`text-gray-600 ${isMobile ? 'text-[0.72rem]' : 'text-[0.85rem]'}`}>{range.toUpperCase()}</span>
            </div>
          ) : null}
        </div>

        {/* Range buttons */}
        <div className={`flex flex-wrap ${isMobile ? 'gap-1' : 'gap-1.5'} pt-0.5`}>
          {RANGES.map(r => {
            const active = r === range
            return (
              <button key={r} onClick={() => handleRangeChange(r)}
                className={`${isMobile ? 'px-1.5 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'} uppercase font-bold tracking-wide transition-all duration-150 focus:outline-none`}
                style={{
                  background: active ? C : 'transparent',
                  color:      active ? '#000' : `${C}b3`,
                  border:     `2px solid ${active ? C : `${C}30`}`,
                  boxShadow:  active ? `0 0 8px ${C}55` : 'none',
                }}>
                {r}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Stats mini row ── */}
      {stats && (
        <div className={`flex flex-wrap gap-x-3 gap-y-0.5 mb-2 px-0.5 ${isMobile ? 'text-[0.72rem]' : 'text-[0.85rem]'} font-bold`}>
          <div style={{ color: UP }}>H {stats.high.toFixed(isMobile ? 5 : 6)}</div>
          <div style={{ color: `${C}80` }}>L {stats.low.toFixed(isMobile ? 5 : 6)}</div>
          {nftEventCount > 0 && (
            <div className={`ml-auto flex items-center gap-1 ${isMobile ? 'text-[0.7rem]' : 'text-[0.85rem]'} tracking-wide uppercase`}
              style={{ color: `${C}50` }}>
              <span>◈</span>
              {isMobile ? (
                <span>{nftEventCount} nftji</span>
              ) : (
                <>
                  <span>{nftEventCount} nftji {nftEventCount === 1 ? t('chart.nftEvent1') : t('chart.nftCount')}</span>
                  {nftKeys.length > 0 && nftKeys.length !== nftEventCount && (
                    <>
                      <span style={{ color: '#334155' }}>·</span>
                      <span>{nftKeys.length} {nftKeys.length === 1 ? t('chart.nftGroup1') : t('chart.nftGroups')}</span>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Chart filters ── */}
      <div className="mm3-chart-filters" aria-label="Chart layer filters">
        {CHART_FILTER_KEYS.map(key => (
          <label key={key} className="mm3-chart-filter" data-active={chartFilters[key]}>
            <input type="checkbox" checked={chartFilters[key]} onChange={() => toggleChartFilter(key)} />
            <span>{CHART_FILTER_LABELS[key]}</span>
          </label>
        ))}
      </div>

      {/* ── Chart ── */}
      <div className="relative rounded-lg overflow-hidden border"
        style={{ borderColor: `${C}12`, background: '#060910' }}>
        <div className="absolute inset-0 z-10 rounded-lg pointer-events-none crt-chart" />

        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart
              data={chartData}
              margin={chartMargin}
              onMouseMove={(state) => {
                const row = state?.activePayload?.find((entry) => entry?.dataKey === 'value')?.payload
                  || state?.activePayload?.[0]?.payload
                if (row) {
                  const label = state?.activeLabel || row.time
                  userLabelRef.current = label
                  setActivePoint({ label, point: row })
                }
              }}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={baseChartColor} stopOpacity={0.07} />
                  <stop offset="100%" stopColor={baseChartColor} stopOpacity={0} />
                </linearGradient>

                <filter id="mm3-glow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <CartesianGrid
                horizontal vertical={false}
                stroke={`${C}09`}
                strokeDasharray="2 6"
              />

              <XAxis
                dataKey="time"
                tick={{ fill: '#2d3f52', fontSize: isMobile ? 7 : 8, fontFamily: 'Consolas,monospace' }}
                axisLine={{ stroke: `${C}14` }}
                tickLine={false}
                interval="preserveStartEnd"
                dy={4}
              />

              <YAxis
                orientation="right"
                tickFormatter={v => v.toFixed(yAxisDecimals)}
                tick={{ fill: '#2d3f52', fontSize: isMobile ? 7 : 8, fontFamily: 'Consolas,monospace' }}
                axisLine={false}
                tickLine={{ stroke: `${C}14`, strokeWidth: 1 }}
                domain={yDomain}
                width={yAxisWidth}
              />

              <Tooltip
                content={() => null}
                cursor={{ stroke: `${C}30`, strokeWidth: 1, strokeDasharray: '3 3' }}
                wrapperStyle={{ zIndex: 20 }}
              />

              {/* Unified markers for every range */}
              {Object.entries(mergedMarkers).map(([key, { nft, dice }]) => {
                const lineClr = nft ? groupColor(nft) : (dice?.isEnd ? '#475569' : (dice ? chartDiceColor(dice.modifier) : C))
                const isDiceOnly = !nft && !!dice
                return (
                  <ReferenceLine key={key} x={key}
                    stroke={lineClr} strokeDasharray="2 4"
                    strokeWidth={isDiceOnly ? 1.5 : 1}
                    strokeOpacity={isDiceOnly ? 0.75 : 0.45}
                    label={<CombinedMarkerLabel dice={dice} nft={nft} />}
                  />
                )
              })}

              <Area
                type="monotoneX"
                dataKey="value"
                stroke={diceOverlays.length ? 'transparent' : baseChartColor}
                strokeWidth={1.5}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 4, fill: baseChartColor, stroke: '#060910', strokeWidth: 2, filter: 'url(#dot-glow)' }}
                filter={isFlatLine ? undefined : 'url(#mm3-glow)'}
                isAnimationActive={false}
              />

              {diceOverlays.length > 0 && (
                <Area
                  type="monotoneX"
                  dataKey="baseLineValue"
                  stroke={baseChartColor}
                  strokeWidth={1.5}
                  fill="none"
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              {/* Dice window overlays — separate Areas so each 1H segment stays independent. */}
              {diceOverlays.map(overlay => (
                <Area
                  key={overlay.key}
                  type="monotoneX"
                  dataKey={overlay.key}
                  stroke={overlay.color}
                  strokeWidth={2}
                  fill="none"
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2"
            style={{ height: chartHeight }}>
            <div className="text-[0.88rem] tracking-[0.3em] uppercase"
              style={{ color: `${C}40` }}>
              {t('chart.loading')}
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1 h-1 rounded-full animate-pulse"
                  style={{ background: C, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {detailPoint ? (
        <ChartPointDetail
          point={detailPoint}
          label={detailLabel}
          nftEvents={filteredNftEvents}
          range={range}
          t={t}
          isMobile={isMobile}
        />
      ) : null}
    </div>
  )
}
