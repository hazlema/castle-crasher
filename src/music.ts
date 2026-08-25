// Background music: drop .mp3/.ogg/.wav/.m4a files into src/music/ and one
// is picked at random. Empty directory → no music. Same glob pattern as
// the backgrounds in scene.ts.
const files = Object.values(import.meta.glob(
  './music/*.{mp3,ogg,wav,m4a}',
  { eager: true, query: '?url', import: 'default' },
)) as string[]

const MUSIC_VOLUME = 0.35

export function startMusic() {
  if (files.length === 0) return
  addEventListener('keydown', () => {
    const audio = new Audio(files[Math.floor(Math.random() * files.length)])
    audio.loop = true
    audio.volume = MUSIC_VOLUME
    audio.play().catch(() => {}) // ignore autoplay rejection
  }, { once: true })
}
