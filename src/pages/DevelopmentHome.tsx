import { AuthPanel } from '../components/auth/AuthPanel'
import { CampaignSyncPanel } from '../components/sync/CampaignSyncPanel'
import { Button, Panel, ProgressMeter, StatusBadge } from '../components/ui'

const foundations = [
  'React + TypeScript',
  'Authoritative PostgreSQL state',
  'Supabase Auth foundation',
  'Revision-based synchronization',
]

export function DevelopmentHome() {
  return (
    <main className="launch-screen">
      <div className="strategium-shell">
        <header className="strategium-masthead">
          <div>
            <p className="strategium-masthead__index">Strategium / Node 01</p>
            <h1 className="strategium-title">Crusade Command</h1>
          </div>
          <div className="strategium-masthead__status">
            <StatusBadge status="ready" label="System status: Ready" />
          </div>
        </header>

        <div className="foundation-grid">
          <Panel
            className="foundation-panel"
            eyebrow="Foundation docket"
            footer="Synchronization foundation — no finished dashboard"
            title="Phase 4 Foundation"
          >
            <div>
              <p className="foundation-copy">
                Identity, authorization, and recovery-aware synchronization are
                prepared. The database remains the only authoritative state.
              </p>

              <div className="foundation-list">
                <p className="foundation-list__label">Verified systems</p>
                <ul>
                  {foundations.map((foundation) => (
                    <li key={foundation}>
                      <span className="foundation-list__mark" aria-hidden="true">
                        +
                      </span>
                      {foundation}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="foundation-progress">
              <ProgressMeter value={67} />
            </div>
          </Panel>

          <Panel eyebrow="Visual language" title="Command Specimens">
            <div className="specimen-stack">
              <p className="specimen-label">Operational states</p>
              <div className="specimen-statuses">
                <StatusBadge status="live" />
                <StatusBadge status="locked" />
                <StatusBadge status="hostile" />
                <StatusBadge status="contested" />
                <StatusBadge status="secured" />
              </div>

              <div className="specimen-controls">
                <p className="specimen-label">Command controls</p>
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>
          </Panel>

          <AuthPanel />

          <CampaignSyncPanel />
        </div>

        <footer className="strategium-footer">
          <span>Sandbox authentication foundation</span>
          <span>Phase 4 / Public synchronization</span>
        </footer>
      </div>
    </main>
  )
}
