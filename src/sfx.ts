// All game audio is synthesized — no asset files. The AudioContext is
// created on the first keydown to satisfy browser autoplay policy.
const MASTER_VOLUME = 0.5

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

addEventListener('keydown', () => {
  if (ctx) return
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = MASTER_VOLUME
  master.connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
})

interface ToneOpts {
  type?: OscillatorType
  freq: number
  freqEnd?: number
  gain?: number
  duration: number
  delay?: number
}

function tone({ type = 'sine', freq, freqEnd, gain = 0.3, duration,
  delay = 0 }: ToneOpts) {
  if (!ctx || !master) return
  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd),
      t0 + duration)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + duration)
}

interface NoiseOpts {
  filter: BiquadFilterType
  freq: number
  freqEnd?: number
  q?: number
  gain?: number
  duration: number
}

function noiseBurst({ filter, freq, freqEnd, q = 1, gain = 0.3,
  duration }: NoiseOpts) {
  if (!ctx || !master || !noise) return
  const t0 = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t0)
  if (freqEnd !== undefined) {
    f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd),
      t0 + duration)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  src.connect(f).connect(g).connect(master)
  src.start(t0)
  src.stop(t0 + duration)
}

let chargeOsc: OscillatorNode | null = null
let chargeGain: GainNode | null = null

export const sfx = {
  launch() {
    tone({ type: 'sawtooth', freq: 90, freqEnd: 40, gain: 0.25,
      duration: 0.25 })
    noiseBurst({ filter: 'bandpass', freq: 400, freqEnd: 2000, q: 2,
      gain: 0.2, duration: 0.4 })
  },
  impact(intensity: number) {
    const v = Math.min(1, intensity)
    if (v < 0.05) return
    noiseBurst({ filter: 'bandpass', freq: 150 + Math.random() * 250,
      q: 1.5, gain: 0.45 * v, duration: 0.15 })
  },
  blast() {
    tone({ freq: 120, freqEnd: 30, gain: 0.5, duration: 0.5 })
    noiseBurst({ filter: 'lowpass', freq: 1000, freqEnd: 100, gain: 0.4,
      duration: 0.6 })
  },
  reward() {
    for (const [i, f] of [523, 659, 784].entries()) {
      tone({ type: 'triangle', freq: f, gain: 0.2, duration: 0.25,
        delay: i * 0.12 })
    }
  },
  fanfare() {
    for (const [i, f] of [392, 523, 659, 784].entries()) {
      tone({ type: 'triangle', freq: f, gain: 0.25,
        duration: i === 3 ? 0.7 : 0.22, delay: i * 0.16 })
    }
  },
  defeat() {
    tone({ type: 'triangle', freq: 330, gain: 0.2, duration: 0.35 })
    tone({ type: 'triangle', freq: 262, gain: 0.2, duration: 0.6,
      delay: 0.3 })
  },
  // Called every frame while charging; creates the osc lazily.
  charge(level: number) {
    if (!ctx || !master) return
    if (!chargeOsc) {
      chargeOsc = ctx.createOscillator()
      chargeOsc.type = 'sine'
      chargeGain = ctx.createGain()
      chargeGain.gain.value = 0.08
      chargeOsc.connect(chargeGain).connect(master)
      chargeOsc.start()
    }
    chargeOsc.frequency.value = 180 + level * 400
  },
  chargeEnd() {
    chargeOsc?.stop()
    chargeOsc?.disconnect()
    chargeGain?.disconnect()
    chargeOsc = null
    chargeGain = null
  },
}
