const voiceCache = new Map()

function soundEnabled() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('mm3-sound-enabled') !== 'false'
}

/** Local MP3 only — no network API, cached Audio elements. */
export function playBossStatueVoice(url) {
  if (!url || !soundEnabled()) return
  try {
    let audio = voiceCache.get(url)
    if (!audio) {
      audio = new Audio(url)
      audio.preload = 'auto'
      voiceCache.set(url, audio)
    }
    audio.pause()
    audio.currentTime = 0
    const playPromise = audio.play()
    if (playPromise?.catch) playPromise.catch(() => {})
  } catch {}
}
