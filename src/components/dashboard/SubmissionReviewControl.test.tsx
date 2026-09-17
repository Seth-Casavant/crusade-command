import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { SubmissionReviewControl } from './SubmissionReviewControl'

const scope = {
  campaignId: '00000000-0000-4000-8000-000000000001',
  missionId: '00000000-0000-4000-8000-000000000201',
}

describe('SubmissionReviewControl', () => {
  it('shows the authoritative pending count to an Administrator', async () => {
    const loadPendingCount = vi.fn(async () => 3)

    render(
      <SubmissionReviewControl
        {...scope}
        loadPendingCount={loadPendingCount}
        onNavigate={vi.fn()}
        role="ADMINISTRATOR"
      />,
    )

    expect(
      await screen.findByRole('button', { name: 'VIEW SUBMISSIONS (3)' }),
    ).toBeInTheDocument()
    expect(loadPendingCount).toHaveBeenCalledWith(scope)
  })

  it('shows the control to a Moderator without a suffix when the count is zero', async () => {
    render(
      <SubmissionReviewControl
        {...scope}
        loadPendingCount={vi.fn(async () => 0)}
        onNavigate={vi.fn()}
        role="MODERATOR"
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'VIEW SUBMISSIONS' }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText(/VIEW SUBMISSIONS \(0\)/)).not.toBeInTheDocument()
  })

  it.each([
    ['ordinary Player', 'PLAYER' as const],
    ['anonymous viewer', null],
  ])('is completely absent for an %s', (_, role) => {
    const loadPendingCount = vi.fn(async () => 7)

    render(
      <SubmissionReviewControl
        {...scope}
        loadPendingCount={loadPendingCount}
        onNavigate={vi.fn()}
        role={role}
      />,
    )

    expect(screen.queryByText(/VIEW SUBMISSIONS/)).not.toBeInTheDocument()
    expect(loadPendingCount).not.toHaveBeenCalled()
  })

  it('invokes the dashboard route action when activated', async () => {
    const onNavigate = vi.fn()

    render(
      <SubmissionReviewControl
        {...scope}
        loadPendingCount={vi.fn(async () => 1)}
        onNavigate={onNavigate}
        role="ADMINISTRATOR"
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'VIEW SUBMISSIONS (1)' }),
    )
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('fails closed without exposing an RPC error on the public dashboard', async () => {
    render(
      <SubmissionReviewControl
        {...scope}
        loadPendingCount={vi.fn(async () => {
          throw new Error('private provider detail')
        })}
        onNavigate={vi.fn()}
        role="MODERATOR"
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'VIEW SUBMISSIONS' }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText('private provider detail')).not.toBeInTheDocument()
  })

  it('places no private submission evidence or metadata on the dashboard', async () => {
    render(
      <SubmissionReviewControl
        {...scope}
        loadPendingCount={vi.fn(async () => 2)}
        onNavigate={vi.fn()}
        role="ADMINISTRATOR"
      />,
    )

    await screen.findByRole('button', { name: 'VIEW SUBMISSIONS (2)' })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText(/receipt/i)).not.toBeInTheDocument()
    expect(screen.queryByText('victory.png')).not.toBeInTheDocument()
  })
})
