import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'

import type { AuthenticationState } from '../data/services/auth'
import type { PublicCampaignState } from '../data/services/publicCampaign'
import {
  StaffSubmissionError,
  type StaffSubmission,
  type StaffSubmissionService,
  type SubmissionQueueFilters,
} from '../data/services/staffSubmissions'
import type { StaffSubmissionsRouteProps } from './StaffSubmissions'
import { StaffSubmissionsRoute } from './StaffSubmissions'

const campaign: PublicCampaignState = {
  campaignId: '00000000-0000-4000-8000-000000000001',
  campaignName: 'The Kharon Purgation',
  campaignDescription: 'A Crusade.',
  missionId: '00000000-0000-4000-8000-000000000201',
  missionName: 'Operation Ashen Spear',
  missionDescription: 'Purge the enemy.',
  missionStatus: 'ACTIVE',
  battlefieldId: '00000000-0000-4000-8000-000000000101',
  battlefieldName: 'Termination',
  battlefieldDescription: 'A fortress.',
  enemyFaction: 'Tyranids',
  campaignProgress: 67,
  crusadePoints: 24,
  revision: 8,
  authoritativeUpdatedAt: '2026-09-17T12:00:00.000Z',
  objectives: [],
  enemies: [],
  missionBoss: null,
  crusadeScoringTargets: [],
  battlefieldCheckpoints: [],
  killTeams: [],
}

const pendingSubmission: StaffSubmission = {
  id: '00000000-0000-4000-8000-000000000901',
  receiptReference: 'CRS-000901',
  submittedAt: '2026-09-17T12:00:00.000Z',
  campaignId: campaign.campaignId,
  missionId: campaign.missionId,
  eventType: 'TERMINUS_KILL',
  killTeamId: '00000000-0000-4000-8000-000000000501',
  killTeamName: 'Kill Team Alpha',
  submittingMemberDisplayName: 'Brother Titus',
  scoringTargetKey: 'terminus-alpha',
  scoringTargetName: 'Carnifex Prime',
  playerNote: 'Target eliminated at the relay.',
  evidenceOriginalFilename: 'victory.png',
  evidenceContentType: 'image/png',
  evidenceSourceReference: 'https://cdn.example.test/victory.png',
  evidenceStoragePath: null,
  evidenceFileSizeBytes: 1024,
  evidencePreviewUrl: 'https://cdn.example.test/victory.png',
  reviewStatus: 'PENDING',
  reviewerId: null,
  reviewerRole: null,
  moderatorNote: null,
  awardedPointDelta: null,
  reviewedAt: null,
}

const approvedSubmission: StaffSubmission = {
  ...pendingSubmission,
  reviewStatus: 'APPROVED',
  reviewerId: '00000000-0000-4000-8000-000000000801',
  reviewerRole: 'MODERATOR',
  moderatorNote: 'Evidence confirmed.',
  awardedPointDelta: 10,
  reviewedAt: '2026-09-17T12:05:00.000Z',
}

const rejectedSubmission: StaffSubmission = {
  ...pendingSubmission,
  reviewStatus: 'REJECTED',
  reviewerId: '00000000-0000-4000-8000-000000000800',
  reviewerRole: 'ADMINISTRATOR',
  moderatorNote: 'Evidence unreadable.',
  awardedPointDelta: null,
  reviewedAt: '2026-09-17T12:05:00.000Z',
}

const administrator: AuthenticationState = {
  status: 'authenticated',
  session: {} as Session,
  role: 'ADMINISTRATOR',
}

function createSynchronization(
  overrides: Partial<StaffSubmissionsRouteProps['synchronization']> = {},
): StaffSubmissionsRouteProps['synchronization'] {
  return {
    campaign,
    signal: {
      campaignId: campaign.campaignId,
      revision: campaign.revision,
      updateId: '00000000-0000-4000-8000-000000000008',
      isActive: true,
      publishedAt: '2026-09-17T12:00:00.000Z',
    },
    connectionStatus: 'LIVE',
    lastSynchronizedAt: '2026-09-17T12:01:00.000Z',
    errorCode: null,
    isResynchronizing: false,
    isConfigured: true,
    manualResynchronize: vi.fn(async () => undefined),
    ...overrides,
  }
}

function createService(
  overrides: Partial<StaffSubmissionService> = {},
): StaffSubmissionService {
  return {
    fetchQueue: vi.fn(async () => [pendingSubmission]),
    fetchPendingCount: vi.fn(async () => 1),
    approve: vi.fn(async (command) => ({
      submissionId: command.submissionId,
      receiptReference: pendingSubmission.receiptReference,
      awardedPointDelta: command.awardedPointDelta,
      newRevision: 9,
      killTeamCrusadePoints: 30,
      campaignCrusadePoints: 34,
      reviewedAt: '2026-09-17T12:05:00.000Z',
    })),
    reject: vi.fn(async (command) => ({
      submissionId: command.submissionId,
      receiptReference: pendingSubmission.receiptReference,
      moderatorNote: command.moderatorNote ?? null,
      reviewedAt: '2026-09-17T12:05:00.000Z',
    })),
    ...overrides,
  }
}

function renderRoute(
  overrides: Partial<StaffSubmissionsRouteProps> = {},
) {
  const props: StaffSubmissionsRouteProps = {
    authentication: administrator,
    synchronization: createSynchronization(),
    service: createService(),
    onReturnToDashboard: vi.fn(),
    ...overrides,
  }

  return { ...render(<StaffSubmissionsRoute {...props} />), props }
}

describe('StaffSubmissionsRoute', () => {
  it('uses a receipt deep link to show only the matching pending submission', async () => {
    const otherSubmission = {
      ...pendingSubmission,
      id: '00000000-0000-4000-8000-000000000902',
      receiptReference: 'CR-00483',
    }
    renderRoute({
      receiptReference: 'CR-00482',
      service: createService({
        fetchQueue: vi.fn(async () => [
          { ...pendingSubmission, receiptReference: 'CR-00482' },
          otherSubmission,
        ]),
      }),
    })

    expect(await screen.findByText('CR-00482')).toBeInTheDocument()
    expect(screen.queryByText('CR-00483')).not.toBeInTheDocument()
  })

  it('redirects anonymous direct access to staff login without loading private data', async () => {
    const service = createService()
    const onRequireAuthentication = vi.fn()
    renderRoute({
      authentication: { status: 'public', session: null, role: null },
      onRequireAuthentication,
      service,
    })

    expect(
      screen.getByRole('heading', { name: 'Staff Authentication Required' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(onRequireAuthentication).toHaveBeenCalledTimes(1),
    )
    expect(service.fetchQueue).not.toHaveBeenCalled()
    expect(screen.queryByText('CRS-000901')).not.toBeInTheDocument()
  })

  it('denies an authenticated Player and allows the unauthorized session to sign out', async () => {
    const service = createService()
    const signOut = vi.fn(async () => undefined)
    renderRoute({
      authentication: {
        status: 'authenticated',
        session: {} as Session,
        role: 'PLAYER',
      },
      service,
      signOut,
    })

    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument()
    expect(service.fetchQueue).not.toHaveBeenCalled()
    expect(screen.queryByText('CRS-000901')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'SIGN OUT' }))
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
  })

  it('allows a Moderator to load the protected route', async () => {
    renderRoute({
      authentication: {
        status: 'authenticated',
        session: {} as Session,
        role: 'MODERATOR',
      },
    })

    expect(
      await screen.findByRole('heading', { name: 'Crusade Submissions' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('CRS-000901')).toBeInTheDocument()
  })

  it('defaults to PENDING and renders required submission metadata and evidence', async () => {
    const service = createService()
    renderRoute({ service })

    expect(screen.getByRole('button', { name: 'PENDING' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const card = await screen.findByRole('article', {
      name: 'Submission CRS-000901',
    })
    expect(within(card).getByText('Kill Team Alpha')).toBeInTheDocument()
    expect(within(card).getByText('Brother Titus')).toBeInTheDocument()
    expect(within(card).getByText('Terminus Kill')).toBeInTheDocument()
    expect(within(card).getByText('Carnifex Prime')).toBeInTheDocument()
    expect(
      within(card).getByText('Target eliminated at the relay.'),
    ).toBeInTheDocument()
    expect(
      within(card).getByAltText('Screenshot evidence for submission CRS-000901'),
    ).toHaveAttribute('src', pendingSubmission.evidencePreviewUrl)
    expect(service.fetchQueue).toHaveBeenCalledWith({
      status: 'PENDING',
      campaignId: campaign.campaignId,
      missionId: campaign.missionId,
    })
  })

  it('switches between APPROVED and REJECTED authoritative filters', async () => {
    const service = createService({
      fetchQueue: vi.fn(async ({ status }: SubmissionQueueFilters) => {
        if (status === 'APPROVED') return [approvedSubmission]
        if (status === 'REJECTED') return [rejectedSubmission]
        return [pendingSubmission]
      }),
    })
    renderRoute({ service })
    await screen.findByText('CRS-000901')

    fireEvent.click(screen.getByRole('button', { name: 'APPROVED' }))
    expect(await screen.findByText('Awarded points')).toBeInTheDocument()
    expect(screen.getByText('Evidence confirmed.')).toBeInTheDocument()
    expect(screen.getByText('Moderator')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'REJECTED' }))
    expect(await screen.findByText('Evidence unreadable.')).toBeInTheDocument()
    expect(screen.getByText('Administrator')).toBeInTheDocument()
  })

  it('renders a graceful fallback when evidence is unavailable', async () => {
    renderRoute({
      service: createService({
        fetchQueue: vi.fn(async () => [
          {
            ...pendingSubmission,
            evidencePreviewUrl: null,
            evidenceSourceReference: 'discord-attachment:expired',
          },
        ]),
      }),
    })

    expect(
      await screen.findByText('Screenshot preview unavailable or expired.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('requires a nonzero integer before invoking approval', async () => {
    const service = createService()
    renderRoute({ service })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Approve CRS-000901' }),
    )
    fireEvent.change(
      screen.getByLabelText('Awarded Crusade Point delta'),
      { target: { value: '0' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))

    expect(
      await screen.findByText(
        'Awarded Crusade Point delta must be a nonzero integer.',
      ),
    ).toBeInTheDocument()
    expect(service.approve).not.toHaveBeenCalled()
  })

  it('approves with the authoritative revision, refreshes state, and removes the pending item', async () => {
    let processed = false
    const fetchQueue = vi.fn(async () =>
      processed ? [] : [pendingSubmission],
    )
    const fetchPendingCount = vi.fn(async () => (processed ? 0 : 1))
    const approve = vi.fn(async () => {
      processed = true
      return {
        submissionId: pendingSubmission.id,
        receiptReference: pendingSubmission.receiptReference,
        awardedPointDelta: 10,
        newRevision: 9,
        killTeamCrusadePoints: 30,
        campaignCrusadePoints: 34,
        reviewedAt: '2026-09-17T12:05:00.000Z',
      }
    })
    const service = createService({ fetchQueue, fetchPendingCount, approve })
    const synchronization = createSynchronization()
    renderRoute({ service, synchronization })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Approve CRS-000901' }),
    )
    fireEvent.change(
      screen.getByLabelText('Awarded Crusade Point delta'),
      { target: { value: '10' } },
    )
    fireEvent.change(screen.getByLabelText('Moderator note (optional)'), {
      target: { value: 'Confirmed.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))

    expect(approve).toHaveBeenCalledWith({
      submissionId: pendingSubmission.id,
      awardedPointDelta: 10,
      expectedRevision: 8,
      moderatorNote: 'Confirmed.',
    })
    expect(
      await screen.findByText('CRS-000901 approved for +10 Crusade Points.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Pending: 0')).toBeInTheDocument()
    expect(
      screen.queryByRole('article', { name: 'Submission CRS-000901' }),
    ).not.toBeInTheDocument()
    expect(synchronization.manualResynchronize).toHaveBeenCalledTimes(1)
    expect(fetchPendingCount).toHaveBeenCalledTimes(2)
  })

  it('refreshes safely when another moderator already reviewed the submission', async () => {
    const fetchQueue = vi
      .fn()
      .mockResolvedValueOnce([pendingSubmission])
      .mockResolvedValueOnce([])
    const service = createService({
      fetchQueue,
      fetchPendingCount: vi.fn(async () => 0),
      approve: vi.fn(async () => {
        throw new StaffSubmissionError(
          'ALREADY_REVIEWED',
          'This submission has already been reviewed.',
        )
      }),
    })
    renderRoute({ service })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Approve CRS-000901' }),
    )
    fireEvent.change(
      screen.getByLabelText('Awarded Crusade Point delta'),
      { target: { value: '10' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))

    expect(
      await screen.findByText(/already been reviewed by another staff member/i),
    ).toBeInTheDocument()
    expect(fetchQueue).toHaveBeenCalledTimes(2)
  })

  it('resynchronizes authoritative campaign state after a stale revision conflict', async () => {
    const synchronization = createSynchronization()
    const service = createService({
      approve: vi.fn(async () => {
        throw new StaffSubmissionError(
          'STALE_REVISION',
          'Campaign state changed.',
        )
      }),
    })
    renderRoute({ service, synchronization })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Approve CRS-000901' }),
    )
    fireEvent.change(
      screen.getByLabelText('Awarded Crusade Point delta'),
      { target: { value: '10' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))

    expect(
      await screen.findByText(/Authoritative state was refreshed/i),
    ).toBeInTheDocument()
    expect(synchronization.manualResynchronize).toHaveBeenCalledTimes(1)
  })

  it('rejects through the rejection service without approval or campaign resync', async () => {
    let processed = false
    const service = createService({
      fetchQueue: vi.fn(async () =>
        processed ? [] : [pendingSubmission],
      ),
      fetchPendingCount: vi.fn(async () => (processed ? 0 : 1)),
      reject: vi.fn(async (command) => {
        processed = true
        return {
          submissionId: command.submissionId,
          receiptReference: pendingSubmission.receiptReference,
          moderatorNote: command.moderatorNote ?? null,
          reviewedAt: '2026-09-17T12:05:00.000Z',
        }
      }),
    })
    const synchronization = createSynchronization()
    renderRoute({ service, synchronization })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Reject CRS-000901' }),
    )
    fireEvent.change(
      screen.getByLabelText('Rejection reason / moderator note (optional)'),
      { target: { value: 'Evidence unreadable.' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }))

    expect(service.reject).toHaveBeenCalledWith({
      submissionId: pendingSubmission.id,
      moderatorNote: 'Evidence unreadable.',
    })
    expect(service.approve).not.toHaveBeenCalled()
    expect(
      await screen.findByText('CRS-000901 rejected.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Pending: 0')).toBeInTheDocument()
    expect(synchronization.manualResynchronize).not.toHaveBeenCalled()
  })

  it('keeps authoritative write controls disabled while offline', async () => {
    renderRoute({
      synchronization: createSynchronization({
        connectionStatus: 'OFFLINE',
      }),
    })

    expect(
      await screen.findByRole('button', { name: 'Approve CRS-000901' }),
    ).toBeDisabled()
    expect(
      screen.getByText('Reviews require an authenticated LIVE campaign link.'),
    ).toBeInTheDocument()
  })
})
