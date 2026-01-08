
import { createClient } from '@supabase/supabase-js'

// Provide dummy values to satisfy createClient during build time if envs are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"

// Warning instead of Error to allow build to pass without env vars (for Vercel build phase if secrets are missing)
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Missing Supabase environment variables. Upload features may not work.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
