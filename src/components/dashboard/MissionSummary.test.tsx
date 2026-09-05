import { render, screen } from '@testing-library/react'

import { MissionSummary } from './MissionSummary'

const campaign = {
  missionName: 'Termination',
  missionDescription: 'Purge the manufactorum approaches.',
  battlefieldName: 'Inferno',
  battlefieldDescription: 'A refinery district under siege.',
}

describe('MissionSummary', () => {
  it('renders mission and locked battlefield information', () => {
    render(<MissionSummary campaign={campaign} />)

    expect(
      screen.getByRole('region', { name: 'Mission Briefing' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Termination' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Inferno')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Battlefield designation locked for this active operation.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('safely omits descriptions that are not published', () => {
    render(
      <MissionSummary
        campaign={{
          ...campaign,
          battlefieldDescription: '',
          missionDescription: '',
        }}
      />,
    )

    expect(screen.getByText('Termination')).toBeInTheDocument()
    expect(screen.getByText('Inferno')).toBeInTheDocument()
    expect(
      screen.queryByText('Purge the manufactorum approaches.'),
    ).not.toBeInTheDocument()
  })
})
