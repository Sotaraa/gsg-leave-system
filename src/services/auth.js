import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { mock_staff } from '../data/mockdata';
import * as msal from '@azure/msal-browser';

/**
 * Get organization's Azure AD configuration from Supabase
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{auth: {clientId, authority, redirectUri}, org: object}>}
 */
const getOrganizationConfig = async (organizationId) => {
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, azureClientId, azureTenantId, azureRedirectUri, ssoConfigured')
      .eq('id', organizationId)
      .single();

    if (error || !org) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    if (!org.ssoConfigured || !org.azureClientId || !org.azureTenantId) {
      console.warn(`⚠️ Azure AD SSO not fully configured for ${org.name}`);
    }

    return {
      auth: {
        clientId: org.azureClientId,
        authority: `https://login.microsoftonline.com/${org.azureTenantId}`,
        redirectUri: org.azureRedirectUri
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
 * Multi-tenant authentication hook
 *
 * Routing logic:
 * 1. Extract email domain from user email
 * 2. Check Supabase organizations table for domain match
 * 3. If found → Load user from Supabase mt_staff table (dataSource: 'supabase')
 * 4. If not found → Fall back to Firebase lookup (dataSource: 'firebase')
 *
 * RLS enforcement:
 * - All new Supabase users are added to user_profiles table on first login
 * - user_profiles links auth.users to organizations
 * - RLS policies use user_profiles to enforce organization_id filtering
 */
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get email and auth method from localStorage
        const storedEmail = localStorage.getItem('GSG_USER_EMAIL');
        const method = localStorage.getItem('GSG_AUTH_METHOD') || 'email';
        const storedName = localStorage.getItem('GSG_USER_NAME');

        if (storedEmail) {
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
            // Organization found in Supabase - this is a new multi-tenant user
            console.log(`✅ Organization found: ${org.name}`);

            // Step 1.5: Fetch organization's Azure AD config
            let organizationConfig = null;
            let msalInstance = null;
            let azureToken = null;

            try {
              const { auth: authConfig, org: orgData } = await getOrganizationConfig(org.id);
              organizationConfig = { auth: authConfig, ...orgData };

              // Initialize MSAL with organization's Azure AD config
              if (authConfig.clientId && authConfig.redirectUri) {
                msalInstance = initializeMSAL({ auth: authConfig });
                console.log(`✅ MSAL initialized for ${org.name}`);

                // Try to get token from MSAL cache
                try {
                  const accounts = msalInstance.getAllAccounts();
                  if (accounts.length > 0) {
                    const tokenResponse = await msalInstance.acquireTokenSilent({
                      scopes: ['Mail.Send', 'User.Read'],
                      account: accounts[0]
                    });
                    azureToken = tokenResponse.accessToken;
                    console.log(`✅ Azure token retrieved for ${org.name}`);
                  }
                } catch (tokenError) {
                  console.warn(`⚠️ No cached token for ${org.name}, user will need to sign in`);
                }
              }
            } catch (configError) {
              console.warn(`⚠️ Could not load Azure AD config: ${configError.message}`);
              // Continue with basic user setup even if Azure AD config fails
            }

            // Step 2: Load user from Supabase mt_staff table
            const { data: staffData, error: staffError } = await supabase
              .from('mt_staff')
              .select('*')
              .eq('organization_id', org.id)
              .eq('email', storedEmail)
              .single();

            if (staffData && !staffError) {
              // User found in org staff table
              console.log(`✅ User found in organization: ${staffData.name}`);

              // Ensure user is in user_profiles table (RLS enforcement)
              await ensureUserProfile(storedEmail, org.id, staffData.role);

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
                organizationConfig: organizationConfig,
                azureToken: azureToken,
                msalInstance: msalInstance
              });
            } else {
              // Organization exists but user not in staff table - invite them as new user
              console.log(`⚠️ Organization found but user not in staff table, using guest mode`);
              const displayName = storedName || storedEmail.split('@')[0];

              // Ensure user is in user_profiles table (RLS enforcement)
              await ensureUserProfile(storedEmail, org.id, 'Staff');

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
                organizationConfig: organizationConfig,
                azureToken: azureToken,
                msalInstance: msalInstance
              });
            }
          } else {
            // No organization found - check legacy Firebase/GSG requests table
            console.log(`ℹ️ No Supabase organization found, checking legacy GSG records`);

            // SECURITY: Only allow access if email exists in legacy requests table
            // This prevents random emails from gaining access to any organization
            const { data: requests, error } = await supabase
              .from('requests')
              .select('employeename, employeeemail, department')
              .eq('employeeemail', storedEmail)
              .limit(1);

            if (requests && requests.length > 0) {
              // ✅ Known legacy GSG user - allow access
              const userData = requests[0];
              console.log(`✅ Legacy GSG user found: ${userData.employeename}`);
              setUser({
                uid: userData.employeeemail,
                displayName: userData.employeename,
                email: userData.employeeemail,
                department: userData.department || '',
                role: 'Staff',
                allowance: 25,
                organization: 'gardener-schools',
                organizationName: 'Gardener Schools Group',
                dataSource: 'firebase'
              });
            } else {
              // 🚫 SECURITY: Unknown email - deny access completely
              // User must belong to a known organization or be a legacy GSG user
              console.warn(`🚫 Access denied: ${storedEmail} does not belong to any organization`);
              localStorage.removeItem('GSG_USER_EMAIL');
              localStorage.removeItem('GSG_USER_ORGANIZATION_ID');
              localStorage.removeItem('GSG_AUTH_METHOD');
              setUser(null);
            }
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

  return { user, loading, authMethod };
};

/**
 * Export functions for external use in components
 */
export const authServices = {
  getOrganizationConfig,
  initializeMSAL,
  ensureUserProfile
};
