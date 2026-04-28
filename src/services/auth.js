import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { mock_staff } from '../data/mockdata';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get email from localStorage or use default
        const storedEmail = localStorage.getItem('GSG_USER_EMAIL');

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
            // Fallback to mock data if not found
            const mockUser = mock_staff[0];
            setUser({
              uid: mockUser.id,
              displayName: mockUser.name,
              email: mockUser.email,
              role: mockUser.role,
              department: mockUser.department,
              allowance: mockUser.allowance
            });
            localStorage.setItem('GSG_USER_EMAIL', mockUser.email);
          }
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

  return { user, loading };
};
