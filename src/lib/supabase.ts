import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://sxshzxbkjsrruqmrwkfb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c2h6eGJranNycnVxbXJ3a2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjQxNjcsImV4cCI6MjEwMTg0MDE2N30.0zOD4SLUx5IjFD0Jt6qN-SRndx3XfDRp46z4BCvJDgo';

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
export const supabaseAnonKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Creates an isolated, non-persisting Supabase client.
 * Essential for admin operations (like creating staff accounts via auth.signUp)
 * without displacing or resetting the current logged-in admin's auth session.
 */
export const createIsolatedClient = () => {
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
};

