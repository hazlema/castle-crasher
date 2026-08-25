const down = new Set<string>()
const pressed = new Set<string>()
const released = new Set<string>()

addEventListener('keydown', (e) => {
  if (!down.has(e.code)) pressed.add(e.code)
  down.add(e.code)
})
addEventListener('keyup', (e) => {
  down.delete(e.code)
  released.add(e.code)
})

export const input = {
  isDown: (code: string) => down.has(code),
  wasPressed: (code: string) => pressed.has(code),
  wasReleased: (code: string) => released.has(code),
  endFrame() {
    pressed.clear()
    released.clear()
  },
}
