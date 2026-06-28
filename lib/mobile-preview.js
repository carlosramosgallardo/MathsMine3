export const MM3_MOBILE_QUERY = 'mm3_mobile'
export const MM3_MOBILE_SESSION_KEY = 'mm3_mobile'
/** Standard Android portrait logical resolution (matches dev mobile-frame). */
export const MOBILE_PREVIEW_VIEWPORT = { width: 390, height: 844 }
export const MOBILE_PREVIEW_VIEWPORT_META =
  `width=${MOBILE_PREVIEW_VIEWPORT.width}, viewport-fit=cover, initial-scale=1, maximum-scale=1`
export const DEFAULT_VIEWPORT_META = 'width=device-width, initial-scale=1'

export function isMobilePreviewDevAllowed() {
  return process.env.NODE_ENV === 'development'
}

export function isMobilePreviewBuild() {
  return process.env.NEXT_PUBLIC_MM3_MOBILE_PREVIEW === '1'
}

export function readMobilePreviewSession() {
  if (typeof window === 'undefined' || !isMobilePreviewDevAllowed()) return false
  if (window.location.pathname.startsWith('/dev/')) return false
  try {
    return window.sessionStorage.getItem(MM3_MOBILE_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function setMobilePreviewSession(enabled) {
  if (typeof window === 'undefined' || !isMobilePreviewDevAllowed()) return
  try {
    if (enabled) window.sessionStorage.setItem(MM3_MOBILE_SESSION_KEY, '1')
    else window.sessionStorage.removeItem(MM3_MOBILE_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function isMobilePreviewQuerySearch(search = '') {
  if (!isMobilePreviewDevAllowed()) return false
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return params.get(MM3_MOBILE_QUERY) === '1'
}

export function isMobilePreviewActive() {
  if (typeof window === 'undefined') return isMobilePreviewBuild()
  return (
    isMobilePreviewBuild() ||
    document.documentElement.classList.contains('mm3-mobile-preview') ||
    readMobilePreviewSession()
  )
}

/** Touch/coarse layout — real phone or local mobile-preview dev session. */
export function isCoarsePointerLike() {
  if (typeof window === 'undefined') return false
  if (isMobilePreviewActive()) return true
  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
}

export function getEffectiveViewportWidth(fallback = MOBILE_PREVIEW_VIEWPORT.width) {
  if (typeof window === 'undefined') return fallback
  if (isMobilePreviewActive()) return MOBILE_PREVIEW_VIEWPORT.width
  return window.innerWidth
}

export function getEffectiveViewportHeight(fallback = MOBILE_PREVIEW_VIEWPORT.height) {
  if (typeof window === 'undefined') return fallback
  if (isMobilePreviewActive()) return MOBILE_PREVIEW_VIEWPORT.height
  return window.innerHeight
}

export function applyForcedMobileViewport(active) {
  if (typeof document === 'undefined') return
  let el = document.querySelector('meta[name="viewport"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'viewport')
    document.head.appendChild(el)
  }
  if (!el.dataset.mm3DefaultViewport) {
    el.dataset.mm3DefaultViewport = el.getAttribute('content') || DEFAULT_VIEWPORT_META
  }
  el.setAttribute(
    'content',
    active ? MOBILE_PREVIEW_VIEWPORT_META : el.dataset.mm3DefaultViewport,
  )
}

export function withMobilePreviewQuery(path, origin) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  const url = new URL(path, base)
  url.searchParams.set(MM3_MOBILE_QUERY, '1')
  return url.pathname + url.search + url.hash
}

export const DEV_PORTAL_PREVIEW_ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/mining', label: 'Mining' },
  { path: '/training', label: 'Training' },
  { path: '/trading', label: 'Trade' },
  { path: '/ranking', label: 'Ranking' },
  { path: '/squeezing', label: 'Squeeze' },
  { path: '/relaying', label: 'Relay' },
  { path: '/daily-tasks', label: 'Tasks' },
  { path: '/chain3d', label: 'Chain3D' },
]
