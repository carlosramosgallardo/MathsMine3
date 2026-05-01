'use client'

import { useEffect } from 'react'

const GTM_ID = 'GTM-5Z3RTKX9'
const ADS_CLIENT = 'ca-pub-1022737864838438'
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-SWPCXV7YF5'
const THIRD_PARTY_DELAY_MS = 30000

function appendScript(id, src, attrs = {}) {
  if (document.getElementById(id)) return
  const script = document.createElement('script')
  script.id = id
  script.src = src
  script.async = true
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) script.setAttribute(key, value)
  }
  document.head.appendChild(script)
}

function loadThirdParties() {
  if (window.__mm3ThirdPartiesLoaded) return
  window.__mm3ThirdPartiesLoaded = true

  appendScript(
    'adsbygoogle',
    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`,
    { crossorigin: 'anonymous' }
  )

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  appendScript('gtm-js', `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`)

  if (GA_ID) {
    appendScript('ga4-src', `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`)
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments) }
    window.gtag('js', new Date())
    window.gtag('config', GA_ID, { page_path: window.location.pathname })
  }
}

export default function ThirdPartyScripts() {
  useEffect(() => {
    let timer = null

    const schedule = () => {
      if (localStorage.getItem('mm3_cookies_accepted') !== 'true') return
      timer = window.setTimeout(loadThirdParties, THIRD_PARTY_DELAY_MS)
    }

    const onConsent = () => {
      if (timer) window.clearTimeout(timer)
      schedule()
    }

    schedule()
    window.addEventListener('mm3-cookie-consent-changed', onConsent)
    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('mm3-cookie-consent-changed', onConsent)
    }
  }, [])

  return null
}
