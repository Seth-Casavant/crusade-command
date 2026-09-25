import type {
  BattlefieldDefinition,
  BattlefieldSlug,
  NormalizedCoordinateModel,
  TacticalOrientation,
} from './types'

const KIMBER_PRIME_ATTRIBUTION = Object.freeze({
  creator: 'Kimber Prime',
  sourceReference: 'Kimber Prime / kimberprime.com',
  redistributionStatus: 'permission-required' as const,
})

const NORMALIZED_COORDINATE_MODEL: NormalizedCoordinateModel = Object.freeze({
  units: 'normalized',
  origin: 'top-left',
  xRange: Object.freeze([0, 1] as const),
  yRange: Object.freeze([0, 1] as const),
})

function defineBattlefield(
  definition: Omit<
    BattlefieldDefinition,
    'aspectRatio' | 'coordinateModel' | 'orientation' | 'overlayMetadata'
  >,
): BattlefieldDefinition {
  const aspectRatio = definition.dimensions.width / definition.dimensions.height
  const orientation: TacticalOrientation =
    definition.dimensions.width === definition.dimensions.height
      ? 'square'
      : definition.dimensions.width > definition.dimensions.height
        ? 'landscape'
        : 'portrait'

  return Object.freeze({
    ...definition,
    authoritativeIds: Object.freeze([...definition.authoritativeIds]),
    fallbackTacticalAssetIds: Object.freeze([
      ...definition.fallbackTacticalAssetIds,
    ]),
    dimensions: Object.freeze({ ...definition.dimensions }),
    aspectRatio,
    orientation,
    coordinateModel: NORMALIZED_COORDINATE_MODEL,
    overlayMetadata: Object.freeze({ coordinatePlane: 'full-asset' as const }),
  })
}

export const battlefieldDefinitions: readonly BattlefieldDefinition[] =
  Object.freeze([
    defineBattlefield({
      id: 'purgation',
      slug: 'purgation',
      displayName: 'Purgation',
      authoritativeIds: [],
      tacticalAssetId: 'kimber-prime-purgation-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 3990, height: 5000 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'reclamation',
      slug: 'reclamation',
      displayName: 'Reclamation',
      authoritativeIds: [
        '00000000-0000-4000-8000-000000000103',
        '10000000-0000-4000-8000-000000000103',
      ],
      tacticalAssetId: 'kimber-prime-reclamation-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1414 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'inferno',
      slug: 'inferno',
      displayName: 'Inferno',
      authoritativeIds: [],
      tacticalAssetId: 'kimber-prime-inferno-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1533 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'reliquary',
      slug: 'reliquary',
      displayName: 'Reliquary',
      authoritativeIds: [],
      tacticalAssetId: 'kimber-prime-reliquary-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1573 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'decapitation',
      slug: 'decapitation',
      displayName: 'Decapitation',
      authoritativeIds: [],
      tacticalAssetId: 'kimber-prime-decapitation-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1631 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'fall-of-atreus',
      slug: 'fall-of-atreus',
      displayName: 'Fall of Atreus',
      authoritativeIds: [],
      tacticalAssetId: 'kimber-prime-fall-of-atreus-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1225 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'termination',
      slug: 'termination',
      displayName: 'Termination',
      authoritativeIds: [
        '00000000-0000-4000-8000-000000000101',
        '10000000-0000-4000-8000-000000000101',
      ],
      tacticalAssetId: 'kimber-prime-termination-local',
      fallbackTacticalAssetIds: ['termination-development'],
      dimensions: { width: 1179, height: 1546 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'vox-liberatis',
      slug: 'vox-liberatis',
      displayName: 'Vox Liberatis',
      authoritativeIds: [
        '00000000-0000-4000-8000-000000000102',
        '10000000-0000-4000-8000-000000000102',
      ],
      tacticalAssetId: 'kimber-prime-vox-liberatis-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1545 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'ballistic-engine',
      slug: 'ballistic-engine',
      displayName: 'Ballistic Engine',
      authoritativeIds: [],
      tacticalAssetId: 'kimber-prime-ballistic-engine-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1542 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'obelisk',
      slug: 'obelisk',
      displayName: 'Obelisk',
      authoritativeIds: [],
      tacticalAssetId: 'kimber-prime-obelisk-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1652 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'vortex',
      slug: 'vortex',
      displayName: 'Vortex',
      authoritativeIds: [],
      tacticalAssetId: 'kimber-prime-vortex-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1294 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'disruption',
      slug: 'disruption',
      displayName: 'Disruption',
      authoritativeIds: [
        '00000000-0000-4000-8000-000000000104',
        '10000000-0000-4000-8000-000000000104',
      ],
      tacticalAssetId: 'kimber-prime-disruption-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 1846 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
    }),
    defineBattlefield({
      id: 'exfiltration',
      slug: 'exfiltration',
      displayName: 'Exfiltration',
      authoritativeIds: [],
      tacticalAssetId: 'kimber-prime-exfiltration-local',
      fallbackTacticalAssetIds: [],
      dimensions: { width: 1179, height: 2556 },
      attribution: KIMBER_PRIME_ATTRIBUTION,
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
