import { supabase } from './supabase'

export async function assignKillTeamCheckpoint(
  killTeamId: string,
  checkpointId: string,
  expectedRevision: number,
): Promise<void> {
  if (!supabase) {
    throw new Error('Campaign service is unavailable.')
  }

  const { error } = await supabase.rpc('assign_kill_team_checkpoint', {
    p_kill_team_id: killTeamId,
    p_checkpoint_id: checkpointId,
    p_expected_revision: expectedRevision,
  })

  if (error) {
    if (error.message.includes('REVISION_CONFLICT')) {
      throw new Error('Campaign data changed. Refresh and try again.')
    }
    if (error.message.includes('KILL_TEAM_CHECKPOINT_UNCHANGED')) {
      throw new Error('This team is already at that checkpoint.')
    }
    throw new Error('Checkpoint update failed. Refresh and try again.')
  }
}
