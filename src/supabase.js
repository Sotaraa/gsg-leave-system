import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uzmdqryhzijkmwedvwka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bWRxcnloemlqa213ZWR2d2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjM2MzMsImV4cCI6MjA5MjkzOTYzM30.O249bdKDyI4IUFRD5pdKIvtxYF1ihR0uQ2SOVBvl3qc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
