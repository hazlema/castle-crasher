const el = (id: string) => document.getElementById(id) as HTMLElement

export type ToastType = 'info' | 'success' | 'reward' | 'warn'

export interface ToastOpts {
  type?: ToastType
  duration?: number // seconds until auto-dismiss
  countTo?: number  // animates the first %d in text from 0 to this
}

const MAX_TOASTS = 4

function dismiss(t: HTMLElement) {
  if (t.classList.contains('out')) return
  t.classList.add('out')
  t.addEventListener('animationend', () => t.remove(), { once: true })
}

export const hud = {
  setLevel(n: number) {
    el('level').textContent = `Level ${n}`
  },
  setShots(n: number) {
    el('shots').textContent = `Shots: ${n}`
  },
  setCrates(standing: number, total: number) {
    el('crates').textContent = `Crates: ${standing}/${total}`
  },
  setPower(p: number) {
    el('power-bar').style.width = `${p * 100}%`
  },
  setPowerUps(text: string) {
    el('powerups').textContent = text
  },
  setResolve(fraction: number | null) {
    const wrap = el('resolve-wrap')
    wrap.style.display = fraction === null ? 'none' : 'block'
    if (fraction !== null) {
      el('resolve-bar').style.width = `${fraction * 100}%`
    }
  },
  toast(text: string, { type = 'info', duration = 4, countTo }:
    ToastOpts = {}) {
    const box = el('toasts')
    while (box.children.length >= MAX_TOASTS) {
      dismiss(box.children[0] as HTMLElement)
      box.children[0].remove()
    }
    const t = document.createElement('div')
    t.className = `toast toast-${type}`
    if (countTo !== undefined && text.includes('%d')) {
      const [before, after] = text.split('%d')
      const num = document.createElement('span')
      num.className = 'num'
      num.textContent = '0'
      t.append(before, num, after)
      let n = 0
      const tick = setInterval(() => {
        n += 1
        if (n >= countTo) clearInterval(tick)
        num.textContent = `${Math.min(n, countTo)}`
        num.classList.remove('pop')
        void num.offsetWidth // restart the pop animation
        num.classList.add('pop')
      }, 90)
    } else {
      t.textContent = text
    }
    const bar = document.createElement('div')
    bar.className = 'bar'
    bar.style.animationDuration = `${duration}s`
    t.append(bar)
    box.append(t)
    setTimeout(() => dismiss(t), duration * 1000)
  },
  clearToasts() {
    for (const t of [...el('toasts').children]) dismiss(t as HTMLElement)
  },
  banner(title: string, subtitle = '') {
    el('banner-title').textContent = title
    el('banner-sub').textContent = subtitle
    el('banner').className = 'show'
  },
  hideBanner() {
    el('banner').className = ''
  },
  floatLabel(text: string, x: number, y: number) {
    const label = document.createElement('div')
    label.className = 'float-label'
    label.textContent = text
    label.style.left = `${x}px`
    label.style.top = `${y}px`
    el('hud').append(label)
    label.addEventListener('animationend', () => label.remove(),
      { once: true })
  },
}
