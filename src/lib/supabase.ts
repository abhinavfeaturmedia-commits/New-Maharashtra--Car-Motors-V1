import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://sxshzxbkjsrruqmrwkfb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c2h6eGJranNycnVxbXJ3a2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjQxNjcsImV4cCI6MjEwMTg0MDE2N30.0zOD4SLUx5IjFD0Jt6qN-SRndx3XfDRp46z4BCvJDgo';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
const rawKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(rawUrl && rawKey);

export const supabase = createClient(rawUrl, rawKey);

