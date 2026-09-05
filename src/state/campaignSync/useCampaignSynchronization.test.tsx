import { act, renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import {
  SynchronizationError,
  type PublicCampaignSnapshot,
  type PublicCampaignState,
  type PublicSyncSignal,
  type PublicSyncSubscription,
  type RealtimeTransportStatus,
} from '../../data/services/publicCampaign'
import {
  useCampaignSynchronization,
  type CampaignSynchronizationDependencies,
} from './useCampaignSynchronization'

function createSignal(revision: number): PublicSyncSignal {
  return {
    campaignId: '00000000-0000-4000-8000-000000000001',
    revision,
    updateId: `90000000-0000-4000-8000-${revision.toString().padStart(12, '0')}`,
    isActive: true,
    publishedAt: `2026-09-04T12:00:${revision.toString().padStart(2, '0')}.000Z`,
  }
}

function createSnapshot(revision: number): PublicCampaignSnapshot {
  const campaign: PublicCampaignState = {
    campaignId: '00000000-0000-4000-8000-000000000001',
    campaignName: 'Sandbox Crusade',
    campaignDescription: 'Sandbox campaign',
    missionId: '00000000-0000-4000-8000-000000000201',
    missionName: 'Sandbox Mission',
    missionDescription: 'Sandbox mission',
    missionStatus: 'ACTIVE',
    battlefieldId: '00000000-0000-4000-8000-000000000101',
    battlefieldName: 'Termination',
    battlefieldDescription: 'Sandbox battlefield',
    enemyFaction: 'Sandbox Hostiles',
    campaignProgress: revision,
    revision,
    authoritativeUpdatedAt: '2026-09-04T12:00:00.000Z',
    objectives: [],
    enemies: [],
  }

  return { campaign, signal: createSignal(revision) }
}

function createHarness(isConfigured = true) {
  let onSignal: ((signal: PublicSyncSignal) => void) | null = null
  let onStatus: ((status: RealtimeTransportStatus) => void) | null = null
  let onError: ((error: SynchronizationError) => void) | null = null
  const unsubscribe = vi.fn(async () => undefined)
  const fetchSnapshot = vi.fn(
    async (): Promise<PublicCampaignSnapshot> => createSnapshot(3),
  )
  const fetchLatestSignal = vi.fn(
    async (): Promise<PublicSyncSignal | null> => createSignal(3),
  )
  const subscribe = vi.fn(
    (
      signalCallback: (signal: PublicSyncSignal) => void,
      statusCallback: (status: RealtimeTransportStatus) => void,
      errorCallback: (error: SynchronizationError) => void,
    ): PublicSyncSubscription => {
      onSignal = signalCallback
      onStatus = statusCallback
      onError = errorCallback
      return { unsubscribe }
    },
  )
  const dependencies: CampaignSynchronizationDependencies = {
    isConfigured,
    fetchSnapshot,
    fetchLatestSignal,
    subscribe,
    now: vi.fn(() => Date.parse('2026-09-04T12:30:00.000Z')),
    verificationIntervalMs: 45_000,
    resumeThrottleMs: 2_000,
  }

  return {
    dependencies,
    fetchSnapshot,
    fetchLatestSignal,
    subscribe,
    unsubscribe,
    emitSignal(signal: PublicSyncSignal) {
      if (!onSignal) {
        throw new Error('Realtime signal callback is not registered.')
      }
      onSignal(signal)
    },
    emitStatus(status: RealtimeTransportStatus) {
      if (!onStatus) {
        throw new Error('Realtime status callback is not registered.')
      }
      onStatus(status)
    },
    emitError(error: SynchronizationError) {
      if (!onError) {
        throw new Error('Realtime error callback is not registered.')
      }
      onError(error)
    },
  }
}

describe('useCampaignSynchronization', () => {
  it('performs the initial authoritative fetch before subscribing', async () => {
    const harness = createHarness()
    const order: string[] = []
    harness.fetchSnapshot.mockImplementationOnce(async () => {
      order.push('fetch')
      return createSnapshot(3)
    })
    harness.subscribe.mockImplementationOnce((onSignal, onStatus, onError) => {
      order.push('subscribe')
      const fallback = createHarness().dependencies.subscribe(
        onSignal,
        onStatus,
        onError,
      )
      return fallback
    })

    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )

    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))
    expect(order).toEqual(['fetch', 'subscribe'])
    expect(result.current.campaign?.revision).toBe(3)
  })

  it('shows a controlled offline state after initial fetch failure', async () => {
    const harness = createHarness()
    harness.fetchSnapshot.mockRejectedValueOnce(
      new SynchronizationError(
        'PUBLIC_STATE_FETCH_FAILED',
        'Expected test failure',
      ),
    )

    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )

    await waitFor(() =>
      expect(result.current.errorCode).toBe('PUBLIC_STATE_FETCH_FAILED'),
    )
    expect(result.current.connectionStatus).toBe('OFFLINE')
    expect(harness.subscribe).toHaveBeenCalledTimes(1)
  })

  it('fully refetches when a newer realtime revision arrives', async () => {
    const harness = createHarness()
    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))
    harness.fetchSnapshot.mockResolvedValueOnce(createSnapshot(4))

    act(() => harness.emitSignal(createSignal(4)))

    await waitFor(() => expect(result.current.campaign?.revision).toBe(4))
    expect(harness.fetchSnapshot).toHaveBeenCalledTimes(2)
  })

  it('ignores duplicate and older realtime events', async () => {
    const harness = createHarness()
    renderHook(() => useCampaignSynchronization(harness.dependencies))
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))

    act(() => {
      harness.emitSignal(createSignal(3))
      harness.emitSignal(createSignal(2))
    })

    expect(harness.fetchSnapshot).toHaveBeenCalledTimes(1)
  })

  it('fully refetches rather than replaying a missed revision range', async () => {
    const harness = createHarness()
    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))
    harness.fetchSnapshot.mockResolvedValueOnce(createSnapshot(6))

    act(() => harness.emitSignal(createSignal(6)))

    await waitFor(() => expect(result.current.campaign?.revision).toBe(6))
  })

  it('uses the lightweight verification check and resyncs stale state', async () => {
    const harness = createHarness()
    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))
    harness.fetchLatestSignal.mockResolvedValueOnce(createSignal(4))
    harness.fetchSnapshot.mockResolvedValueOnce(createSnapshot(4))

    await act(async () => result.current.verifyRevision())

    await waitFor(() => expect(result.current.campaign?.revision).toBe(4))
  })

  it('supports manual resynchronization without reloading the browser', async () => {
    const harness = createHarness()
    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))
    harness.fetchSnapshot.mockResolvedValueOnce(createSnapshot(4))

    await act(async () => result.current.manualResynchronize())

    expect(result.current.campaign?.revision).toBe(4)
    expect(harness.subscribe).toHaveBeenCalledTimes(1)
  })

  it('retains the last known state while realtime is offline', async () => {
    const harness = createHarness()
    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))

    act(() => harness.emitStatus('DISCONNECTED'))

    expect(result.current.connectionStatus).toBe('OFFLINE')
    expect(result.current.errorCode).toBe('REALTIME_DISCONNECTED')
    expect(result.current.campaign?.revision).toBe(3)
  })

  it('performs a full fetch before declaring a reconnect live', async () => {
    const harness = createHarness()
    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))
    act(() => harness.emitStatus('DISCONNECTED'))
    harness.fetchSnapshot.mockResolvedValueOnce(createSnapshot(4))

    act(() => harness.emitStatus('SUBSCRIBED'))

    await waitFor(() => expect(result.current.connectionStatus).toBe('LIVE'))
    expect(result.current.campaign?.revision).toBe(4)
  })

  it('throttles rapid reconnect status without duplicate fetches', async () => {
    const harness = createHarness()
    renderHook(() => useCampaignSynchronization(harness.dependencies))
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))
    let resolveFetch: ((snapshot: PublicCampaignSnapshot) => void) | null = null
    harness.fetchSnapshot.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )

    act(() => {
      harness.emitStatus('SUBSCRIBED')
      harness.emitStatus('SUBSCRIBED')
    })

    expect(harness.fetchSnapshot).toHaveBeenCalledTimes(2)
    await act(async () => {
      resolveFetch?.(createSnapshot(4))
    })

    act(() => harness.emitStatus('SUBSCRIBED'))
    expect(harness.fetchSnapshot).toHaveBeenCalledTimes(2)
  })

  it('stays visibly offline after a manual fetch while realtime is disconnected', async () => {
    const harness = createHarness()
    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))
    act(() => harness.emitStatus('DISCONNECTED'))
    harness.fetchSnapshot.mockResolvedValueOnce(createSnapshot(4))

    await act(async () => result.current.manualResynchronize())

    expect(result.current.campaign?.revision).toBe(4)
    expect(result.current.connectionStatus).toBe('OFFLINE')
    expect(result.current.errorCode).toBe('REALTIME_DISCONNECTED')
  })

  it('retains state through browser offline and fully resyncs before returning live', async () => {
    const harness = createHarness()
    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))

    act(() => harness.emitStatus('SUBSCRIBED'))
    await waitFor(() => expect(result.current.connectionStatus).toBe('LIVE'))

    act(() => window.dispatchEvent(new Event('offline')))
    expect(result.current.connectionStatus).toBe('OFFLINE')
    expect(result.current.campaign?.revision).toBe(3)

    harness.fetchSnapshot.mockResolvedValue(createSnapshot(4))
    act(() => window.dispatchEvent(new Event('online')))
    await waitFor(() =>
      expect(result.current.connectionStatus).toBe('RECONNECTING'),
    )
    expect(result.current.campaign?.revision).toBe(4)

    act(() => harness.emitStatus('SUBSCRIBED'))
    await waitFor(() => expect(result.current.connectionStatus).toBe('LIVE'))
    expect(harness.subscribe).toHaveBeenCalledTimes(1)
  })

  it('verifies state when a suspended tab becomes visible', async () => {
    const harness = createHarness()
    renderHook(() => useCampaignSynchronization(harness.dependencies))
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))

    act(() => document.dispatchEvent(new Event('visibilitychange')))

    await waitFor(() =>
      expect(harness.fetchLatestSignal).toHaveBeenCalledTimes(1),
    )
  })

  it('uses a 45-second verification interval', async () => {
    const intervalSpy = vi.spyOn(window, 'setInterval')
    const harness = createHarness()
    const { unmount } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))

    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 45_000)
    unmount()
    intervalSpy.mockRestore()
  })

  it('does not duplicate subscriptions and removes the channel on unmount', async () => {
    const harness = createHarness()
    const { rerender, unmount } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )
    await waitFor(() => expect(harness.subscribe).toHaveBeenCalledTimes(1))

    rerender()
    expect(harness.subscribe).toHaveBeenCalledTimes(1)
    unmount()
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does not fetch or subscribe when browser configuration is absent', () => {
    const harness = createHarness(false)
    const { result } = renderHook(() =>
      useCampaignSynchronization(harness.dependencies),
    )

    expect(result.current.connectionStatus).toBe('OFFLINE')
    expect(harness.fetchSnapshot).not.toHaveBeenCalled()
    expect(harness.subscribe).not.toHaveBeenCalled()
  })
})
