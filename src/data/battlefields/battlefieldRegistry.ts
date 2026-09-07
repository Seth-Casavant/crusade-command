import type {
  BattlefieldDefinition,
  BattlefieldSlug,
  NormalizedCoordinateModel,
  TacticalDimensions,
} from './types'

const DEVELOPMENT_DIMENSIONS: TacticalDimensions = Object.freeze({
  width: 1600,
  height: 900,
})

const NORMALIZED_COORDINATE_MODEL: NormalizedCoordinateModel = Object.freeze({
  units: 'normalized',
  origin: 'top-left',
  xRange: Object.freeze([0, 1] as const),
  yRange: Object.freeze([0, 1] as const),
})

function defineBattlefield(
  definition: Omit<BattlefieldDefinition, 'coordinateModel' | 'dimensions'>,
): BattlefieldDefinition {
  return Object.freeze({
    ...definition,
    authoritativeIds: Object.freeze([...definition.authoritativeIds]),
    dimensions: DEVELOPMENT_DIMENSIONS,
    coordinateModel: NORMALIZED_COORDINATE_MODEL,
  })
}

export const battlefieldDefinitions: readonly BattlefieldDefinition[] =
  Object.freeze([
    defineBattlefield({
      id: 'inferno',
      slug: 'inferno',
      displayName: 'Inferno',
      authoritativeIds: [],
      tacticalAssetId: null,
    }),
    defineBattlefield({
      id: 'termination',
      slug: 'termination',
      displayName: 'Termination',
      authoritativeIds: ['00000000-0000-4000-8000-000000000101'],
      tacticalAssetId: 'termination-development',
    }),
    defineBattlefield({
      id: 'vox-liberatis',
      slug: 'vox-liberatis',
      displayName: 'Vox Liberatis',
      authoritativeIds: ['00000000-0000-4000-8000-000000000102'],
      tacticalAssetId: null,
    }),
    defineBattlefield({
      id: 'reclamation',
      slug: 'reclamation',
      displayName: 'Reclamation',
      authoritativeIds: ['00000000-0000-4000-8000-000000000103'],
      tacticalAssetId: null,
    }),
    defineBattlefield({
      id: 'disruption',
      slug: 'disruption',
      displayName: 'Disruption',
      authoritativeIds: ['00000000-0000-4000-8000-000000000104'],
      tacticalAssetId: null,
    }),
  ])

const definitionsBySlug = new Map<BattlefieldSlug, BattlefieldDefinition>(
  battlefieldDefinitions.map((definition) => [definition.slug, definition]),
)

const definitionsByAuthoritativeId = new Map<string, BattlefieldDefinition>(
  battlefieldDefinitions.flatMap((definition) =>
    definition.authoritativeIds.map((id) => [id, definition] as const),
  ),
)

export function findBattlefieldDefinitionBySlug(
  slug: string,
): BattlefieldDefinition | null {
  return definitionsBySlug.get(slug as BattlefieldSlug) ?? null
}

export function resolveBattlefieldDefinition(
  authoritativeBattlefieldId: string,
): BattlefieldDefinition | null {
  return definitionsByAuthoritativeId.get(authoritativeBattlefieldId) ?? null
}
