import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import { Button } from '../components/ui'
import {
  isCommandStaffRole,
  signOutCommandStaff,
  type AuthenticationState,
  type CommandStaffRole,
} from '../data/services/auth'
import {
  StaffSubmissionError,
  staffSubmissionService,
  type StaffSubmission,
  type StaffSubmissionService,
  type SubmissionStatus,
} from '../data/services/staffSubmissions'
import {
  navigateTo,
  PUBLIC_DASHBOARD_PATH,
  STAFF_SUBMISSIONS_PATH,
  staffLoginPath,
} from '../navigation'
import { useAuthentication } from '../state/auth/useAuthentication'
import { canPerformAuthoritativeWrite } from '../state/campaignSync/synchronization'
import {
  useCampaignSynchronization,
  type CampaignSynchronizationState,
} from '../state/campaignSync/useCampaignSynchronization'

const FILTERS: SubmissionStatus[] = ['PENDING', 'APPROVED', 'REJECTED']

type StaffSynchronization = CampaignSynchronizationState & {
  isConfigured: boolean
  manualResynchronize: () => Promise<void>
}

type ReviewDraft = {
  submissionId: string
  action: 'APPROVE' | 'REJECT'
  awardedPointDelta: string
  moderatorNote: string
}

export type StaffSubmissionsRouteProps = {
  authentication: AuthenticationState
  synchronization: StaffSynchronization
  service?: StaffSubmissionService
  onReturnToDashboard?: () => void
  onRequireAuthentication?: () => void
  signOut?: typeof signOutCommandStaff
}

type StaffSubmissionReviewProps = {
  campaignId: string
  missionId: string
  revision: number
  role: CommandStaffRole
  synchronization: StaffSynchronization
  service: StaffSubmissionService
  onReturnToDashboard: () => void
}

function redirectToSubmissionLogin() {
  navigateTo(staffLoginPath(STAFF_SUBMISSIONS_PATH))
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value)

  return Number.isNaN(timestamp.getTime())
    ? 'Timestamp unavailable'
    : timestamp.toLocaleString()
}

function EvidencePreview({ submission }: { submission: StaffSubmission }) {
  const [failed, setFailed] = useState(false)
  const previewUrl = failed ? null : submission.evidencePreviewUrl

  if (!previewUrl) {
    return (
      <div className="submission-evidence submission-evidence--unavailable">
        <p>Screenshot preview unavailable or expired.</p>
        <span>{submission.evidenceOriginalFilename}</span>
      </div>
    )
  }

  return (
    <a
      aria-label={`Inspect screenshot evidence for ${submission.receiptReference}`}
      className="submission-evidence submission-evidence--available"
      href={previewUrl}
      rel="noreferrer noopener"
      target="_blank"
    >
      <img
        alt={`Screenshot evidence for submission ${submission.receiptReference}`}
        onError={() => setFailed(true)}
        src={previewUrl}
      />
      <span>Open full evidence · {submission.evidenceOriginalFilename}</span>
    </a>
  )
}

type SubmissionCardProps = {
  submission: StaffSubmission
  canReview: boolean
  draft: ReviewDraft | null
  isProcessing: boolean
  onOpenReview: (submissionId: string, action: ReviewDraft['action']) => void
  onCloseReview: () => void
  onDraftChange: (draft: ReviewDraft) => void
  onSubmitReview: (event: FormEvent<HTMLFormElement>) => void
}

function SubmissionCard({
  submission,
  canReview,
  draft,
  isProcessing,
  onOpenReview,
  onCloseReview,
  onDraftChange,
  onSubmitReview,
}: SubmissionCardProps) {
  const isPending = submission.reviewStatus === 'PENDING'
  const activeDraft = draft?.submissionId === submission.id ? draft : null

  return (
    <article
      aria-label={`Submission ${submission.receiptReference}`}
      className="submission-card"
    >
      <header className="submission-card__header">
        <div>
          <p className="submission-card__receipt">{submission.receiptReference}</p>
          <h2>{submission.killTeamName}</h2>
        </div>
        <span
          className="submission-card__status"
          data-status={submission.reviewStatus.toLowerCase()}
        >
          {submission.reviewStatus}
        </span>
      </header>

      <div className="submission-card__layout">
        <EvidencePreview submission={submission} />

        <div className="submission-card__details">
          <dl>
            <div>
              <dt>Submitted</dt>
              <dd>{formatTimestamp(submission.submittedAt)}</dd>
            </div>
            <div>
              <dt>Battle-brother</dt>
              <dd>{submission.submittingMemberDisplayName}</dd>
            </div>
            <div>
              <dt>Submission type</dt>
              <dd>{formatEnum(submission.eventType)}</dd>
            </div>
            {submission.scoringTargetName ? (
              <div>
                <dt>Scoring target</dt>
                <dd>{submission.scoringTargetName}</dd>
              </div>
            ) : null}
          </dl>

          {submission.playerNote ? (
            <div className="submission-card__note">
              <h3>Player note</h3>
              <p>{submission.playerNote}</p>
            </div>
          ) : null}

          {!isPending ? (
            <div className="submission-card__review-record">
              <h3>Review record</h3>
              <dl>
                {submission.awardedPointDelta !== null ? (
                  <div>
                    <dt>Awarded points</dt>
                    <dd>{submission.awardedPointDelta}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Reviewer</dt>
                  <dd>
                    {submission.reviewerRole
                      ? formatEnum(submission.reviewerRole)
                      : 'Command staff'}
                  </dd>
                </div>
                <div>
                  <dt>Reviewed</dt>
                  <dd>
                    {submission.reviewedAt
                      ? formatTimestamp(submission.reviewedAt)
                      : 'Timestamp unavailable'}
                  </dd>
                </div>
              </dl>
              {submission.moderatorNote ? (
                <p>
                  <strong>Moderator note:</strong> {submission.moderatorNote}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {isPending ? (
        <div className="submission-card__actions">
          <Button
            aria-label={`Approve ${submission.receiptReference}`}
            disabled={!canReview || isProcessing}
            onClick={() => onOpenReview(submission.id, 'APPROVE')}
          >
            Approve
          </Button>
          <Button
            aria-label={`Reject ${submission.receiptReference}`}
            disabled={!canReview || isProcessing}
            onClick={() => onOpenReview(submission.id, 'REJECT')}
            variant="danger"
          >
            Reject
          </Button>
          {!canReview ? (
            <p className="submission-card__offline-note">
              Reviews require an authenticated LIVE campaign link.
            </p>
          ) : null}
        </div>
      ) : null}

      {activeDraft ? (
        <form className="submission-review-form" onSubmit={onSubmitReview}>
          <h3>
            {activeDraft.action === 'APPROVE'
              ? 'Confirm approval'
              : 'Confirm rejection'}
          </h3>
          {activeDraft.action === 'APPROVE' ? (
            <label>
              Awarded Crusade Point delta
              <input
                inputMode="numeric"
                name="awardedPointDelta"
                onChange={(event) =>
                  onDraftChange({
                    ...activeDraft,
                    awardedPointDelta: event.target.value,
                  })
                }
                required
                step="1"
                type="number"
                value={activeDraft.awardedPointDelta}
              />
            </label>
          ) : null}
          <label>
            {activeDraft.action === 'APPROVE'
              ? 'Moderator note (optional)'
              : 'Rejection reason / moderator note (optional)'}
            <textarea
              maxLength={1000}
              name="moderatorNote"
              onChange={(event) =>
                onDraftChange({
                  ...activeDraft,
                  moderatorNote: event.target.value,
                })
              }
              rows={3}
              value={activeDraft.moderatorNote}
            />
          </label>
          <div className="submission-review-form__actions">
            <Button
              isLoading={isProcessing}
              loadingLabel="Recording decision"
              type="submit"
              variant={activeDraft.action === 'REJECT' ? 'danger' : 'primary'}
            >
              {activeDraft.action === 'APPROVE'
                ? 'Confirm approval'
                : 'Confirm rejection'}
            </Button>
            <Button
              disabled={isProcessing}
              onClick={onCloseReview}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </article>
  )
}

function StaffSubmissionReview({
  campaignId,
  missionId,
  revision,
  role,
  synchronization,
  service,
  onReturnToDashboard,
}: StaffSubmissionReviewProps) {
  const [activeFilter, setActiveFilter] =
    useState<SubmissionStatus>('PENDING')
  const [submissions, setSubmissions] = useState<StaffSubmission[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    const queue = await service.fetchQueue({
      status: activeFilter,
      campaignId,
      missionId,
    })
    setSubmissions(queue)
  }, [activeFilter, campaignId, missionId, service])

  const loadPendingCount = useCallback(async () => {
    const count = await service.fetchPendingCount({ campaignId, missionId })
    setPendingCount(count)
  }, [campaignId, missionId, service])

  const refreshReviewData = useCallback(async () => {
    await Promise.all([loadQueue(), loadPendingCount()])
  }, [loadPendingCount, loadQueue])

  useEffect(() => {
    let active = true

    void Promise.all([
      service.fetchQueue({
        status: activeFilter,
        campaignId,
        missionId,
      }),
      service.fetchPendingCount({ campaignId, missionId }),
    ])
      .then(([queue, count]) => {
        if (active) {
          setSubmissions(queue)
          setPendingCount(count)
        }
      })
      .catch(() => {
        if (active) {
          setError('The authoritative submission queue could not be loaded.')
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [activeFilter, campaignId, missionId, service])

  const openReview = (
    submissionId: string,
    action: ReviewDraft['action'],
  ) => {
    setMessage(null)
    setError(null)
    setDraft({
      submissionId,
      action,
      awardedPointDelta: '',
      moderatorNote: '',
    })
  }

  const handleReviewError = async (reviewError: unknown) => {
    if (
      reviewError instanceof StaffSubmissionError &&
      reviewError.code === 'ALREADY_REVIEWED'
    ) {
      await refreshReviewData()
      setMessage(
        'This submission has already been reviewed by another staff member. The queue has been refreshed.',
      )
      return
    }

    if (
      reviewError instanceof StaffSubmissionError &&
      reviewError.code === 'STALE_REVISION'
    ) {
      await synchronization.manualResynchronize()
      await refreshReviewData()
      setMessage(
        'Campaign state changed before approval. Authoritative state was refreshed; review the submission and retry.',
      )
      return
    }

    setError(
      reviewError instanceof StaffSubmissionError
        ? reviewError.message
        : 'The review decision could not be recorded.',
    )
  }

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft || isProcessing) {
      return
    }

    if (!canPerformAuthoritativeWrite(role, synchronization.connectionStatus)) {
      setError('Reviews require an authenticated LIVE campaign link.')
      return
    }

    const selectedSubmission = submissions.find(
      (submission) => submission.id === draft.submissionId,
    )

    if (!selectedSubmission) {
      setError('The selected submission is no longer in this queue.')
      return
    }

    const moderatorNote = draft.moderatorNote.trim() || undefined
    setIsProcessing(true)
    setMessage(null)
    setError(null)

    try {
      if (draft.action === 'APPROVE') {
        const awardedPointDelta = Number(draft.awardedPointDelta)

        if (!Number.isSafeInteger(awardedPointDelta) || awardedPointDelta === 0) {
          setError('Awarded Crusade Point delta must be a nonzero integer.')
          return
        }

        const result = await service.approve({
          submissionId: draft.submissionId,
          awardedPointDelta,
          expectedRevision: revision,
          moderatorNote,
        })
        setDraft(null)
        setMessage(
          `${result.receiptReference} approved for ${result.awardedPointDelta > 0 ? '+' : ''}${result.awardedPointDelta} Crusade Points.`,
        )
        await synchronization.manualResynchronize()
        await refreshReviewData()
      } else {
        const result = await service.reject({
          submissionId: draft.submissionId,
          moderatorNote,
        })
        setDraft(null)
        setMessage(`${result.receiptReference} rejected.`)
        await refreshReviewData()
      }
    } catch (reviewError) {
      await handleReviewError(reviewError)
    } finally {
      setIsProcessing(false)
    }
  }

  const canReview = canPerformAuthoritativeWrite(
    role,
    synchronization.connectionStatus,
  )

  return (
    <main className="staff-submissions">
      <div className="staff-submissions__shell">
        <header className="staff-submissions__header">
          <div>
            <p>Command review / Evidence intake</p>
            <h1>Crusade Submissions</h1>
          </div>
          <div className="staff-submissions__header-actions">
            <span className="staff-submissions__pending-count">
              Pending: {pendingCount}
            </span>
            <Button onClick={onReturnToDashboard} variant="secondary">
              Return to Dashboard
            </Button>
          </div>
        </header>

        <nav aria-label="Submission status filters" className="submission-filters">
          {FILTERS.map((filter) => (
            <Button
              aria-pressed={activeFilter === filter}
              key={filter}
              onClick={() => {
                if (activeFilter === filter) {
                  return
                }

                setIsLoading(true)
                setError(null)
                setActiveFilter(filter)
                setDraft(null)
                setMessage(null)
              }}
              variant={activeFilter === filter ? 'primary' : 'secondary'}
            >
              {filter}
            </Button>
          ))}
        </nav>

        {message ? (
          <p className="staff-submissions__message" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="staff-submissions__error" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p aria-live="polite" className="staff-submissions__empty">
            Loading authoritative submission queue...
          </p>
        ) : submissions.length === 0 ? (
          <p className="staff-submissions__empty">
            No {activeFilter.toLowerCase()} submissions.
          </p>
        ) : (
          <div className="submission-list">
            {submissions.map((submission) => (
              <SubmissionCard
                canReview={canReview}
                draft={draft}
                isProcessing={isProcessing}
                key={submission.id}
                onCloseReview={() => setDraft(null)}
                onDraftChange={setDraft}
                onOpenReview={openReview}
                onSubmitReview={(event) => void submitReview(event)}
                submission={submission}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function RouteState({
  title,
  message,
  onReturnToDashboard,
  secondaryAction,
}: {
  title: string
  message: string
  onReturnToDashboard: () => void
  secondaryAction?: ReactNode
}) {
  return (
    <main className="staff-submissions">
      <section className="staff-submissions__route-state">
        <p>Crusade Command</p>
        <h1>{title}</h1>
        <span>{message}</span>
        <div className="staff-submissions__route-actions">
          <Button onClick={onReturnToDashboard}>Return to Dashboard</Button>
          {secondaryAction}
        </div>
      </section>
    </main>
  )
}

export function StaffSubmissionsRoute({
  authentication,
  synchronization,
  service = staffSubmissionService,
  onReturnToDashboard = () => navigateTo(PUBLIC_DASHBOARD_PATH),
  onRequireAuthentication = redirectToSubmissionLogin,
  signOut = signOutCommandStaff,
}: StaffSubmissionsRouteProps) {
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const requiresAuthentication =
    authentication.status === 'public' ||
    authentication.status === 'unconfigured'

  useEffect(() => {
    if (requiresAuthentication) {
      onRequireAuthentication()
    }
  }, [onRequireAuthentication, requiresAuthentication])

  const handleDeniedSignOut = async () => {
    setSignOutError(null)
    setIsSigningOut(true)

    try {
      await signOut()
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'Sign-out failed.',
      )
    } finally {
      setIsSigningOut(false)
    }
  }

  if (authentication.status === 'loading') {
    return (
      <RouteState
        message="Verifying command-staff authorization."
        onReturnToDashboard={onReturnToDashboard}
        title="Authorization Check"
      />
    )
  }

  if (requiresAuthentication) {
    return (
      <RouteState
        message="Staff authentication is required. Redirecting to the secure email verification flow."
        onReturnToDashboard={onReturnToDashboard}
        title="Staff Authentication Required"
      />
    )
  }

  if (!isCommandStaffRole(authentication.role)) {
    return (
      <RouteState
        message={
          signOutError ??
          'This authenticated account is not assigned an Administrator or Moderator role.'
        }
        onReturnToDashboard={onReturnToDashboard}
        secondaryAction={
          <Button
            isLoading={isSigningOut}
            loadingLabel="SIGNING OUT"
            onClick={() => void handleDeniedSignOut()}
            variant="secondary"
          >
            SIGN OUT
          </Button>
        }
        title="Access Denied"
      />
    )
  }

  if (!synchronization.campaign) {
    if (
      synchronization.isConfigured &&
      synchronization.lastSynchronizedAt === null &&
      synchronization.errorCode === null
    ) {
      return (
        <RouteState
          message="Retrieving the authoritative ACTIVE campaign before opening the review queue."
          onReturnToDashboard={onReturnToDashboard}
          title="Synchronizing Campaign"
        />
      )
    }

    return (
      <RouteState
        message="An authoritative ACTIVE campaign is required before submissions can be reviewed."
        onReturnToDashboard={onReturnToDashboard}
        title="No Active Operation"
      />
    )
  }

  return (
    <StaffSubmissionReview
      campaignId={synchronization.campaign.campaignId}
      missionId={synchronization.campaign.missionId}
      onReturnToDashboard={onReturnToDashboard}
      revision={synchronization.campaign.revision}
      role={authentication.role}
      service={service}
      synchronization={synchronization}
    />
  )
}

export function StaffSubmissionsPage() {
  const { state: authentication } = useAuthentication()
  const synchronization = useCampaignSynchronization()

  return (
    <StaffSubmissionsRoute
      authentication={authentication}
      synchronization={synchronization}
    />
  )
}
