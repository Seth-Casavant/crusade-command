import terminationDevelopmentSchematic from '../../assets/battlefields/termination-development.svg'

import type { TacticalAssetDefinition } from './types'

const tacticalAssetRegistry = Object.freeze({
  'termination-development': Object.freeze({
    id: 'termination-development',
    src: terminationDevelopmentSchematic,
    dimensions: Object.freeze({ width: 1600, height: 900 }),
  }),
}) satisfies Readonly<Record<string, TacticalAssetDefinition>>

export const tacticalAssetDefinitions: readonly TacticalAssetDefinition[] =
  Object.freeze(Object.values(tacticalAssetRegistry))

export function resolveTacticalAsset(
  assetId: string | null | undefined,
): TacticalAssetDefinition | null {
  if (!assetId || !Object.hasOwn(tacticalAssetRegistry, assetId)) {
    return null
  }

  return tacticalAssetRegistry[
    assetId as keyof typeof tacticalAssetRegistry
  ]
}
