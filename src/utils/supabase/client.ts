import { createBrowserClient } from "@supabase/ssr";

const DEFAULT_SUPABASE_URL = 'https://sxshzxbkjsrruqmrwkfb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_8Ofksy3dQm4ySFi8L2oGtA_pynh3q8c';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );
