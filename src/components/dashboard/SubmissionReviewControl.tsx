import { useEffect, useState } from 'react'

import {
  isCommandStaffRole,
  type ApplicationRole,
} from '../../data/services/auth'
import {
  fetchPendingSubmissionCount,
  type SubmissionScope,
} from '../../data/services/staffSubmissions'
import { Button, Panel } from '../ui'

export type SubmissionReviewControlProps = SubmissionScope & {
  role: ApplicationRole | null
  onNavigate: () => void
  loadPendingCount?: typeof fetchPendingSubmissionCount
}

export function SubmissionReviewControl({
  campaignId,
  missionId,
  role,
  onNavigate,
  loadPendingCount = fetchPendingSubmissionCount,
}: SubmissionReviewControlProps) {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let active = true

    if (!isCommandStaffRole(role)) {
      return () => {
        active = false
      }
    }

    void loadPendingCount({ campaignId, missionId })
      .then((count) => {
        if (active) {
          setPendingCount(count)
        }
      })
      .catch(() => {
        if (active) {
          setPendingCount(0)
        }
      })

    return () => {
      active = false
    }
  }, [campaignId, loadPendingCount, missionId, role])

  if (!isCommandStaffRole(role)) {
    return null
  }

  const label =
    pendingCount > 0
      ? `VIEW SUBMISSIONS (${pendingCount})`
      : 'VIEW SUBMISSIONS'

  return (
    <Panel
      className="dashboard-panel submission-review-control"
      eyebrow="Command review"
      title="Submission Intake"
    >
      <p>Review pending Crusade evidence and record an authoritative decision.</p>
      <Button aria-label={label} onClick={onNavigate}>
        {label}
      </Button>
    </Panel>
  )
}
