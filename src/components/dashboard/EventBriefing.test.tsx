import { render, screen } from '@testing-library/react'
import { EventBriefing } from './EventBriefing'

it('shows published targets and rules without implying live scores or rendering a map', () => {
  render(<EventBriefing briefing={{
    title: 'The Midnight Hunt', description: 'Hunt the marked prey.',
    targets: ['Carnifex', 'Terminator Sorcerer'], modes: ['Siege', 'PvE / Operations'],
    rules: ['Staff assign points manually.'],
  }} />)
  expect(screen.getByRole('heading', { level: 1, name: 'The Midnight Hunt' })).toBeInTheDocument()
  expect(screen.getByText('Carnifex')).toBeInTheDocument()
  expect(screen.getByText('Terminator Sorcerer')).toBeInTheDocument()
  expect(screen.getByText('Siege // PvE / Operations')).toBeInTheDocument()
  expect(screen.getByText(/Live scores appear when the operation is activated/)).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
