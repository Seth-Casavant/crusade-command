export type CommandStatus =
  | 'live'
  | 'ready'
  | 'active'
  | 'complete'
  | 'offline'
  | 'reconnecting'
  | 'locked'
  | 'hostile'
  | 'contested'
  | 'secured'

const STATUS_PRESENTATION: Record<
  CommandStatus,
  { label: string; mark: string }
> = {
  live: { label: 'Live', mark: '●' },
  ready: { label: 'Ready', mark: '◆' },
  active: { label: 'Active', mark: '▶' },
  complete: { label: 'Complete', mark: '■' },
  offline: { label: 'Offline', mark: '×' },
  reconnecting: { label: 'Reconnecting', mark: '↻' },
  locked: { label: 'Locked', mark: '▣' },
  hostile: { label: 'Hostile', mark: '▲' },
  contested: { label: 'Contested', mark: '◇' },
  secured: { label: 'Secured', mark: '✓' },
}

type StatusBadgeProps = {
  label?: string
  status: CommandStatus
}

export function StatusBadge({ label, status }: StatusBadgeProps) {
  const presentation = STATUS_PRESENTATION[status]

  return (
    <span className="command-status" data-status={status}>
      <span className="command-status__mark" aria-hidden="true">
        {presentation.mark}
      </span>
      {label ?? presentation.label}
    </span>
  )
}
