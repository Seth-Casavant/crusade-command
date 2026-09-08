import type { PublicKillTeam } from '../../data/services/publicCampaign'
import { Panel } from '../ui'

export type FriendlyForcesPanelProps = {
  killTeams: readonly PublicKillTeam[]
}

export function FriendlyForcesPanel({
  killTeams,
}: FriendlyForcesPanelProps) {
  return (
    <Panel
      className="dashboard-panel friendly-forces-panel"
      eyebrow="Operational information"
      title="Friendly Forces"
    >
      <p className="friendly-forces-panel__designation">
        Deployed Kill Teams
      </p>

      {killTeams.length === 0 ? (
        <p className="dashboard-empty-state">
          No Kill Teams are currently assigned to this mission.
        </p>
      ) : (
        <ul
          aria-label="Deployed Kill Teams"
          className="friendly-forces-panel__teams"
        >
          {killTeams.map((team) => (
            <li className="friendly-force-team" key={team.id}>
              <h3>{team.name}</h3>
              <ul
                aria-label={`${team.name} members`}
                className="friendly-force-team__members"
              >
                {team.members.map((member, index) => (
                  <li key={`${team.id}:${index}`}>{member.displayName}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
