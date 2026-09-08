import type {
  BattlefieldCheckpointPresentation,
  KillTeamPresentation,
} from './killTeamPresentation'

export type KillTeamIntelPanelProps = {
  checkpoint: BattlefieldCheckpointPresentation | null
  team: KillTeamPresentation | null
}

export function KillTeamIntelPanel({
  checkpoint,
  team,
}: KillTeamIntelPanelProps) {
  return (
    <aside
      aria-label="Kill Team Intel"
      className="kill-team-intel"
      data-testid="kill-team-intel-panel"
    >
      <header className="kill-team-intel__header">
        <p>Deployment intelligence</p>
        <h2>Kill Team Intel</h2>
      </header>

      {!team || !checkpoint ? (
        <p className="kill-team-intel__empty">
          Select a Kill Team marker to view deployment data.
        </p>
      ) : (
        <div className="kill-team-intel__content">
          <section aria-labelledby="kill-team-intel-team">
            <p>Selected force</p>
            <h3 id="kill-team-intel-team">{team.name}</h3>
          </section>
          <dl className="kill-team-intel__facts">
            <div>
              <dt>Current checkpoint</dt>
              <dd>{checkpoint.name}</dd>
            </div>
          </dl>
          <section aria-labelledby="kill-team-intel-members">
            <h3 id="kill-team-intel-members">Battle-brothers</h3>
            <ul aria-label={`${team.name} members`}>
              {team.members.map((member) => (
                <li key={member.displayName}>{member.displayName}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </aside>
  )
}
