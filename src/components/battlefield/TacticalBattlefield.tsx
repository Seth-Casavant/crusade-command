import { useState, type ReactNode } from 'react'

import {
  resolveBattlefieldDefinition,
  resolveBattlefieldAssetCandidates,
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
  assetCandidates: readonly TacticalAssetDefinition[]
  definition: BattlefieldDefinition
}

type TacticalAssetState = Readonly<{
  candidateIndex: number
  status: TacticalAssetStatus
}>

function ResolvedTacticalBattlefield({
  assetCandidates,
  battlefieldName,
  children,
  definition,
}: ResolvedTacticalBattlefieldProps) {
  const [assetState, setAssetState] = useState<TacticalAssetState>({
    candidateIndex: 0,
    status: 'loading',
  })
  const asset = assetCandidates[assetState.candidateIndex]

  if (!asset || assetState.status === 'error') {
    return (
      <TacticalBattlefieldFallback
        battlefieldName={battlefieldName}
        dimensions={asset?.dimensions ?? definition.dimensions}
      />
    )
  }

  const handleAssetError = () => {
    setAssetState((currentState) => {
      const nextCandidateIndex = currentState.candidateIndex + 1

      if (nextCandidateIndex < assetCandidates.length) {
        return { candidateIndex: nextCandidateIndex, status: 'loading' }
      }

      return { ...currentState, status: 'error' }
    })
  }

  return (
    <TacticalBattlefieldFrame
      battlefieldName={battlefieldName}
      dimensions={asset.dimensions}
      isInteractive
      isBusy={assetState.status === 'loading'}
      key={asset.id}
      statusLayer={
        assetState.status === 'loading' ? (
          <div
            aria-live="polite"
            className="tactical-battlefield__state tactical-battlefield__state--loading"
            role="status"
          >
            Loading Tactical Cartography...
          </div>
        ) : null
      }
    >
      <img
        alt={`Tactical schematic for ${battlefieldName}`}
        aria-hidden={assetState.status === 'loading'}
        className="tactical-battlefield__asset"
        data-status={assetState.status}
        data-tactical-asset-id={asset.id}
        draggable={false}
        height={asset.dimensions.height}
        onError={handleAssetError}
        onLoad={() =>
          setAssetState((currentState) => ({
            ...currentState,
            status: 'ready',
          }))
        }
        src={asset.src}
        width={asset.dimensions.width}
      />

      {assetState.status === 'ready' ? (
        <TacticalOverlay>{children}</TacticalOverlay>
      ) : null}
    </TacticalBattlefieldFrame>
  )
}

function TacticalBattlefieldContent({
  battlefieldId,
  battlefieldName,
  children,
}: TacticalBattlefieldProps) {
  const definition = resolveBattlefieldDefinition(battlefieldId)
  const assetCandidates = definition
    ? resolveBattlefieldAssetCandidates(definition)
    : []

  if (!definition || assetCandidates.length === 0) {
    return (
      <TacticalBattlefieldFallback
        battlefieldName={battlefieldName}
        dimensions={definition?.dimensions}
      />
    )
  }

  const identityKey = `${battlefieldId}:${assetCandidates
    .map(({ id }) => id)
    .join(':')}`

  return (
    <ResolvedTacticalBattlefield
      assetCandidates={assetCandidates}
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
