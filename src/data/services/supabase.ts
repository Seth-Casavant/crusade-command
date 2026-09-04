import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { publicEnvironment } from '../../config/env'
import type { Database } from '../../shared/types'

/**
 * Phase 1 integration boundary only. A null client means local Supabase
 * environment values have not been supplied yet; the landing screen remains
 * usable without backend configuration.
 */
export const supabase: SupabaseClient<Database> | null =
  publicEnvironment.supabaseUrl && publicEnvironment.supabasePublishableKey
    ? createClient<Database>(
        publicEnvironment.supabaseUrl,
        publicEnvironment.supabasePublishableKey,
      )
    : null
