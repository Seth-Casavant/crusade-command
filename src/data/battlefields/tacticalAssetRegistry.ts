import terminationDevelopmentSchematic from '../../assets/battlefields/termination-development.svg'

import type {
  BattlefieldDefinition,
  TacticalAssetAttribution,
  TacticalAssetDefinition,
  TacticalAssetDistribution,
  TacticalDimensions,
  TacticalOrientation,
} from './types'

const KIMBER_PRIME_ATTRIBUTION: TacticalAssetAttribution = Object.freeze({
  creator: 'Kimber Prime',
  sourceReference: 'Kimber Prime / kimberprime.com',
  redistributionStatus: 'permission-required',
})

type TacticalAssetInput = Readonly<{
  id: string
  src: string
  dimensions: TacticalDimensions
  distribution: TacticalAssetDistribution
  attribution?: TacticalAssetAttribution
}>

function defineTacticalAsset(
  input: TacticalAssetInput,
): TacticalAssetDefinition {
  const { dimensions } = input
  const orientation: TacticalOrientation =
    dimensions.width === dimensions.height
      ? 'square'
      : dimensions.width > dimensions.height
        ? 'landscape'
        : 'portrait'

  return Object.freeze({
    ...input,
    dimensions: Object.freeze({ ...dimensions }),
    aspectRatio: dimensions.width / dimensions.height,
    orientation,
  })
}

function defineKimberPrimeLocalAsset(
  id: string,
  src: string,
  width: number,
  height: number,
): TacticalAssetDefinition {
  return defineTacticalAsset({
    id,
    src,
    dimensions: { width, height },
    distribution: 'local-development',
    attribution: KIMBER_PRIME_ATTRIBUTION,
  })
}

const tacticalAssetRegistry = Object.freeze({
  'termination-development': defineTacticalAsset({
    id: 'termination-development',
    src: terminationDevelopmentSchematic,
    dimensions: { width: 1600, height: 900 },
    distribution: 'tracked',
  }),
  'kimber-prime-purgation-local': defineKimberPrimeLocalAsset(
    'kimber-prime-purgation-local',
    '/src/assets/battlefields/local-clean/purgation.png',
    3990,
    5000,
  ),
  'kimber-prime-reclamation-local': defineKimberPrimeLocalAsset(
    'kimber-prime-reclamation-local',
    '/src/assets/battlefields/local-clean/reclamation.png',
    1179,
    1414,
  ),
  'kimber-prime-inferno-local': defineKimberPrimeLocalAsset(
    'kimber-prime-inferno-local',
    '/src/assets/battlefields/local-clean/inferno.png',
    1179,
    1533,
  ),
  'kimber-prime-reliquary-local': defineKimberPrimeLocalAsset(
    'kimber-prime-reliquary-local',
    '/src/assets/battlefields/local-clean/reliquary.png',
    1179,
    1573,
  ),
  'kimber-prime-decapitation-local': defineKimberPrimeLocalAsset(
    'kimber-prime-decapitation-local',
    '/src/assets/battlefields/local-clean/decapitation.png',
    1179,
    1631,
  ),
  'kimber-prime-fall-of-atreus-local': defineKimberPrimeLocalAsset(
    'kimber-prime-fall-of-atreus-local',
    '/src/assets/battlefields/local-clean/fall-of-atreus.png',
    1179,
    1225,
  ),
  'kimber-prime-termination-local': defineKimberPrimeLocalAsset(
    'kimber-prime-termination-local',
    '/src/assets/battlefields/local-clean/termination.png',
    1179,
    1546,
  ),
  'kimber-prime-vox-liberatis-local': defineKimberPrimeLocalAsset(
    'kimber-prime-vox-liberatis-local',
    '/src/assets/battlefields/local-clean/vox-liberatis.png',
    1179,
    1545,
  ),
  'kimber-prime-ballistic-engine-local': defineKimberPrimeLocalAsset(
    'kimber-prime-ballistic-engine-local',
    '/src/assets/battlefields/local-clean/ballistic-engine.png',
    1179,
    1542,
  ),
  'kimber-prime-obelisk-local': defineKimberPrimeLocalAsset(
    'kimber-prime-obelisk-local',
    '/src/assets/battlefields/local-clean/obelisk.png',
    1179,
    1652,
  ),
  'kimber-prime-vortex-local': defineKimberPrimeLocalAsset(
    'kimber-prime-vortex-local',
    '/src/assets/battlefields/local-clean/vortex.png',
    1179,
    1294,
  ),
  'kimber-prime-disruption-local': defineKimberPrimeLocalAsset(
    'kimber-prime-disruption-local',
    '/src/assets/battlefields/local-clean/disruption.png',
    1179,
    1846,
  ),
  'kimber-prime-exfiltration-local': defineKimberPrimeLocalAsset(
    'kimber-prime-exfiltration-local',
    '/src/assets/battlefields/local-clean/exfiltration.png',
    1179,
    2556,
  ),
}) satisfies Readonly<Record<string, TacticalAssetDefinition>>

export const tacticalAssetDefinitions: readonly TacticalAssetDefinition[] =
  Object.freeze(Object.values(tacticalAssetRegistry))

export function resolveTacticalAsset(
  assetId: string | null | undefined,
): TacticalAssetDefinition | null {
  if (!assetId || !Object.hasOwn(tacticalAssetRegistry, assetId)) {
    return null
  }

  const asset = tacticalAssetRegistry[
    assetId as keyof typeof tacticalAssetRegistry
  ]

  if (asset.distribution === 'local-development' && !import.meta.env.DEV) {
    return null
  }

  return asset
}

export function resolveBattlefieldAssetCandidates(
  definition: BattlefieldDefinition,
): readonly TacticalAssetDefinition[] {
  const assetIds = [
    definition.tacticalAssetId,
    ...definition.fallbackTacticalAssetIds,
  ]
  const candidates: TacticalAssetDefinition[] = []

  for (const assetId of assetIds) {
    const asset = resolveTacticalAsset(assetId)

    if (asset && !candidates.some(({ id }) => id === asset.id)) {
      candidates.push(asset)
    }
  }

  return Object.freeze(candidates)
}
