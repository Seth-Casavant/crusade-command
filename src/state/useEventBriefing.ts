import { useEffect, useState } from 'react'
import { getEventBriefing, type EventBriefing } from '../data/services/eventBriefing'

export function useEventBriefing() {
  const [briefing, setBriefing] = useState<EventBriefing | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    getEventBriefing().then((value) => {
      if (!cancelled) { setBriefing(value); setStatus('ready') }
    }).catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [attempt])
  return { briefing, status, retry: () => { setStatus('loading'); setAttempt((value) => value + 1) } }
}
