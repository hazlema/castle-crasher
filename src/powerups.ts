export type PowerUpType =
  | 'extra-shot'
  | 'blast-shot'
  | 'heavy-shot'
  | 'multi-shot'
  | 'bouncy-shot'

export interface ShotModifiers {
  blast?: boolean
  heavy?: boolean
  multi?: boolean
  bouncy?: boolean
}

export const POWER_UPS: PowerUpType[] = [
  'extra-shot',
  'blast-shot',
  'heavy-shot',
  'multi-shot',
  'bouncy-shot',
]

export const POWER_UP_LABELS: Record<PowerUpType, string> = {
  'extra-shot': '+1 shot',
  'blast-shot': 'Blast projectile next shot',
  'heavy-shot': 'Heavy projectile next shot',
  'multi-shot': 'Triple projectile next shot',
  'bouncy-shot': 'Bouncy projectile next shot',
}

// Short screen-label text for floating pickup labels
export const POWER_UP_SHORT: Record<PowerUpType, string> = {
  'extra-shot': '+1 SHOT!',
  'blast-shot': 'BLAST!',
  'heavy-shot': 'HEAVY!',
  'multi-shot': 'MULTI!',
  'bouncy-shot': 'BOUNCY!',
}
