import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { mock_staff } from '../data/mockdata';

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
                isOrgAdmin: staffData.role === 'Admin'
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
                isOrgAdmin: false
              });
            }
          } else {
            // No organization found - fall back to Firebase (GSG user)
            console.log(`ℹ️ No Supabase organization found, falling back to Firebase (GSG)`);

            // Fetch user from Supabase requests table (legacy auth check)
            const { data: requests, error } = await supabase
              .from('requests')
              .select('employeename, employeeemail, department')
              .eq('employeeemail', storedEmail)
              .limit(1);

            if (requests && requests.length > 0) {
              const userData = requests[0];
              setUser({
                uid: userData.employeeemail,
                displayName: userData.employeename,
                email: userData.employeeemail,
                department: userData.department || '',
                role: 'Staff',
                allowance: 25,
                organization: 'gardener-schools', // Default GSG org
                organizationName: 'Gardener Schools Group',
                dataSource: 'firebase'
              });
            } else {
              // Fallback - user not found anywhere
              // Use Entra name if available, otherwise email prefix
              const displayName = storedName || storedEmail.split('@')[0];
              setUser({
                uid: storedEmail,
                displayName: displayName,
                email: storedEmail,
                department: 'Unknown',
                role: 'Staff',
                allowance: 25,
                organization: 'gardener-schools',
                organizationName: 'Gardener Schools Group',
                dataSource: 'firebase',
                isGuest: true
              });
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
