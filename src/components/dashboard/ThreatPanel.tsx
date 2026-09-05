import type {
  PublicCampaignState,
  PublicEnemy,
} from '../../data/services/publicCampaign'
import { Panel } from '../ui'

export type ThreatPanelProps = {
  enemies: readonly PublicEnemy[]
  enemyFaction: PublicCampaignState['enemyFaction']
}

export function ThreatPanel({
  enemies,
  enemyFaction,
}: ThreatPanelProps) {
  return (
    <Panel
      className="dashboard-panel threat-panel"
      eyebrow="Operational information"
      title="Threat Assessment"
    >
      {enemyFaction ? (
        <div className="threat-panel__faction">
          <span className="dashboard-field-label">Hostile force</span>
          <strong>{enemyFaction}</strong>
        </div>
      ) : null}

      {enemies.length === 0 ? (
        <p className="dashboard-empty-state">
          No hostile contacts are currently published.
        </p>
      ) : (
        <ul className="dashboard-entry-list">
          {enemies.map((enemy) => (
            <li className="dashboard-entry threat-entry" key={enemy.id}>
              <span
                aria-hidden="true"
                className="threat-entry__marker"
              />
              <div className="dashboard-entry__content">
                <div className="dashboard-entry__heading">
                  <h3>{enemy.name}</h3>
                  {enemy.enemyType ? (
                    <span className="threat-entry__type">
                      {enemy.enemyType}
                    </span>
                  ) : null}
                </div>
                {enemy.description ? <p>{enemy.description}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
