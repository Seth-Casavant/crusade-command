export const battlefieldSlugs = [
  'purgation',
  'reclamation',
  'inferno',
  'reliquary',
  'decapitation',
  'fall-of-atreus',
  'termination',
  'vox-liberatis',
  'ballistic-engine',
  'obelisk',
  'vortex',
  'disruption',
  'exfiltration',
] as const

export type BattlefieldSlug = (typeof battlefieldSlugs)[number]

export type TacticalDimensions = Readonly<{
  width: number
  height: number
}>

export type TacticalOrientation = 'landscape' | 'portrait' | 'square'

export type TacticalAssetDistribution = 'tracked' | 'local-development'

export type TacticalAssetAttribution = Readonly<{
  creator: string
  sourceReference: string
  redistributionStatus: 'permission-required' | 'project-owned'
}>

export type NormalizedCoordinateModel = Readonly<{
  units: 'normalized'
  origin: 'top-left'
  xRange: readonly [0, 1]
  yRange: readonly [0, 1]
}>

export type BattlefieldDefinition = Readonly<{
  id: BattlefieldSlug
  slug: BattlefieldSlug
  displayName: string
  authoritativeIds: readonly string[]
  tacticalAssetId: string | null
  fallbackTacticalAssetIds: readonly string[]
  dimensions: TacticalDimensions
  aspectRatio: number
  orientation: TacticalOrientation
  coordinateModel: NormalizedCoordinateModel
  attribution?: TacticalAssetAttribution
  overlayMetadata?: Readonly<{
    coordinatePlane: 'full-asset'
  }>
}>

export type TacticalAssetDefinition = Readonly<{
  id: string
  src: string
  dimensions: TacticalDimensions
  aspectRatio: number
  orientation: TacticalOrientation
  distribution: TacticalAssetDistribution
  attribution?: TacticalAssetAttribution
}>
