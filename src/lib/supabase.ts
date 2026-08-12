import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://sxshzxbkjsrruqmrwkfb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_8Ofksy3dQm4ySFi8L2oGtA_pynh3q8c';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
const rawKey = ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(rawUrl && rawKey);

export const supabase = createClient(rawUrl, rawKey);
