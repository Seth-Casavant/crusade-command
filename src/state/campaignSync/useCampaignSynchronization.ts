import { useCallback, useEffect, useRef, useState } from 'react'

import { publicEnvironment } from '../../config/env'
import {
  fetchLatestPublicSyncSignal,
  fetchPublicCampaignSnapshot,
  subscribeToPublicSyncSignals,
  SynchronizationError,
  type PublicCampaignSnapshot,
  type PublicSyncSignal,
  type PublicSyncSubscription,
  type RealtimeTransportStatus,
  type SyncErrorCode,
} from '../../data/services/publicCampaign'
import {
  classifySyncSignal,
  RESUME_VERIFICATION_THROTTLE_MS,
  REVISION_VERIFICATION_INTERVAL_MS,
  signalsMatch,
  type ConnectionStatus,
} from './synchronization'

export type CampaignSynchronizationState = PublicCampaignSnapshot & {
  connectionStatus: ConnectionStatus
  lastSynchronizedAt: string | null
  errorCode: SyncErrorCode | null
  isResynchronizing: boolean
}

export type CampaignSynchronizationDependencies = {
  isConfigured: boolean
  fetchSnapshot: () => Promise<PublicCampaignSnapshot>
  fetchLatestSignal: () => Promise<PublicSyncSignal | null>
  subscribe: (
    onSignal: (signal: PublicSyncSignal) => void,
    onStatus: (status: RealtimeTransportStatus) => void,
    onError: (error: SynchronizationError) => void,
  ) => PublicSyncSubscription
  now: () => number
  verificationIntervalMs: number
  resumeThrottleMs: number
}

const defaultDependencies: CampaignSynchronizationDependencies = {
  isConfigured: publicEnvironment.isSupabaseConfigured,
  fetchSnapshot: fetchPublicCampaignSnapshot,
  fetchLatestSignal: fetchLatestPublicSyncSignal,
  subscribe: subscribeToPublicSyncSignals,
  now: Date.now,
  verificationIntervalMs: REVISION_VERIFICATION_INTERVAL_MS,
  resumeThrottleMs: RESUME_VERIFICATION_THROTTLE_MS,
}

function createInitialState(
  isConfigured: boolean,
): CampaignSynchronizationState {
  return {
    campaign: null,
    signal: null,
    connectionStatus: isConfigured ? 'SYNCING' : 'OFFLINE',
    lastSynchronizedAt: null,
    errorCode: null,
    isResynchronizing: false,
  }
}

function errorCodeFor(
  error: unknown,
  fallbackCode: SyncErrorCode,
): SyncErrorCode {
  return error instanceof SynchronizationError ? error.code : fallbackCode
}

export function useCampaignSynchronization(
  dependencies = defaultDependencies,
) {
  const [state, setState] = useState<CampaignSynchronizationState>(() =>
    createInitialState(dependencies.isConfigured),
  )
  const stateRef = useRef(state)
  const isMountedRef = useRef(false)
  const realtimeConnectedRef = useRef(false)
  const synchronizationRef = useRef<Promise<void> | null>(null)
  const subscriptionRef = useRef<PublicSyncSubscription | null>(null)
  const pendingSignalRef = useRef<PublicSyncSignal | null>(null)
  const lastResumeVerificationRef = useRef<number | null>(null)

  const updateState = useCallback(
    (
      update: (
        currentState: CampaignSynchronizationState,
      ) => CampaignSynchronizationState,
    ) => {
      if (!isMountedRef.current) {
        return
      }

      setState((currentState) => {
        const nextState = update(currentState)
        stateRef.current = nextState
        return nextState
      })
    },
    [],
  )

  const synchronize = useCallback(
    (fallbackCode: SyncErrorCode = 'RESYNC_FAILED') => {
      if (synchronizationRef.current) {
        return synchronizationRef.current
      }

      updateState((currentState) => ({
        ...currentState,
        connectionStatus: 'SYNCING',
        isResynchronizing: true,
      }))

      const operation = dependencies
        .fetchSnapshot()
        .then((snapshot) => {
          updateState(() => ({
            ...snapshot,
            connectionStatus: realtimeConnectedRef.current
              ? 'LIVE'
              : 'RECONNECTING',
            lastSynchronizedAt: new Date(dependencies.now()).toISOString(),
            errorCode: null,
            isResynchronizing: false,
          }))
        })
        .catch((error: unknown) => {
          updateState((currentState) => ({
            ...currentState,
            connectionStatus: 'OFFLINE',
            errorCode: errorCodeFor(error, fallbackCode),
            isResynchronizing: false,
          }))
        })
        .finally(() => {
          synchronizationRef.current = null
        })

      synchronizationRef.current = operation
      return operation
    },
    [dependencies, updateState],
  )

  const verifyRevision = useCallback(async () => {
    if (synchronizationRef.current || !dependencies.isConfigured) {
      return
    }

    try {
      const latestSignal = await dependencies.fetchLatestSignal()

      if (!isMountedRef.current) {
        return
      }

      if (!signalsMatch(stateRef.current.signal, latestSignal)) {
        await synchronize('RESYNC_FAILED')
        return
      }

      updateState((currentState) => ({
        ...currentState,
        connectionStatus: realtimeConnectedRef.current
          ? 'LIVE'
          : 'RECONNECTING',
        lastSynchronizedAt: new Date(dependencies.now()).toISOString(),
        errorCode: null,
      }))
    } catch (error) {
      updateState((currentState) => ({
        ...currentState,
        connectionStatus: 'OFFLINE',
        errorCode: errorCodeFor(error, 'NETWORK_UNAVAILABLE'),
      }))
    }
  }, [dependencies, synchronize, updateState])

  const manualResynchronize = useCallback(
    () => synchronize('RESYNC_FAILED'),
    [synchronize],
  )

  useEffect(() => {
    isMountedRef.current = true

    if (!dependencies.isConfigured) {
      return () => {
        isMountedRef.current = false
      }
    }

    function handleSignal(incomingSignal: PublicSyncSignal) {
      const disposition = classifySyncSignal(
        stateRef.current.campaign,
        stateRef.current.signal,
        incomingSignal,
      )

      if (disposition === 'DUPLICATE' || disposition === 'STALE') {
        return
      }

      if (synchronizationRef.current) {
        pendingSignalRef.current = incomingSignal
        void synchronizationRef.current.then(() => {
          const pendingSignal = pendingSignalRef.current
          pendingSignalRef.current = null

          if (pendingSignal && isMountedRef.current) {
            handleSignal(pendingSignal)
          }
        })
        return
      }

      void synchronize('RESYNC_FAILED')
    }

    const handleRealtimeStatus = (status: RealtimeTransportStatus) => {
      if (status === 'DISCONNECTED') {
        realtimeConnectedRef.current = false
        updateState((currentState) => ({
          ...currentState,
          connectionStatus: 'OFFLINE',
          errorCode: 'REALTIME_DISCONNECTED',
        }))
        return
      }

      realtimeConnectedRef.current = true
      updateState((currentState) => ({
        ...currentState,
        connectionStatus: 'RECONNECTING',
      }))
      void synchronize('RESYNC_FAILED')
    }

    const handleRealtimeError = (error: SynchronizationError) => {
      updateState((currentState) => ({
        ...currentState,
        connectionStatus: 'OFFLINE',
        errorCode: error.code,
      }))
    }

    const handleResume = () => {
      if (document.visibilityState !== 'visible') {
        return
      }

      const now = dependencies.now()
      const previousVerification = lastResumeVerificationRef.current

      if (
        previousVerification !== null &&
        now - previousVerification < dependencies.resumeThrottleMs
      ) {
        return
      }

      lastResumeVerificationRef.current = now
      void verifyRevision()
    }

    document.addEventListener('visibilitychange', handleResume)
    window.addEventListener('focus', handleResume)

    const verificationTimer = window.setInterval(
      () => void verifyRevision(),
      dependencies.verificationIntervalMs,
    )

    void synchronize('PUBLIC_STATE_FETCH_FAILED').then(() => {
      if (!isMountedRef.current || subscriptionRef.current) {
        return
      }

      subscriptionRef.current = dependencies.subscribe(
        handleSignal,
        handleRealtimeStatus,
        handleRealtimeError,
      )
    })

    return () => {
      isMountedRef.current = false
      realtimeConnectedRef.current = false
      window.clearInterval(verificationTimer)
      document.removeEventListener('visibilitychange', handleResume)
      window.removeEventListener('focus', handleResume)

      if (subscriptionRef.current) {
        const subscription = subscriptionRef.current
        subscriptionRef.current = null
        void subscription.unsubscribe()
      }
    }
  }, [dependencies, synchronize, updateState, verifyRevision])

  return {
    ...state,
    isConfigured: dependencies.isConfigured,
    manualResynchronize,
    verifyRevision,
  }
}
