import { useState, type ReactNode } from 'react'

import {
  resolveBattlefieldDefinition,
  resolveTacticalAsset,
  type BattlefieldDefinition,
  type TacticalAssetDefinition,
} from '../../data/battlefields'
import { TacticalBattlefieldErrorBoundary } from './TacticalBattlefieldErrorBoundary'
import { TacticalBattlefieldFallback } from './TacticalBattlefieldFallback'
import { TacticalBattlefieldFrame } from './TacticalBattlefieldFrame'
import { TacticalOverlay } from './TacticalOverlay'

export type TacticalBattlefieldProps = {
  battlefieldId: string
  battlefieldName: string
  children?: ReactNode
}

type TacticalAssetStatus = 'loading' | 'ready' | 'error'

type ResolvedTacticalBattlefieldProps = TacticalBattlefieldProps & {
  asset: TacticalAssetDefinition
  definition: BattlefieldDefinition
}

function ResolvedTacticalBattlefield({
  asset,
  battlefieldName,
  children,
  definition,
}: ResolvedTacticalBattlefieldProps) {
  const [assetStatus, setAssetStatus] =
    useState<TacticalAssetStatus>('loading')

  if (assetStatus === 'error') {
    return (
      <TacticalBattlefieldFallback
        battlefieldName={battlefieldName}
        dimensions={definition.dimensions}
      />
    )
  }

  return (
    <TacticalBattlefieldFrame
      battlefieldName={battlefieldName}
      dimensions={definition.dimensions}
      isBusy={assetStatus === 'loading'}
    >
      <img
        alt={`Tactical schematic for ${battlefieldName}`}
        aria-hidden={assetStatus === 'loading'}
        className="tactical-battlefield__asset"
        data-status={assetStatus}
        draggable={false}
        height={asset.dimensions.height}
        onError={() => setAssetStatus('error')}
        onLoad={() => setAssetStatus('ready')}
        src={asset.src}
        width={asset.dimensions.width}
      />

      {assetStatus === 'loading' ? (
        <div
          aria-live="polite"
          className="tactical-battlefield__state tactical-battlefield__state--loading"
          role="status"
        >
          Loading Tactical Cartography...
        </div>
      ) : (
        <TacticalOverlay>{children}</TacticalOverlay>
      )}
    </TacticalBattlefieldFrame>
  )
}

function TacticalBattlefieldContent({
  battlefieldId,
  battlefieldName,
  children,
}: TacticalBattlefieldProps) {
  const definition = resolveBattlefieldDefinition(battlefieldId)
  const asset = resolveTacticalAsset(definition?.tacticalAssetId)

  if (!definition || !asset) {
    return (
      <TacticalBattlefieldFallback
        battlefieldName={battlefieldName}
        dimensions={definition?.dimensions}
      />
    )
  }

  const identityKey = `${battlefieldId}:${asset.id}`

  return (
    <ResolvedTacticalBattlefield
      asset={asset}
      battlefieldId={battlefieldId}
      battlefieldName={battlefieldName}
      definition={definition}
      key={identityKey}
    >
      {children}
    </ResolvedTacticalBattlefield>
  )
}

export function TacticalBattlefield({
  battlefieldId,
  battlefieldName,
  children,
}: TacticalBattlefieldProps) {
  const resetKey = `${battlefieldId}:${battlefieldName}`

  return (
    <TacticalBattlefieldErrorBoundary
      battlefieldName={battlefieldName}
      resetKey={resetKey}
    >
      <TacticalBattlefieldContent
        battlefieldId={battlefieldId}
        battlefieldName={battlefieldName}
      >
        {children}
      </TacticalBattlefieldContent>
    </TacticalBattlefieldErrorBoundary>
  )
}
