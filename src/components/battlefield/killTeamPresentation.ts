export type BattlefieldCheckpointPresentation = Readonly<{
  id: string
  name: string
  x: number
  y: number
}>

export type KillTeamPresentation = Readonly<{
  crusadePoints: number
  currentCheckpointId: string | null
  id: string
  members: readonly Readonly<{ displayName: string }>[]
  name: string
  objectivesCompleted: number
  operationalStatus:
    | 'STAGING'
    | 'DEPLOYED'
    | 'ADVANCING'
    | 'OBJECTIVE'
    | 'DELAYED'
    | 'COMPLETE'
    | 'WITHDRAWN'
  terminusKills: number
}>

export type KillTeamMarkerOffset = Readonly<{ x: number; y: number }>

export function getKillTeamCheckpointMarkerOffset(
  index: number,
  teamCount: number,
): KillTeamMarkerOffset {
  if (teamCount <= 1) {
    return { x: 0, y: 0 }
  }

  const stableIndex = ((index % teamCount) + teamCount) % teamCount

  if (teamCount === 2) {
    return stableIndex === 0 ? { x: -30, y: 0 } : { x: 30, y: 0 }
  }

  const minimumCenterSpacing = 48
  const radius = Math.max(
    32,
    minimumCenterSpacing / (2 * Math.sin(Math.PI / teamCount)),
  )
  const angle = -Math.PI / 2 + (stableIndex * 2 * Math.PI) / teamCount

  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  }
}

export function getKillTeamAbbreviation(name: string): string {
  const words = name.match(/[a-z0-9]+/gi) ?? []

  if (words.length >= 2) {
    return `${words[0]?.[0] ?? '?'}${words[1]?.[0] ?? '?'}`.toUpperCase()
  }

  const word = words[0]?.toUpperCase() ?? ''
  return word.length >= 2 ? word.slice(0, 2) : word.padEnd(2, word || '?')
}
