import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://jvxoclbgggfugmnbsosf.supabase.co'
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? 'sb_publishable_vUmiT7YMOd-O9afxzOn-2g_QPTiGzmg'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
})

export async function ensureAnonymousSession() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (sessionData.session) return sessionData.session

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  if (!data.session) throw new Error('Could not start a private session')
  return data.session
}

export function getRiyadhDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}
