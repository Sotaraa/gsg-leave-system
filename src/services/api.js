// src/services/api.js
import { mock_requests, config } from '../data/mockdata';

// This Array is your "Database" for Phase 1
let localRequests = [...mock_requests];

// Helper to fake slow internet (makes it feel real)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // GET: Fetch requests for the logged-in user
  getMyRequests: async (email) => {
    await delay(400); 
    return localRequests.filter(req => req.employeeEmail === email);
  },

  // POST: Submit a new request
  submitRequest: async (formData) => {
    await delay(800);
    const newReq = {
      ...formData,
      id: `req_${Date.now()}`,
      status: 'Pending',
      submittedAt: new Date().toISOString()
    };
    localRequests = [newReq, ...localRequests];
    return newReq;
  },

  // Helper: Get Dropdown options
  getConfig: () => config
};
