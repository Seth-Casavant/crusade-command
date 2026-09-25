import type { PublicCampaignState } from '../data/services/publicCampaign'

// Presentation copy only: identifiers, revisions and authoritative values stay intact.
function label(value: string): string {
  return value.replace(/\bsandbox\b/gi, (word) => word === 'sandbox' ? 'current' : word === 'SANDBOX' ? 'CURRENT' : 'Current')
}
function named<T extends { name: string }>(value: T): T {
  return { ...value, name: label(value.name) }
}
function described<T extends { description: string | null }>(value: T): T {
  return { ...value, description: value.description === null ? null : label(value.description) }
}
export function currentCampaignLabels(state: PublicCampaignState): PublicCampaignState {
  return {
    ...state,
    campaignName: label(state.campaignName), campaignDescription: label(state.campaignDescription),
    missionName: label(state.missionName), missionDescription: label(state.missionDescription),
    battlefieldName: label(state.battlefieldName), battlefieldDescription: label(state.battlefieldDescription),
    enemyFaction: label(state.enemyFaction),
    objectives: state.objectives.map(value => described({ ...value, title: label(value.title) })),
    enemies: state.enemies.map(value => described(named(value))),
    missionBoss: state.missionBoss ? described(named(state.missionBoss)) : null,
    crusadeScoringTargets: state.crusadeScoringTargets.map(value => described(named(value))),
    battlefieldCheckpoints: state.battlefieldCheckpoints.map(named),
    killTeams: state.killTeams.map(value => ({ ...named(value), members: value.members.map(member => ({ ...member, displayName: label(member.displayName) })) })),
  }
}
