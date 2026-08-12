import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://missing-url.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-key';

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );
