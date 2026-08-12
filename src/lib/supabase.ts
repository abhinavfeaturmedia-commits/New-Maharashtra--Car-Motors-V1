import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const rawKey = ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string) || '';

export const isSupabaseConfigured = Boolean(
    rawUrl && 
    rawUrl !== 'https://missing-url.supabase.co' && 
    rawKey && 
    rawKey !== 'missing-key'
);

if (!isSupabaseConfigured) {
    console.error('🚨 Missing or invalid Supabase environment variables! Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY.');
}

// Use placeholders to prevent createClient from throwing a fatal error and crashing the whole React app
export const supabase = createClient(
    rawUrl || 'https://missing-url.supabase.co', 
    rawKey || 'missing-key'
);
