export const M1_MILEI_CHAINSAW_AUDIO_URL = '/ambient/milei-chainsaw.mp3?v=2'

let audio = null
let wantPlay = false
let prefsBound = false
const holds = new Set()

function soundEnabled() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('mm3-sound-enabled') !== 'false'
}

function bindSoundPrefs() {
  if (prefsBound || typeof window === 'undefined') return
  prefsBound = true
  window.addEventListener('mm3-sound-prefs', (event) => {
    if (event?.detail?.sound === false) {
      if (audio) audio.pause()
      return
    }
    if (event?.detail?.sound === true) tryPlay()
  })
}

function ensureAudio() {
  if (typeof window === 'undefined') return null
  bindSoundPrefs()
  if (audio) return audio
  audio = new Audio(M1_MILEI_CHAINSAW_AUDIO_URL)
  audio.loop = true
  audio.preload = 'auto'
  audio.volume = 0.28
  return audio
}

function tryPlay() {
  if (!wantPlay || !soundEnabled()) return
  const a = ensureAudio()
  if (!a?.paused) return
  a.play()?.catch?.(() => {})
}

/**
 * Start the looping motosierra idle. Autoplay may wait for the first gesture;
 * call again from a pointer/keydown if needed.
 */
export function startMileiChainsawLoop(volume = 0.28) {
  wantPlay = true
  bindSoundPrefs()
  const a = ensureAudio()
  if (!a) return
  a.volume = Math.max(0, Math.min(1, volume))
  if (!soundEnabled()) {
    a.pause()
    return
  }
  tryPlay()
}

export function stopMileiChainsawLoop() {
  holds.clear()
  wantPlay = false
  if (!audio) return
  audio.pause()
  try { audio.currentTime = 0 } catch { /* ignore */ }
}

/** Keep the loop alive for overlapping reasons (walk / tip / hit). */
export function holdMileiChainsaw(reason, volume = 0.32) {
  holds.add(String(reason || 'default'))
  startMileiChainsawLoop(volume)
}

export function releaseMileiChainsaw(reason) {
  holds.delete(String(reason || 'default'))
  if (holds.size === 0) stopMileiChainsawLoop()
}

export function mileiChainsawHoldCount() {
  return holds.size
}

/** Distance falloff — full volume nearby, quiet across the plaza, mute far away. */
export function setMileiChainsawProximity(distance, {
  fullAt = 4,
  muteAt = 22,
  maxVolume = 0.42,
} = {}) {
  if (!wantPlay) return
  const a = ensureAudio()
  if (!a) return
  if (!soundEnabled()) {
    a.pause()
    return
  }
  const d = Number(distance)
  let vol = 0
  if (Number.isFinite(d) && d < muteAt) {
    vol = d <= fullAt ? maxVolume : maxVolume * (1 - (d - fullAt) / (muteAt - fullAt))
  }
  a.volume = vol
  if (vol > 0.01) tryPlay()
  else a.pause()
}

export function syncMileiPatrolChainsaw(motion, gx, gy) {
  const phase = motion?.patrol?.phase
  const moving = phase === 'walking' || phase === 'returning' || phase === 'gazing'
  if (!moving) {
    releaseMileiChainsaw('walk')
    return
  }
  holdMileiChainsaw('walk', 0.32)
  const rx = Number(motion.root?.position?.x)
  const rz = Number(motion.root?.position?.z)
  if (Number.isFinite(rx) && Number.isFinite(rz) && Number.isFinite(gx) && Number.isFinite(gy)) {
    setMileiChainsawProximity(Math.hypot(gx - rx, gy - rz))
  }
}

/** One-shot gesture unlock for browsers that block autoplay. */
export function unlockMileiChainsawLoop() {
  if (!wantPlay) return
  tryPlay()
}
