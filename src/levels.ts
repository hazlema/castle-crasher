import { SIZE } from './crates'

export interface Level {
  shots: number
  specialCrates: number
  crates: [number, number, number][]
}

const H = SIZE
const HALF = SIZE / 2

// Vertical column of n crates at (x, z)
function col(x: number, z: number, n: number): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => [x, HALF + i * H, z])
}

export const LEVELS: Level[] = [
  // 1: single tower
  { shots: 3, specialCrates: 1, crates: col(0, -40, 3) },
  // 2: three towers
  {
    shots: 3,
    specialCrates: 1,
    crates: [...col(-3, -40, 2), ...col(0, -40, 3), ...col(3, -40, 2)],
  },
  // 3: pyramid
  {
    shots: 4,
    specialCrates: 2,
    crates: [
      ...col(-1.7, -40, 1), ...col(0, -40, 1), ...col(1.7, -40, 1),
      [-0.85, HALF + H, -40], [0.85, HALF + H, -40],
      [0, HALF + 2 * H, -40],
    ],
  },
  // 4: wall + towers behind
  {
    shots: 4,
    specialCrates: 2,
    crates: [
      ...col(-2, -36, 2), ...col(0, -36, 2), ...col(2, -36, 2),
      ...col(-1, -42, 3), ...col(1, -42, 3),
    ],
  },
  // 5: castle gate — two thick towers and a spread
  {
    shots: 5,
    specialCrates: 3,
    crates: [
      ...col(-4, -40, 4), ...col(-2.4, -40, 3),
      ...col(4, -40, 4), ...col(2.4, -40, 3),
      ...col(0, -46, 2), [0, HALF, -34],
    ],
  },
]
