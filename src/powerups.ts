export type PowerUpType = 'extra-shot' | 'blast-shot' | 'heavy-shot'

export interface ShotModifiers {
  blast?: boolean
  heavy?: boolean
}

export const POWER_UPS: PowerUpType[] = [
  'extra-shot',
  'blast-shot',
  'heavy-shot',
]

export const POWER_UP_LABELS: Record<PowerUpType, string> = {
  'extra-shot': '+1 shot',
  'blast-shot': 'Blast projectile next shot',
  'heavy-shot': 'Heavy projectile next shot',
}
