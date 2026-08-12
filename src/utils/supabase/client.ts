import { createBrowserClient } from "@supabase/ssr";

const DEFAULT_SUPABASE_URL = 'https://sxshzxbkjsrruqmrwkfb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c2h6eGJranNycnVxbXJ3a2ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjQxNjcsImV4cCI6MjEwMTg0MDE2N30.0zOD4SLUx5IjFD0Jt6qN-SRndx3XfDRp46z4BCvJDgo';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );

