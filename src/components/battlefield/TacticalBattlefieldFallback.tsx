import type { TacticalDimensions } from '../../data/battlefields'
import { TacticalBattlefieldFrame } from './TacticalBattlefieldFrame'

const DEFAULT_DIMENSIONS: TacticalDimensions = Object.freeze({
  width: 16,
  height: 9,
})

export type TacticalBattlefieldFallbackProps = {
  battlefieldName: string
  dimensions?: TacticalDimensions
}

export function TacticalBattlefieldFallback({
  battlefieldName,
  dimensions = DEFAULT_DIMENSIONS,
}: TacticalBattlefieldFallbackProps) {
  return (
    <TacticalBattlefieldFrame
      battlefieldName={battlefieldName}
      dimensions={dimensions}
    >
      <div
        aria-live="polite"
        className="tactical-battlefield__state tactical-battlefield__state--unavailable"
        role="status"
      >
        <strong>Tactical Cartography Unavailable</strong>
        <span>Battlefield: {battlefieldName}</span>
      </div>
    </TacticalBattlefieldFrame>
  )
}
