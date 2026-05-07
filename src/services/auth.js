import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import * as msal from '@azure/msal-browser';
import { getEntraUser, getMsalInstance } from './entraAuth';

/**
 * Get organization's Azure AD configuration from Supabase
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{auth: {clientId, authority, redirectUri}, org: object}>}
 */
const getOrganizationConfig = async (organizationId) => {
  try {
    // Note: Supabase returns column names in lowercase
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, azureclientid, azuretenantid, azureredirecturi, ssoconfigured')
      .eq('id', organizationId)
      .single();

    if (error || !org) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    if (!org.ssoconfigured || !org.azureclientid || !org.azuretenantid) {
      console.warn(`⚠️ Azure AD SSO not fully configured for ${org.name}`);
    }

    return {
      auth: {
        clientId: org.azureclientid,
        authority: `https://login.microsoftonline.com/${org.azuretenantid}`,
        redirectUri: org.azureredirecturi
      },
      org: org
    };
  } catch (error) {
    console.error('❌ Error fetching organization config:', error);
    throw error;
  }
};

/**
 * Initialize MSAL dynamically for the given organization
 *
 * @param {object} config - MSAL configuration with auth settings
 * @returns {PublicClientApplication} MSAL instance
 */
const initializeMSAL = (config) => {
  try {
    const msalConfig = {
      auth: {
        clientId: config.auth.clientId,
        authority: config.auth.authority,
        redirectUri: config.auth.redirectUri
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (containsPii) return;
            console.log(`[MSAL] ${message}`);
          }
        }
      }
    };

    return new msal.PublicClientApplication(msalConfig);
  } catch (error) {
    console.error('❌ Error initializing MSAL:', error);
    throw error;
  }
};

/**
 * Ensure user exists in user_profiles table for RLS enforcement
 * Called on first login to link auth.users to organizations
 *
 * @param {string} email - User email
 * @param {string} organizationId - Organization ID
 * @param {string} role - User role (Staff, Admin, Dept Head, Super Admin)
 */
const ensureUserProfile = async (email, organizationId, role = 'Staff') => {
  try {
    // Get current auth user
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      console.warn('⚠️ No authenticated user found, skipping user_profiles sync');
      return;
    }

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .single();

    if (existingProfile) {
      console.log('✅ User profile already exists');
      return;
    }

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = "no rows returned" which is expected for new users
      console.error('Error checking user profile:', checkError);
      return;
    }

    // Create new user profile
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        auth_user_id: authUser.id,
        organization_id: organizationId,
        email: email,
        full_name: authUser.user_metadata?.name || email.split('@')[0],
        role: role,
        is_super_admin: email?.toLowerCase() === 'info@sotara.co.uk',
        is_organization_admin: role === 'Admin'
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating user profile:', insertError);
      return;
    }

    console.log(`✅ User profile created for ${email} in organization ${organizationId}`);
  } catch (error) {
    console.error('Error in ensureUserProfile:', error);
  }
};

/**
 * SUPABASE AUTH INTEGRATION
 *
 * Sign up/sign in user with Supabase Auth after MSAL authentication
 * This links the MSAL-verified user to Supabase Auth, enabling RLS policies
 *
 * @param {string} email - User email (verified by MSAL)
 * @param {string} organizationId - Organization ID from domain lookup
 * @returns {Promise<{success: boolean, user: object, session: object, error: string}>}
 */
const authenticateWithSupabase = async (email, organizationId) => {
  try {
    console.log(`🔐 Authenticating with Supabase Auth: ${email}`);

    // Generate deterministic password from email
    // (We use this because users authenticate via MSAL, not passwords)
    // This password is the same every time for the same email
    const buffer = new TextEncoder().encode(email + 'gsg-leave-system-auth');
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const password = hashHex.substring(0, 32); // Use first 32 chars as password

    // Step 1: Try to sign up (first time users)
    // If user already exists, signUp will attempt to sign them in
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: email.split('@')[0],
        }
      }
    });

    let session = null;
    let authUser = null;

    if (signUpError) {
      // If signup failed (user likely exists), try signing in
      console.log(`📝 Sign-up returned: ${signUpError.message}, attempting sign-in...`);

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (signInError) {
        throw new Error(`Auth failed: ${signInError.message}`);
      }

      session = signInData.session;
      authUser = signInData.user;
    } else {
      // Sign-up succeeded
      session = signUpData.session;
      authUser = signUpData.user;
      if (authUser) {
        console.log(`✅ New Supabase Auth user created: ${authUser.id}`);
      }
    }

    // Step 2: Update user_profiles with correct organization_id and role
    if (authUser && session) {
      // Get user's role from mt_staff if they exist in the organization
      const { data: staffData } = await supabase
        .from('mt_staff')
        .select('role')
        .eq('organization_id', organizationId)
        .ilike('email', email)
        .single();

      const userRole = staffData?.role || 'Staff';
      const isSuperAdmin = email.toLowerCase() === 'info@sotara.co.uk';
      const isOrgAdmin = userRole === 'Admin';

      // Update user_profiles with real organization_id and role
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          auth_user_id: authUser.id,
          organization_id: organizationId,
          email: email,
          full_name: authUser.user_metadata?.full_name || email.split('@')[0],
          role: userRole,
          is_super_admin: isSuperAdmin,
          is_organization_admin: isOrgAdmin,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'auth_user_id'
        });

      if (profileError) {
        console.error('⚠️ Failed to update user profile:', profileError);
        // Don't throw - profile auto-creation trigger should have created placeholder
      } else {
        console.log(`✅ User profile updated: org=${organizationId}, role=${userRole}, superAdmin=${isSuperAdmin}`);
      }
    }

    return {
      success: true,
      user: authUser,
      session: session
    };
  } catch (error) {
    console.error('❌ Supabase authentication failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Multi-tenant authentication hook
 *
 * Routing logic:
 * 1. Verify auth method is 'entra' and MSAL holds a valid session
 * 2. Extract email domain from user email
 * 3. Check Supabase organizations table for domain match
 * 4. Authenticate with Supabase Auth (enables RLS policies)
 * 5. If found → Load user from Supabase mt_staff table (dataSource: 'supabase')
 * 6. If not found → deny access
 */
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState(null);
  const [supabaseSession, setSupabaseSession] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get email and auth method from localStorage
        const storedEmail = localStorage.getItem('GSG_USER_EMAIL');
        const method = localStorage.getItem('GSG_AUTH_METHOD') || 'email';
        const storedName = localStorage.getItem('GSG_USER_NAME');

        if (storedEmail) {
          // ─── SECURITY ENFORCEMENT ────────────────────────────────────────
          // All users must authenticate via Microsoft (Entra) - no email-only logins.
          // This ensures secure, verified authentication for all users.
          if (method !== 'entra') {
            console.warn('🚫 Session rejected: Microsoft (Entra) authentication is required.');
            localStorage.removeItem('GSG_USER_EMAIL');
            localStorage.removeItem('GSG_USER_NAME');
            localStorage.removeItem('GSG_AUTH_METHOD');
            setUser(null);
            setLoading(false);
            return;
          }

          // Verify MSAL still holds a valid account matching the stored email.
          // This prevents someone from manually writing an email into localStorage.
          const msalUser = getEntraUser();
          if (!msalUser) {
            console.warn('🚫 Session rejected: no active Microsoft session found in MSAL cache.');
            localStorage.removeItem('GSG_USER_EMAIL');
            localStorage.removeItem('GSG_USER_NAME');
            localStorage.removeItem('GSG_AUTH_METHOD');
            setUser(null);
            setLoading(false);
            return;
          }

          if (msalUser.email.toLowerCase() !== storedEmail.toLowerCase()) {
            console.warn(`🚫 Session rejected: MSAL account (${msalUser.email}) does not match stored email (${storedEmail}).`);
            localStorage.removeItem('GSG_USER_EMAIL');
            localStorage.removeItem('GSG_USER_NAME');
            localStorage.removeItem('GSG_AUTH_METHOD');
            setUser(null);
            setLoading(false);
            return;
          }
          // ─────────────────────────────────────────────────────────────────
          // Extract email domain for organization lookup
          const emailDomain = '@' + storedEmail.split('@')[1];
          console.log(`🔍 Looking up organization for domain: ${emailDomain}`);

          // Step 1: Check Supabase organizations table
          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('domain', emailDomain)
            .single();

          if (org && !orgError) {
            // Organization found in Supabase - this is a multi-tenant user
            console.log(`✅ Organization found: ${org.name}`);

            // ─── NEW: AUTHENTICATE WITH SUPABASE AUTH ─────────────────────────────────
            // This links the MSAL-verified user to Supabase Auth, enabling RLS policies
            const supabaseAuth = await authenticateWithSupabase(storedEmail, org.id);

            if (supabaseAuth.success && supabaseAuth.session) {
              console.log('✅ Supabase Auth authentication successful');
              setSupabaseSession(supabaseAuth.session);
              // Store session in localStorage for use by supabaseApi.js
              localStorage.setItem('SUPABASE_SESSION', JSON.stringify(supabaseAuth.session));
            } else {
              console.warn('⚠️ Supabase Auth failed:', supabaseAuth.error);
              console.warn('   Continuing with anon key (less secure fallback)');
              localStorage.removeItem('SUPABASE_SESSION');
            }
            // ────────────────────────────────────────────────────────────────────────────

            // Get azure token from the Sotara multi-tenant MSAL instance
            // (this is the instance that actually authenticated the user)
            let azureToken = null;
            try {
              const sotataMsal = getMsalInstance();
              if (sotataMsal) {
                const accounts = sotataMsal.getAllAccounts();
                if (accounts.length > 0) {
                  const tokenResponse = await sotataMsal.acquireTokenSilent({
                    scopes: ['openid', 'profile', 'email', 'Mail.Send', 'User.Read', 'People.Read'],
                    account: accounts[0]
                  });
                  azureToken = tokenResponse.accessToken;
                  console.log(`✅ Azure token retrieved from Sotara MSAL`);
                }
              }
            } catch (tokenError) {
              console.warn(`⚠️ Could not acquire token silently:`, tokenError.message);
            }

            // Step 2: Load user from Supabase mt_staff table (case-insensitive email match)
            const { data: staffData, error: staffError } = await supabase
              .from('mt_staff')
              .select('*')
              .eq('organization_id', org.id)
              .ilike('email', storedEmail)
              .single();

            if (staffData && !staffError) {
              // User found in org staff table
              console.log(`✅ User found in organization: ${staffData.name}`);

              setUser({
                uid: staffData.id,
                displayName: staffData.name,
                email: staffData.email,
                department: staffData.department || '',
                role: staffData.role || 'Staff',
                allowance: staffData.allowance || 25,
                organization: org.id,
                organizationName: org.name,
                dataSource: 'supabase',
                isOrgAdmin: staffData.role === 'Admin',
                azureToken: azureToken,
              });
            } else {
              // Organization exists but user not in staff table
              console.log(`⚠️ Organization found but user not in staff table, using guest mode`);
              const displayName = storedName || storedEmail.split('@')[0];

              setUser({
                uid: storedEmail,
                displayName: displayName,
                email: storedEmail,
                department: 'Unknown',
                role: 'Staff',
                allowance: org.defaultAllowance || 25,
                organization: org.id,
                organizationName: org.name,
                dataSource: 'supabase',
                isGuest: true,
                isOrgAdmin: false,
                azureToken: azureToken,
              });
            }
          } else {
            // Email domain not found in any organization — deny access
            console.warn(`🚫 Access denied: domain not recognised for ${storedEmail}`);
            localStorage.removeItem('GSG_USER_EMAIL');
            localStorage.removeItem('GSG_USER_NAME');
            localStorage.removeItem('GSG_AUTH_METHOD');
            setUser(null);
          }

          setAuthMethod(method);
        } else {
          // No email in localStorage - user must sign in via LoginScreen
          console.log('ℹ️ No email in localStorage, showing login screen');
          setUser(null);
        }
      } catch (error) {
        console.error('Auth error:', error);
        // On error, show login screen
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return { user, loading, authMethod, supabaseSession };
};

/**
 * Export functions for external use in components
 */
export const authServices = {
  getOrganizationConfig,
  initializeMSAL,
  ensureUserProfile
};
