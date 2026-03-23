import { useState, useEffect } from 'react';
import { mock_staff } from '../data/mockdata';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check LocalStorage for a saved user ID, default to "staff_001" (Jane)
    const storedID = localStorage.getItem('GSG_DEV_USER') || "staff_001";
    
    const timer = setTimeout(() => {
      const foundUser = mock_staff.find(u => u.id === storedID);
      
      if (foundUser) {
        setUser({
          uid: foundUser.id,
          displayName: foundUser.name,
          email: foundUser.email,
          role: foundUser.role,
          department: foundUser.department,
          allowance: foundUser.allowance
        });
      }
      setLoading(false);
    }, 400); // Faster load time

    return () => clearTimeout(timer);
  }, []);

  return { user, loading };
};
