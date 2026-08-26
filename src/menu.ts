import { getMusicVolume, setMusicVolume } from './music'
import { getSfxVolume, setSfxVolume, sfx } from './sfx'

const el = (id: string) => document.getElementById(id) as HTMLElement

interface Item {
  label: string
  action?: () => void
  get?: () => number
  set?: (v: number) => void
}

// ESC pause menu. "Restart level" sits first and is selected every time
// the menu opens, so ESC + ENTER is the instant rage-restart. A full
// game restart is just a page refresh.
export class PauseMenu {
  onRestart: (() => void) | null = null
  private index = 0
  private opened = false
  private items: Item[] = [
    {
      label: 'Restart level',
      action: () => {
        this.close()
        this.onRestart?.()
      },
    },
    { label: 'Music volume', get: getMusicVolume, set: setMusicVolume },
    { label: 'SFX volume', get: getSfxVolume, set: setSfxVolume },
  ]

  constructor() {
    addEventListener('keydown', (e) => {
      if (!this.opened) return
      const item = this.items[this.index]
      if (e.code === 'ArrowUp') {
        this.index = (this.index + this.items.length - 1) % this.items.length
      } else if (e.code === 'ArrowDown') {
        this.index = (this.index + 1) % this.items.length
      } else if (e.code === 'ArrowLeft' && item.set) {
        item.set((item.get?.() ?? 0) - 0.05)
        if (item.label.startsWith('SFX')) sfx.reward()
      } else if (e.code === 'ArrowRight' && item.set) {
        item.set((item.get?.() ?? 0) + 0.05)
        if (item.label.startsWith('SFX')) sfx.reward()
      } else if (e.code === 'Enter') {
        item.action?.()
      } else {
        return
      }
      e.preventDefault()
      this.render()
    })
  }

  get isOpen() {
    return this.opened
  }

  open() {
    this.opened = true
    this.index = 0
    el('menu').className = 'show'
    this.render()
  }

  close() {
    this.opened = false
    el('menu').className = ''
  }

  private render() {
    const box = el('menu-items')
    box.textContent = ''
    for (const [i, item] of this.items.entries()) {
      const row = document.createElement('div')
      row.className = i === this.index ? 'menu-row sel' : 'menu-row'
      const label = document.createElement('span')
      label.textContent = item.label
      row.append(label)
      if (item.get) {
        const track = document.createElement('span')
        track.className = 'menu-slider'
        const fill = document.createElement('span')
        fill.className = 'menu-slider-fill'
        fill.style.width = `${Math.round(item.get() * 100)}%`
        track.append(fill)
        row.append(track)
      }
      box.append(row)
    }
  }
}
