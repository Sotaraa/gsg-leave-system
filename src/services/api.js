// src/services/api.js
import { supabase } from '../supabase';
import { config } from '../data/mockdata';

export const api = {
  // GET: Fetch requests for the logged-in user
  getMyRequests: async (email) => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('employeeEmail', email)
        .order('submittedAt', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching requests:', error);
      return [];
    }
  },

  // POST: Submit a new request
  submitRequest: async (formData) => {
    try {
      const newReq = {
        ...formData,
        status: 'Pending',
        submittedAt: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('requests')
        .insert([newReq])
        .select();

      if (error) throw error;
      return data?.[0] || newReq;
    } catch (error) {
      console.error('Error submitting request:', error);
      throw error;
    }
  },

  // Helper: Get Dropdown options
  getConfig: () => config
};
