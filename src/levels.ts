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
  // 6: twin keeps with a gatehouse between
  {
    shots: 5,
    specialCrates: 2,
    crates: [
      ...col(-3, -40, 4), ...col(3, -40, 4), ...col(0, -40, 2),
    ],
  },
  // 7: the staircase — each column one taller than the last
  {
    shots: 5,
    specialCrates: 3,
    crates: [
      ...col(-6, -40, 1), ...col(-3, -40, 2), ...col(0, -40, 3),
      ...col(3, -40, 4), ...col(6, -40, 5),
    ],
  },
  // 8: courtyard — low front wall guarding tall rear towers
  {
    shots: 6,
    specialCrates: 3,
    crates: [
      ...col(-2, -36, 2), ...col(0, -36, 2), ...col(2, -36, 2),
      ...col(-4, -44, 3), ...col(4, -44, 3), ...col(0, -46, 4),
    ],
  },
  // 9: the great wall — wide rampart with a keep hidden behind
  {
    shots: 6,
    specialCrates: 3,
    crates: [
      ...col(-5, -40, 3), ...col(-3, -40, 3), ...col(-1, -40, 3),
      ...col(1, -40, 3), ...col(3, -40, 3), ...col(5, -40, 3),
      ...col(0, -48, 4),
    ],
  },
  // 10: the citadel — grand pyramid flanked by watchtowers
  {
    shots: 7,
    specialCrates: 4,
    crates: [
      ...col(-3.4, -42, 1), ...col(-1.7, -42, 1), ...col(0, -42, 1),
      ...col(1.7, -42, 1), ...col(3.4, -42, 1),
      [-2.55, HALF + H, -42], [-0.85, HALF + H, -42],
      [0.85, HALF + H, -42], [2.55, HALF + H, -42],
      [-1.7, HALF + 2 * H, -42], [0, HALF + 2 * H, -42],
      [1.7, HALF + 2 * H, -42],
      [-0.85, HALF + 3 * H, -42], [0.85, HALF + 3 * H, -42],
      [0, HALF + 4 * H, -42],
      ...col(-6, -38, 3), ...col(6, -38, 3),
    ],
  },
]
