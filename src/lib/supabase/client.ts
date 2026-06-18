import { createBrowserClient } from '@supabase/ssr'
import { requireSupabasePublicEnv } from './env'

const createSupabaseBrowserClient = () => {
  const { url, publicKey } = requireSupabasePublicEnv()

  return createBrowserClient(url, publicKey)
}

type BrowserSupabaseClient = ReturnType<typeof createSupabaseBrowserClient>

let browserClient: BrowserSupabaseClient | null = null

export function createClient(): BrowserSupabaseClient {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient()
  }

  return browserClient
}
