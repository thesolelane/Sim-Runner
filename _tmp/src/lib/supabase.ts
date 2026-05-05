import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Replace navigator.locks with a simple pass-through to prevent lock
    // contention when multiple iframes share the same origin (e.g. canvas previews).
    // In production with a single tab there is no race condition so this is safe.
    lock: (_name, _acquireTimeout, fn) => fn(),
  },
})
