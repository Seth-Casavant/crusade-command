import { render, screen } from '@testing-library/react'

import { ConnectionIndicator } from './ConnectionIndicator'
import { CrusadeHeader } from './CrusadeHeader'
import {
  MissionStatusIndicator,
  type PublicMissionStatus,
} from './MissionStatusIndicator'

describe('CrusadeHeader', () => {
  it('renders authoritative Crusade identity with readable statuses', () => {
    render(
      <CrusadeHeader
        campaign={{
          campaignName: 'The Kharon Purgation',
          missionStatus: 'ACTIVE',
        }}
        connectionStatus="LIVE"
      />,
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'The Kharon Purgation',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Crusade Command')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })
})

describe('MissionStatusIndicator', () => {
  it.each<PublicMissionStatus>([
    'READY',
    'ACTIVE',
    'COMPLETE',
    'ABORTED',
  ])('presents the %s state as text', (status) => {
    render(<MissionStatusIndicator status={status} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      new RegExp(status, 'i'),
    )
  })
})

describe('ConnectionIndicator', () => {
  it.each(['LIVE', 'SYNCING', 'RECONNECTING'] as const)(
    'presents the %s connection state as text',
    (status) => {
      render(<ConnectionIndicator status={status} />)

      expect(screen.getByRole('status')).toHaveTextContent(
        new RegExp(status, 'i'),
      )
    },
  )

  it('identifies retained state while offline', () => {
    render(<ConnectionIndicator status="OFFLINE" />)

    expect(screen.getByRole('status')).toHaveTextContent('Offline')
    expect(
      screen.getByText('Showing last known campaign state.'),
    ).toBeInTheDocument()
  })
})
