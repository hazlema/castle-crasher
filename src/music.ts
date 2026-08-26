// Background music: drop .mp3/.ogg/.wav/.m4a files into src/music/ and
// they play as a shuffled playlist. Empty directory → no music. Same glob
// pattern as the backgrounds in scene.ts. The last-played track is
// remembered so a reload never starts with the song you just heard.
const files = Object.values(import.meta.glob(
  './music/*.{mp3,ogg,wav,m4a}',
  { eager: true, query: '?url', import: 'default' },
)) as string[]

const DEFAULT_VOLUME = 0.35
const VOLUME_KEY = 'music-volume'
const LAST_KEY = 'music-last-track'

let volume = Number(localStorage.getItem(VOLUME_KEY) ?? DEFAULT_VOLUME)
let currentAudio: HTMLAudioElement | null = null

export function getMusicVolume() {
  return volume
}

export function setMusicVolume(v: number) {
  volume = Math.min(1, Math.max(0, v))
  localStorage.setItem(VOLUME_KEY, String(volume))
  if (currentAudio) currentAudio.volume = volume
}

function shuffled(list: string[]): string[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function startMusic() {
  if (files.length === 0) return
  addEventListener('keydown', () => {
    let queue = shuffled(files)
    // Don't open with the track the previous session ended on
    if (queue.length > 1 && queue[0] === localStorage.getItem(LAST_KEY)) {
      queue.push(queue.shift() as string)
    }
    let index = 0
    const audio = new Audio()
    currentAudio = audio
    audio.volume = volume
    const playNext = () => {
      audio.src = queue[index]
      localStorage.setItem(LAST_KEY, queue[index])
      index = (index + 1) % queue.length
      audio.play().catch(() => {}) // ignore autoplay rejection
    }
    audio.addEventListener('ended', playNext)
    playNext()
  }, { once: true })
}
