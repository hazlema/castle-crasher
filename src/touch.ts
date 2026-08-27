// On-screen controls for touch devices. Buttons synthesize the same
// keyboard events the desktop game runs on, so gameplay code and the
// pause menu need no special cases. Hold semantics are preserved:
// pointer down = keydown, pointer up/cancel = keyup.

interface ButtonSpec {
  code: string
  label: string
  className: string
}

const BUTTONS: ButtonSpec[] = [
  { code: 'ArrowLeft', label: '◀', className: 'tc-left' },
  { code: 'ArrowRight', label: '▶', className: 'tc-right' },
  { code: 'Enter', label: '⏎', className: 'tc-enter' },
  { code: 'KeyH', label: 'H', className: 'tc-check' },
  { code: 'Space', label: 'FIRE', className: 'tc-fire' },
  { code: 'Escape', label: '☰', className: 'tc-menu' },
]

export class TouchControls {
  // Attach only on touch devices; no-op elsewhere. `?touch` forces the
  // controls on for desktop testing.
  static attach(): TouchControls | null {
    const isTouch = matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      new URLSearchParams(location.search).has('touch')
    if (!isTouch) return null
    return new TouchControls()
  }

  private constructor() {
    document.body.classList.add('touch')
    const root = document.createElement('div')
    root.id = 'touch-controls'
    for (const spec of BUTTONS) root.append(this.makeButton(spec))
    document.body.append(root)
    // Long-press context menus break hold-to-charge
    root.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private makeButton({ code, label, className }: ButtonSpec) {
    const el = document.createElement('button')
    el.className = `tc-btn ${className}`
    el.textContent = label
    const send = (type: 'keydown' | 'keyup') =>
      dispatchEvent(new KeyboardEvent(type, { code }))
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      send('keydown')
      // Keep the pointer even if the finger slides off the button
      try { el.setPointerCapture(e.pointerId) } catch { /* synthetic */ }
    })
    const release = () => send('keyup')
    el.addEventListener('pointerup', release)
    el.addEventListener('pointercancel', release)
    return el
  }
}
