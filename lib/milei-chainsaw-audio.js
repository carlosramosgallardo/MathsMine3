import { M1_MILEI_CHAINSAW_AUDIO_URL } from './m1-milei-statue'

let audio = null
let wantPlay = false

function soundEnabled() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('mm3-sound-enabled') !== 'false'
}

function ensureAudio() {
  if (typeof window === 'undefined') return null
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
  const a = ensureAudio()
  if (!a) return
  a.volume = Math.max(0, Math.min(1, volume))
  tryPlay()
}

export function stopMileiChainsawLoop() {
  wantPlay = false
  if (!audio) return
  audio.pause()
  try { audio.currentTime = 0 } catch { /* ignore */ }
}

/** Distance falloff — full volume nearby, quiet across the plaza, mute far away. */
export function setMileiChainsawProximity(distance, {
  fullAt = 4,
  muteAt = 22,
  maxVolume = 0.38,
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

/** One-shot gesture unlock for browsers that block autoplay. */
export function unlockMileiChainsawLoop() {
  if (!wantPlay) return
  tryPlay()
}
