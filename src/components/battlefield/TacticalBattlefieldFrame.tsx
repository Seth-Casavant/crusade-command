import { useId, type ReactNode } from 'react'

import type { TacticalDimensions } from '../../data/battlefields'
import { TacticalBattlefieldViewport } from './TacticalBattlefieldViewport'

export type TacticalBattlefieldFrameProps = {
  battlefieldName: string
  children: ReactNode
  dimensions: TacticalDimensions
  isInteractive?: boolean
  isBusy?: boolean
  statusLayer?: ReactNode
}

export function TacticalBattlefieldFrame({
  battlefieldName,
  children,
  dimensions,
  isInteractive = false,
  isBusy = false,
  statusLayer,
}: TacticalBattlefieldFrameProps) {
  const headingId = useId()
  const battlefieldNameId = useId()

  return (
    <section
      aria-labelledby={`${headingId} ${battlefieldNameId}`}
      className="tactical-battlefield"
    >
      <header className="tactical-battlefield__header">
        <div>
          <p className="tactical-battlefield__eyebrow">Tactical Cartography</p>
          <h2 className="tactical-battlefield__title" id={headingId}>
            Tactical Battlefield
          </h2>
        </div>
        <p className="tactical-battlefield__designation">
          <span>Active battlefield</span>
          <strong id={battlefieldNameId}>{battlefieldName}</strong>
        </p>
      </header>

      {isInteractive ? (
        <TacticalBattlefieldViewport
          battlefieldName={battlefieldName}
          dimensions={dimensions}
          disabled={isBusy}
          isBusy={isBusy}
          statusLayer={statusLayer}
        >
          {children}
        </TacticalBattlefieldViewport>
      ) : (
        <div
          aria-busy={isBusy || undefined}
          className="tactical-battlefield__viewport"
          style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
        >
          {children}
        </div>
      )}
    </section>
  )
}
