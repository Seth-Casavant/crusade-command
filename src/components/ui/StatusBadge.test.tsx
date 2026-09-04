import { render, screen } from '@testing-library/react'

import { StatusBadge, type CommandStatus } from './StatusBadge'

const statuses: CommandStatus[] = [
  'live',
  'ready',
  'active',
  'complete',
  'offline',
  'reconnecting',
  'locked',
  'hostile',
  'contested',
  'secured',
]

describe('StatusBadge', () => {
  it.each(statuses)('renders readable text for %s state', (status) => {
    render(<StatusBadge status={status} />)

    expect(screen.getByText(new RegExp(status, 'i'))).toBeInTheDocument()
  })
})
