import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { mock_staff } from '../data/mockdata';

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
          // Fetch user from Supabase using email
          const { data: requests, error } = await supabase
            .from('requests')
            .select('employeename, employeeemail, department')
            .eq('employeeemail', storedEmail)
            .limit(1);

          if (error) throw error;

          if (requests && requests.length > 0) {
            const userData = requests[0];
            setUser({
              uid: userData.employeeemail,
              displayName: userData.employeename,
              email: userData.employeeemail,
              department: userData.department,
              role: 'Staff',
              allowance: 25
            });
          } else {
            // Fallback - user not in Supabase but has email
            // Use Entra name if available, otherwise email prefix
            const displayName = storedName || storedEmail.split('@')[0];
            setUser({
              uid: storedEmail,
              displayName: displayName,
              email: storedEmail,
              department: 'Unknown',
              role: 'Staff',
              allowance: 25,
              isGuest: true // Mark as guest/fallback user
            });
          }
          setAuthMethod(method);
        } else {
          // No email in localStorage - user must sign in via LoginScreen
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
