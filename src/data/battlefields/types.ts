export const battlefieldSlugs = [
  'inferno',
  'termination',
  'vox-liberatis',
  'reclamation',
  'disruption',
] as const

export type BattlefieldSlug = (typeof battlefieldSlugs)[number]

export type TacticalDimensions = Readonly<{
  width: number
  height: number
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
  dimensions: TacticalDimensions
  coordinateModel: NormalizedCoordinateModel
}>

export type TacticalAssetDefinition = Readonly<{
  id: string
  src: string
  dimensions: TacticalDimensions
}>
