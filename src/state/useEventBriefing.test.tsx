import { act, renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { getEventBriefing } from '../data/services/eventBriefing'
import { useEventBriefing } from './useEventBriefing'

vi.mock('../data/services/eventBriefing', () => ({ getEventBriefing: vi.fn() }))

it('offers retry after a failed request and replaces the error with confirmed briefing data', async () => {
  const briefing = { title: 'Published hunt', description: '', targets: ['Carnifex'], modes: ['Siege'], rules: [] }
  vi.mocked(getEventBriefing).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(briefing)
  const { result } = renderHook(() => useEventBriefing())
  await waitFor(() => expect(result.current.status).toBe('error'))
  expect(result.current.briefing).toBeNull()
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current.briefing).toEqual(briefing)
})
