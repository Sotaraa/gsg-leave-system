import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uzmdqryhzijkmwedvwka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcW9icnNvaHBoY3Vza2VyZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjMzNTgsImV4cCI6MjA5MjkzOTM1OH0.9iex0snFMwXn3rmiT5SulLGWAlrKt3y49nVKzwG2kko';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
