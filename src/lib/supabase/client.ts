import { createBrowserClient } from '@supabase/ssr'

const createSupabaseBrowserClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  )

type BrowserSupabaseClient = ReturnType<typeof createSupabaseBrowserClient>

let browserClient: BrowserSupabaseClient | null = null

export function createClient(): BrowserSupabaseClient {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient()
  }

  return browserClient
}
