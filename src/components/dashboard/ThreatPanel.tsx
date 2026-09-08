import type {
  PublicCrusadeScoringTarget,
  PublicMissionBoss,
} from '../../data/services/publicCampaign'
import { Panel } from '../ui'

export type ThreatPanelProps = {
  missionBoss: PublicMissionBoss | null
  crusadeScoringTargets: readonly PublicCrusadeScoringTarget[]
}

export function ThreatPanel({
  missionBoss,
  crusadeScoringTargets,
}: ThreatPanelProps) {
  return (
    <Panel
      className="dashboard-panel threat-panel"
      eyebrow="Operational information"
      title="Threat Assessment"
    >
      <p className="threat-panel__designation">Terminus threat</p>

      <div className="threat-panel__section">
        <span className="dashboard-field-label">Mission boss</span>
        {missionBoss ? (
          <div className="threat-panel__boss">
            <strong>{missionBoss.name}</strong>
            {missionBoss.description ? <p>{missionBoss.description}</p> : null}
          </div>
        ) : (
          <p className="dashboard-empty-state">
            Mission boss data unavailable.
          </p>
        )}
      </div>

      <div className="threat-panel__section">
        <span className="dashboard-field-label">Crusade scoring targets</span>
        {crusadeScoringTargets.length === 0 ? (
          <p className="dashboard-empty-state">
            No Crusade scoring targets are currently configured.
          </p>
        ) : (
          <ul className="dashboard-entry-list">
            {crusadeScoringTargets.map((target) => (
              <li className="dashboard-entry threat-entry" key={target.id}>
                <span
                  aria-hidden="true"
                  className="threat-entry__marker"
                />
                <div className="dashboard-entry__content">
                  <div className="dashboard-entry__heading">
                    <h3>{target.name}</h3>
                    <span className="threat-entry__type">
                      Crusade scoring target
                    </span>
                  </div>
                  {target.description ? <p>{target.description}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
