import { render, screen } from '@testing-library/react'

import type { PublicObjective } from '../../data/services/publicCampaign'
import { ObjectivePanel } from './ObjectivePanel'

const objectives: PublicObjective[] = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    title: 'Secure the relay',
    description: 'Hold the relay against the first assault.',
    status: 'ACTIVE',
    sortOrder: 0,
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    title: 'Purge the lower decks',
    description: null,
    status: 'PENDING',
    sortOrder: 1,
  },
]

describe('ObjectivePanel', () => {
  it('renders multiple objectives, descriptions, and readable statuses', () => {
    render(<ObjectivePanel objectives={objectives} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(
      screen.getByRole('heading', { name: 'Secure the relay' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Purge the lower decks')).toBeInTheDocument()
    expect(
      screen.getByText('Hold the relay against the first assault.'),
    ).toBeInTheDocument()
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('renders a deliberate empty state when no objectives are published', () => {
    render(<ObjectivePanel objectives={[]} />)

    expect(
      screen.getByText(
        'No objectives are currently published for this operation.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
