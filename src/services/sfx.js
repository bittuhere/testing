// Arcade Hub — tiny WebAudio synthesizer for game sounds (no audio files needed)
let ctx = null
let muted = false
try { muted = localStorage.getItem('ah.sfx.muted') === '1' } catch { /* ignore */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq, { type = 'square', dur = 0.12, vol = 0.12, when = 0, slideTo = null } = {}) {
  if (muted) return
  const audio = ac()
  if (!audio) return
  const t0 = audio.currentTime + when
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export const sfx = {
  get muted() { return muted },
  toggle() {
    muted = !muted
    try { localStorage.setItem('ah.sfx.muted', muted ? '1' : '0') } catch { /* ignore */ }
    return muted
  },
  click() { tone(660, { type: 'square', dur: 0.05, vol: 0.06 }) },
  jump() { tone(420, { type: 'square', dur: 0.14, slideTo: 720, vol: 0.1 }) },
  flap() { tone(520, { type: 'square', dur: 0.08, slideTo: 640, vol: 0.09 }) },
  point() { tone(880, { type: 'square', dur: 0.09 }); tone(1320, { type: 'square', dur: 0.14, when: 0.09 }) },
  coin() { tone(988, { type: 'triangle', dur: 0.08 }); tone(1319, { type: 'triangle', dur: 0.2, when: 0.07 }) },
  hit() { tone(180, { type: 'sawtooth', dur: 0.35, slideTo: 60, vol: 0.16 }) },
  gameover() { [392, 330, 262, 196].forEach((f, i) => tone(f, { type: 'square', dur: 0.22, when: i * 0.18, vol: 0.12 })) },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.22, when: i * 0.14, vol: 0.14 })) },
  lose() { [440, 415, 392, 370].forEach((f, i) => tone(f, { type: 'sawtooth', dur: 0.2, when: i * 0.16, vol: 0.1 })) },
  eat() { tone(740, { type: 'square', dur: 0.06 }) },
  power() { tone(330, { type: 'triangle', dur: 0.1 }); tone(494, { type: 'triangle', dur: 0.1, when: 0.08 }); tone(659, { type: 'triangle', dur: 0.16, when: 0.16 }) },
  notify() { tone(1047, { type: 'sine', dur: 0.25, vol: 0.12 }); tone(1568, { type: 'sine', dur: 0.3, when: 0.12, vol: 0.1 }) },
  ghost() { tone(220, { type: 'sine', dur: 0.18, slideTo: 440, vol: 0.1 }) },
  select() { tone(784, { type: 'square', dur: 0.07, vol: 0.08 }) },
}
