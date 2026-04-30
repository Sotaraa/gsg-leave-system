import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uzmdqryhzijkmwedvwka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bWRxcnloemlqa213ZWR2d2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjM2MzMsImV4cCI6MjA5MjkzOTYzM30.O249bdKDyI4IUFRD5pdKIvtxYF1ihR0uQ2SOVBvl3qc';

/**
 * Supabase Client with JWT Authentication Support
 *
 * This client is initialized with the anon key, but can be upgraded to use
 * authenticated JWTs after user signs in with Supabase Auth.
 *
 * Flow:
 * 1. User authenticates with MSAL (Microsoft 365)
 * 2. auth.js creates Supabase Auth user and gets JWT
 * 3. JWT is passed to setSupabaseSession() to upgrade the client
 * 4. All subsequent queries use JWT instead of anon key
 * 5. RLS policies enforce multi-tenant isolation based on auth.uid()
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,      // Automatically refresh JWT before expiry
    persistSession: true,        // Store session in localStorage
    detectSessionInUrl: true,    // Check URL for session hash (for OAuth flows)
  }
});

/**
 * Upgrade Supabase client from anon key to authenticated JWT
 * Call this after user successfully authenticates with Supabase Auth
 *
 * @param {object} session - Supabase Auth session from signUp/signIn
 * @returns {void}
 */
export const setSupabaseSession = (session) => {
  if (session && session.access_token) {
    supabase.auth.setSession(session);
    console.log('🔐 Supabase client upgraded to authenticated JWT');
    console.log(`   User: ${session.user?.email || 'unknown'}`);
    console.log(`   auth.uid(): ${session.user?.id || 'null'}`);
    console.log('   RLS policies are now active');
  } else {
    console.warn('⚠️ setSupabaseSession called with invalid session');
  }
};
