export type BattlefieldCheckpointPresentation = Readonly<{
  id: string
  name: string
  x: number
  y: number
}>

export type KillTeamPresentation = Readonly<{
  currentCheckpointId: string | null
  id: string
  members: readonly Readonly<{ displayName: string }>[]
  name: string
}>

export type KillTeamMarkerOffset = Readonly<{ x: number; y: number }>

const collisionOffsets: readonly KillTeamMarkerOffset[] = [
  { x: 0, y: 0 },
  { x: -18, y: -18 },
  { x: 18, y: 18 },
  { x: 18, y: -18 },
  { x: -18, y: 18 },
  { x: 0, y: -26 },
  { x: 26, y: 0 },
  { x: 0, y: 26 },
  { x: -26, y: 0 },
]

export function getKillTeamCheckpointMarkerOffset(
  index: number,
): KillTeamMarkerOffset {
  return collisionOffsets[index % collisionOffsets.length] ?? collisionOffsets[0]
}

export function getKillTeamAbbreviation(name: string): string {
  const words = name.match(/[a-z0-9]+/gi) ?? []

  if (words.length >= 2) {
    return `${words[0]?.[0] ?? '?'}${words[1]?.[0] ?? '?'}`.toUpperCase()
  }

  const word = words[0]?.toUpperCase() ?? ''
  return word.length >= 2 ? word.slice(0, 2) : word.padEnd(2, word || '?')
}
