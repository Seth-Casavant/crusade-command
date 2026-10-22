import { supabase } from './supabase'

export type EventBriefing = {
  title: string
  description: string
  targets: string[]
  modes: string[]
  rules: string[]
}

export async function getEventBriefing(): Promise<EventBriefing | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('event_briefing')
    .select('title, description, targets, modes, rules')
    .eq('published', true).maybeSingle()
  if (error) throw new Error('Event briefing unavailable')
  return data
}
