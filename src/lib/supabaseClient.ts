import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = supabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-client-info': 'training-mvp' } },
    })
  : null

export function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase не настроен. Заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env и перезапустите dev-сервер.',
    )
  }
  return supabase
}

