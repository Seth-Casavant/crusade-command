import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { SynchronizationStatus } from './SynchronizationStatus'

const baseProps = {
  authoritativeUpdatedAt: '2026-09-05T15:04:00.000Z',
  connectionStatus: 'LIVE' as const,
  isConfigured: true,
  isResynchronizing: false,
  lastSynchronizedAt: '2026-09-05T15:05:00.000Z',
}

describe('SynchronizationStatus', () => {
  it('keeps authoritative and client timestamps distinctly labelled', () => {
    const { container } = render(
      <SynchronizationStatus
        {...baseProps}
        onResynchronize={() => undefined}
      />,
    )

    expect(screen.getByText('State updated')).toBeInTheDocument()
    expect(screen.getByText('Last sync')).toBeInTheDocument()
    expect(container.querySelectorAll('time')).toHaveLength(2)
    expect(
      container.querySelector('time[datetime="2026-09-05T15:04:00.000Z"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('time[datetime="2026-09-05T15:05:00.000Z"]'),
    ).toBeInTheDocument()
  })

  it('invokes the supplied authoritative resynchronization action', () => {
    const onResynchronize = vi.fn()
    render(
      <SynchronizationStatus
        {...baseProps}
        onResynchronize={onResynchronize}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resync' }))

    expect(onResynchronize).toHaveBeenCalledOnce()
  })

  it('prevents repeated resync while synchronization is in progress', () => {
    render(
      <SynchronizationStatus
        {...baseProps}
        isResynchronizing
        onResynchronize={() => undefined}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Synchronizing' }),
    ).toBeDisabled()
  })

  it('retains the explicit last-known-state message while offline', () => {
    render(
      <SynchronizationStatus
        {...baseProps}
        connectionStatus="OFFLINE"
        onResynchronize={() => undefined}
      />,
    )

    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(
      screen.getByText('Showing last known campaign state.'),
    ).toBeInTheDocument()
  })
})
