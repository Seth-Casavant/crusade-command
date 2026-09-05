import type { PublicObjective } from '../../data/services/publicCampaign'
import { Panel, StatusBadge, type CommandStatus } from '../ui'

const objectiveStatusPresentation: Record<
  PublicObjective['status'],
  CommandStatus
> = {
  PENDING: 'ready',
  ACTIVE: 'active',
  COMPLETE: 'complete',
}

export type ObjectivePanelProps = {
  objectives: readonly PublicObjective[]
}

export function ObjectivePanel({ objectives }: ObjectivePanelProps) {
  return (
    <Panel
      className="dashboard-panel objective-panel"
      eyebrow="Operational information"
      title="Current Objectives"
    >
      {objectives.length === 0 ? (
        <p className="dashboard-empty-state">
          No objectives are currently published for this operation.
        </p>
      ) : (
        <ol className="dashboard-entry-list">
          {objectives.map((objective, index) => (
            <li className="dashboard-entry objective-entry" key={objective.id}>
              <div aria-hidden="true" className="dashboard-entry__index">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="dashboard-entry__content">
                <div className="dashboard-entry__heading">
                  <h3>{objective.title}</h3>
                  <StatusBadge
                    label={objective.status}
                    status={objectiveStatusPresentation[objective.status]}
                  />
                </div>
                {objective.description ? (
                  <p>{objective.description}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
