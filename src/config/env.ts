export type PublicEnvironment = {
  supabaseUrl: string | null
  supabasePublishableKey: string | null
  isSupabaseConfigured: boolean
}

function readOptionalValue(
  value: string | undefined,
  placeholder: string,
): string | null {
  const normalized = value?.trim()
  return normalized && !normalized.includes(placeholder) ? normalized : null
}

const supabaseUrl = readOptionalValue(
  import.meta.env.VITE_SUPABASE_URL,
  'your-project-ref',
)
const supabasePublishableKey = readOptionalValue(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'your-public-publishable-key',
)

export const publicEnvironment: PublicEnvironment = Object.freeze({
  supabaseUrl,
  supabasePublishableKey,
  isSupabaseConfigured: Boolean(supabaseUrl && supabasePublishableKey),
})
