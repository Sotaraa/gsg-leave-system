// src/services/api.js
import { supabase } from '../supabase';
import { config } from '../data/mockdata';

/**
 * Multi-tenant aware API layer
 *
 * All queries include organization_id filtering for RLS enforcement
 * Defense in depth: DB-level RLS + app-level filtering
 */
export const api = {
  // GET: Fetch requests for the logged-in user (organization-scoped)
  getMyRequests: async (email, organizationId) => {
    try {
      // For Supabase users (new orgs), filter by organization_id
      if (organizationId && organizationId !== 'gardener-schools') {
        const { data, error } = await supabase
          .from('mt_requests')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('employeeEmail', email)
          .order('createdAt', { ascending: false });

        if (error) throw error;
        return data || [];
      }

      // For Firebase users (GSG), use legacy requests table (no org filter needed)
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

  // POST: Submit a new request (organization-scoped)
  submitRequest: async (formData, organizationId) => {
    try {
      const newReq = {
        ...formData,
        status: 'Pending',
        submittedAt: new Date().toISOString()
      };

      // For Supabase users (new orgs), include organization_id
      if (organizationId && organizationId !== 'gardener-schools') {
        newReq.organization_id = organizationId;
        const { data, error } = await supabase
          .from('mt_requests')
          .insert([newReq])
          .select();

        if (error) throw error;
        return data?.[0] || newReq;
      }

      // For Firebase users (GSG), use legacy requests table
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
