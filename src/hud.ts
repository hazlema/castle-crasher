const el = (id: string) => document.getElementById(id) as HTMLElement

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
  setTimer(seconds: number | null) {
    el('timer').textContent = seconds === null
      ? ''
      : `Shot ends in ${seconds.toFixed(1)}s`
  },
  showToast(text: string) {
    const m = el('toast')
    m.textContent = text
    m.style.display = 'block'
  },
  hideToast() {
    el('toast').style.display = 'none'
  },
}
