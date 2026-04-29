/**
 * Supabase API Layer
 *
 * All operations are organization-scoped for multi-tenant isolation.
 * Every function includes organization_id filtering for RLS enforcement.
 *
 * Migration from Firebase to Supabase - Complete API replacement
 */

import { supabase } from '../supabase';
import {
  sendApprovalNotification,
  sendRejectionNotification,
  sendSubmissionNotification
} from './emailNotifications';

/**
 * DATABASE FIELD MAPPING
 * Database uses lowercase, but JavaScript uses camelCase
 * These functions transform between the two
 */

const requestFieldMap = {
  // Database -> JavaScript
  'employeeemail': 'employeeEmail',
  'employeename': 'employeeName',
  'startdate': 'startDate',
  'enddate': 'endDate',
  'ishalfday': 'isHalfDay',
  'hoursworked': 'hoursWorked',
  'dayscount': 'daysCount',
  'sickreason': 'sickReason',
  'approvalsubtype': 'approvalSubType',
  'submittedat': 'submittedAt',
  'importedsilently': 'importedSilently',
  'organization_id': 'organization_id',
  'createdat': 'createdAt'
};

const staffFieldMap = {
  'istermtime': 'isTermTime',
  'termtimedaystarget': 'termTimeDaysTarget',
  'workingdays': 'workingDays',
  'hoursperday': 'hoursPerDay',
  'approveremail': 'approverEmail',
  'isarchived': 'isArchived',
  'carryforwarddays': 'carryForwardDays',
  'organization_id': 'organization_id',
  'createdat': 'createdAt'
};

const settingsFieldMap = {
  'defaultallowance': 'defaultAllowance',
  'maxcarryforwarddays': 'maxCarryForwardDays',
  'carryforwardenabled': 'carryForwardEnabled',
  'holidayyearstartmonth': 'holidayYearStartMonth',
  'holidayyearstartday': 'holidayYearStartDay',
  'termtimedaystarget': 'termTimeDaysTarget',
  'hoursperday': 'hoursPerDay',
  'lastyearresetdate': 'lastYearResetDate',
  'lastyearresetclosingdate': 'lastYearResetClosingDate',
  'organization_id': 'organization_id',
  'created_at': 'createdAt',
  'updated_at': 'updatedAt'
};

const schoolTermsFieldMap = {
  'academicyear': 'academicYear',
  'autumnstart': 'autumnStart',
  'autumnend': 'autumnEnd',
  'autumnhalftermstart': 'autumnHalfTermStart',
  'autumnhalftermend': 'autumnHalfTermEnd',
  'springstart': 'springStart',
  'springend': 'springEnd',
  'springhalftermstart': 'springHalfTermStart',
  'springhalftermend': 'springHalfTermEnd',
  'summerstart': 'summerStart',
  'summerend': 'summerEnd',
  'summerhalftermstart': 'summerHalfTermStart',
  'summerhalftermend': 'summerHalfTermEnd',
  'organization_id': 'organization_id',
  'createdat': 'createdAt'
};

/**
 * Transform database row to JavaScript object
 */
const transformRow = (row, fieldMap) => {
  if (!row) return null;
  const transformed = {};

  // Map known fields
  Object.entries(fieldMap).forEach(([dbField, jsField]) => {
    if (dbField in row) {
      transformed[jsField] = row[dbField];
    }
  });

  // Keep any unmapped fields as-is (for flexibility)
  Object.keys(row).forEach(key => {
    if (!Object.values(fieldMap).includes(key) && !(key in transformed)) {
      transformed[key] = row[key];
    }
  });

  return transformed;
};

/**
 * Transform array of database rows
 */
const transformRows = (rows, fieldMap) => {
  return rows.map(row => transformRow(row, fieldMap));
};

/**
 * Convert JavaScript object to database format
 */
const toDbFormat = (obj, fieldMap) => {
  if (!obj) return null;
  const dbObj = {};

  // Reverse map
  const reverseMap = {};
  Object.entries(fieldMap).forEach(([dbField, jsField]) => {
    reverseMap[jsField] = dbField;
  });

  Object.entries(obj).forEach(([key, value]) => {
    const dbField = reverseMap[key] || key;
    dbObj[dbField] = value;
  });

  return dbObj;
};

/**
 * REQUESTS OPERATIONS
 */

export const requestsApi = {
  /**
   * Get all requests for the logged-in user
   */
  getMyRequests: async (email, organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('employeeemail', email)
        .order('submittedat', { ascending: false });

      if (error) throw error;
      return transformRows(data || [], requestFieldMap);
    } catch (error) {
      console.error('❌ Error fetching user requests:', error);
      throw error;
    }
  },

  /**
   * Get all requests for an organization (for managers/admins)
   */
  getAllRequests: async (organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .order('submittedat', { ascending: false });

      if (error) throw error;
      return transformRows(data || [], requestFieldMap);
    } catch (error) {
      console.error('❌ Error fetching all requests:', error);
      throw error;
    }
  },

  /**
   * Submit a new leave request
   */
  submitRequest: async (formData, organizationId) => {
    try {
      const newRequest = {
        ...formData,
        organization_id: organizationId,
        status: 'Pending',
        submittedAt: new Date().toISOString()
      };

      // Convert to database format
      const dbRequest = toDbFormat(newRequest, requestFieldMap);

      const { data, error } = await supabase
        .from('mt_requests')
        .insert([dbRequest])
        .select();

      if (error) throw error;
      console.log(`✅ Request submitted for ${formData.employeeName}`);
      return transformRow(data?.[0], requestFieldMap);
    } catch (error) {
      console.error('❌ Error submitting request:', error);
      throw error;
    }
  },

  /**
   * Approve a leave request and send notification email
   */
  approveRequest: async (requestId, approvalSubType, organizationId, azureToken, employeeEmail, employeeName, requestType) => {
    try {
      const updateData = { status: 'Approved' };
      if (approvalSubType) updateData.approvalSubType = approvalSubType;

      const { data, error } = await supabase
        .from('mt_requests')
        .update(updateData)
        .eq('id', requestId)
        .eq('organization_id', organizationId)
        .select();

      if (error) throw error;

      // Send approval email if we have the necessary info
      if (azureToken && employeeEmail && employeeName && requestType) {
        try {
          await sendApprovalNotification(
            employeeEmail,
            employeeName,
            requestType,
            organizationId,
            azureToken
          );
          console.log(`✅ Approval notification sent to ${employeeEmail}`);
        } catch (emailError) {
          console.warn(`⚠️ Failed to send approval email: ${emailError.message}`);
          // Don't fail the request approval if email fails
        }
      }

      return data?.[0];
    } catch (error) {
      console.error('❌ Error approving request:', error);
      throw error;
    }
  },

  /**
   * Reject a leave request and send notification email
   */
  rejectRequest: async (requestId, reason, organizationId, azureToken, employeeEmail, employeeName, requestType) => {
    try {
      const { data, error } = await supabase
        .from('mt_requests')
        .update({ status: 'Rejected' })
        .eq('id', requestId)
        .eq('organization_id', organizationId)
        .select();

      if (error) throw error;

      // Send rejection email if we have the necessary info
      if (azureToken && employeeEmail && employeeName && requestType) {
        try {
          await sendRejectionNotification(
            employeeEmail,
            employeeName,
            requestType,
            reason || 'Not specified',
            organizationId,
            azureToken
          );
          console.log(`✅ Rejection notification sent to ${employeeEmail}`);
        } catch (emailError) {
          console.warn(`⚠️ Failed to send rejection email: ${emailError.message}`);
          // Don't fail the request rejection if email fails
        }
      }

      return data?.[0];
    } catch (error) {
      console.error('❌ Error rejecting request:', error);
      throw error;
    }
  },

  /**
   * Delete a leave request
   */
  deleteRequest: async (requestId, organizationId) => {
    try {
      const { error } = await supabase
        .from('mt_requests')
        .delete()
        .eq('id', requestId)
        .eq('organization_id', organizationId);

      if (error) throw error;
      console.log(`✅ Request deleted: ${requestId}`);
    } catch (error) {
      console.error('❌ Error deleting request:', error);
      throw error;
    }
  },

  /**
   * Delete multiple silently imported records
   */
  deleteSilentImports: async (organizationId) => {
    try {
      const { error } = await supabase
        .from('mt_requests')
        .delete()
        .eq('organization_id', organizationId)
        .eq('importedSilently', true);

      if (error) throw error;
      console.log(`✅ Silent imports deleted for ${organizationId}`);
    } catch (error) {
      console.error('❌ Error deleting silent imports:', error);
      throw error;
    }
  }
};

/**
 * STAFF OPERATIONS
 */

export const staffApi = {
  /**
   * Get all staff for an organization
   */
  getStaffList: async (organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_staff')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      return transformRows(data || [], staffFieldMap);
    } catch (error) {
      console.error('❌ Error fetching staff list:', error);
      throw error;
    }
  },

  /**
   * Add a new staff member
   */
  addStaff: async (staffData, organizationId) => {
    try {
      const newStaff = {
        ...staffData,
        organization_id: organizationId
      };

      // Convert to database format
      const dbStaff = toDbFormat(newStaff, staffFieldMap);

      const { data, error } = await supabase
        .from('mt_staff')
        .insert([dbStaff])
        .select();

      if (error) throw error;
      console.log(`✅ Staff member added: ${staffData.name}`);
      return transformRow(data?.[0], staffFieldMap);
    } catch (error) {
      console.error('❌ Error adding staff:', error);
      throw error;
    }
  },

  /**
   * Update a staff member
   */
  updateStaff: async (staffId, updates, organizationId) => {
    try {
      // Convert to database format
      const dbUpdates = toDbFormat(updates, staffFieldMap);

      const { data, error } = await supabase
        .from('mt_staff')
        .update(dbUpdates)
        .eq('id', staffId)
        .eq('organization_id', organizationId)
        .select();

      if (error) throw error;
      console.log(`✅ Staff member updated: ${staffId}`);
      return transformRow(data?.[0], staffFieldMap);
    } catch (error) {
      console.error('❌ Error updating staff:', error);
      throw error;
    }
  },

  /**
   * Update staff TOIL target
   */
  updateStaffTarget: async (staffId, newTarget, organizationId) => {
    return staffApi.updateStaff(staffId, { termTimeDaysTarget: newTarget }, organizationId);
  },

  /**
   * Toggle staff archive status
   */
  toggleArchiveStaff: async (staffId, isArchived, organizationId) => {
    return staffApi.updateStaff(staffId, { isArchived }, organizationId);
  },

  /**
   * Delete (hard delete) a staff member
   */
  deleteStaff: async (staffId, organizationId) => {
    try {
      const { error } = await supabase
        .from('mt_staff')
        .delete()
        .eq('id', staffId)
        .eq('organization_id', organizationId);

      if (error) throw error;
      console.log(`✅ Staff member deleted: ${staffId}`);
    } catch (error) {
      console.error('❌ Error deleting staff:', error);
      throw error;
    }
  },

  /**
   * Apply carry forward updates to multiple staff members
   * Used for year-end reset
   */
  applyCarryForward: async (carryForwardData, organizationId) => {
    try {
      // Execute batch updates sequentially
      for (const { staffId, carryForward } of carryForwardData) {
        await staffApi.updateStaff(staffId, { carryForwardDays: carryForward }, organizationId);
      }
      console.log(`✅ Carry forward applied to ${carryForwardData.length} staff members`);
    } catch (error) {
      console.error('❌ Error applying carry forward:', error);
      throw error;
    }
  }
};

/**
 * DEPARTMENTS OPERATIONS
 */

export const departmentsApi = {
  /**
   * Get all departments for an organization
   */
  getDepartments: async (organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_departments')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching departments:', error);
      throw error;
    }
  },

  /**
   * Add a new department
   */
  addDepartment: async (name, organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_departments')
        .insert([{ name, organization_id: organizationId }])
        .select();

      if (error) throw error;
      console.log(`✅ Department added: ${name}`);
      return data?.[0];
    } catch (error) {
      console.error('❌ Error adding department:', error);
      throw error;
    }
  },

  /**
   * Delete a department
   */
  deleteDepartment: async (deptId, organizationId) => {
    try {
      const { error } = await supabase
        .from('mt_departments')
        .delete()
        .eq('id', deptId)
        .eq('organization_id', organizationId);

      if (error) throw error;
      console.log(`✅ Department deleted: ${deptId}`);
    } catch (error) {
      console.error('❌ Error deleting department:', error);
      throw error;
    }
  }
};

/**
 * TERM DATES OPERATIONS (School calendar events)
 */

export const termDatesApi = {
  /**
   * Get all term dates for an organization
   */
  getTermDates: async (organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_termdates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching term dates:', error);
      throw error;
    }
  },

  /**
   * Add a new term date
   */
  addTermDate: async (dateData, organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_termdates')
        .insert([{ ...dateData, organization_id: organizationId }])
        .select();

      if (error) throw error;
      console.log(`✅ Term date added: ${dateData.description}`);
      return data?.[0];
    } catch (error) {
      console.error('❌ Error adding term date:', error);
      throw error;
    }
  },

  /**
   * Delete a term date
   */
  deleteTermDate: async (dateId, organizationId) => {
    try {
      const { error } = await supabase
        .from('mt_termdates')
        .delete()
        .eq('id', dateId)
        .eq('organization_id', organizationId);

      if (error) throw error;
      console.log(`✅ Term date deleted: ${dateId}`);
    } catch (error) {
      console.error('❌ Error deleting term date:', error);
      throw error;
    }
  },

  /**
   * Bulk import bank holidays
   */
  importBankHolidays: async (holidays, organizationId) => {
    try {
      const holidayRecords = holidays.map(h => ({
        date: h.date,
        description: h.description,
        type: 'Bank Holiday',
        organization_id: organizationId
      }));

      const { error } = await supabase
        .from('mt_termdates')
        .insert(holidayRecords);

      if (error) throw error;
      console.log(`✅ ${holidays.length} bank holidays imported`);
    } catch (error) {
      console.error('❌ Error importing bank holidays:', error);
      throw error;
    }
  }
};

/**
 * SCHOOL TERMS OPERATIONS (Academic year configuration)
 */

export const schoolTermsApi = {
  /**
   * Get all school terms for an organization
   */
  getSchoolTerms: async (organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_schoolterms')
        .select('*')
        .eq('organization_id', organizationId)
        .order('academicyear', { ascending: false });

      if (error) throw error;
      return transformRows(data || [], schoolTermsFieldMap);
    } catch (error) {
      console.error('❌ Error fetching school terms:', error);
      throw error;
    }
  },

  /**
   * Add a new school term
   */
  addSchoolTerm: async (termData, organizationId) => {
    try {
      // Convert to database format
      const dbTermData = toDbFormat(termData, schoolTermsFieldMap);

      const { data, error } = await supabase
        .from('mt_schoolterms')
        .insert([{ ...dbTermData, organization_id: organizationId }])
        .select();

      if (error) throw error;
      console.log(`✅ School term added: ${termData.academicYear}`);
      return transformRow(data?.[0], schoolTermsFieldMap);
    } catch (error) {
      console.error('❌ Error adding school term:', error);
      throw error;
    }
  },

  /**
   * Delete a school term
   */
  deleteSchoolTerm: async (termId, organizationId) => {
    try {
      const { error } = await supabase
        .from('mt_schoolterms')
        .delete()
        .eq('id', termId)
        .eq('organization_id', organizationId);

      if (error) throw error;
      console.log(`✅ School term deleted: ${termId}`);
    } catch (error) {
      console.error('❌ Error deleting school term:', error);
      throw error;
    }
  }
};

/**
 * ANNOUNCEMENTS OPERATIONS
 */

export const announcementsApi = {
  /**
   * Get all announcements for an organization
   */
  getAnnouncements: async (organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_announcements')
        .select('*')
        .eq('organization_id', organizationId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching announcements:', error);
      throw error;
    }
  },

  /**
   * Add a new announcement
   */
  addAnnouncement: async (message, expiryDate, organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_announcements')
        .insert([{
          message,
          expiry: expiryDate,
          date: new Date().toISOString(),
          organization_id: organizationId
        }])
        .select();

      if (error) throw error;
      console.log(`✅ Announcement posted`);
      return data?.[0];
    } catch (error) {
      console.error('❌ Error adding announcement:', error);
      throw error;
    }
  },

  /**
   * Delete an announcement
   */
  deleteAnnouncement: async (announcementId, organizationId) => {
    try {
      const { error } = await supabase
        .from('mt_announcements')
        .delete()
        .eq('id', announcementId)
        .eq('organization_id', organizationId);

      if (error) throw error;
      console.log(`✅ Announcement deleted: ${announcementId}`);
    } catch (error) {
      console.error('❌ Error deleting announcement:', error);
      throw error;
    }
  }
};

/**
 * SETTINGS OPERATIONS (Organization-scoped)
 */

export const settingsApi = {
  /**
   * Get organization settings
   */
  getSettings: async (organizationId) => {
    try {
      const { data, error } = await supabase
        .from('mt_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No rows found - return defaults
        return {
          defaultAllowance: 20,
          holidayYearStartMonth: 9,
          holidayYearStartDay: 1,
          maxCarryForwardDays: 5,
          carryForwardEnabled: true,
          termTimeDaysTarget: 30,
          hoursPerDay: 8
        };
      }

      if (error) throw error;
      return transformRow(data, settingsFieldMap);
    } catch (error) {
      console.error('❌ Error fetching settings:', error);
      throw error;
    }
  },

  /**
   * Update organization settings
   */
  updateSettings: async (updates, organizationId) => {
    try {
      // Convert to database format
      const dbUpdates = toDbFormat(updates, settingsFieldMap);

      // First try to update
      const { data: existing } = await supabase
        .from('mt_settings')
        .select('id')
        .eq('organization_id', organizationId)
        .single();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('mt_settings')
          .update(dbUpdates)
          .eq('organization_id', organizationId)
          .select();

        if (error) throw error;
        console.log(`✅ Settings updated for ${organizationId}`);
        return transformRow(data?.[0], settingsFieldMap);
      } else {
        // Create new
        const { data, error } = await supabase
          .from('mt_settings')
          .insert([{ ...dbUpdates, organization_id: organizationId }])
          .select();

        if (error) throw error;
        console.log(`✅ Settings created for ${organizationId}`);
        return transformRow(data?.[0], settingsFieldMap);
      }
    } catch (error) {
      console.error('❌ Error updating settings:', error);
      throw error;
    }
  }
};

/**
 * REAL-TIME LISTENERS
 *
 * Subscribe to changes in organization data
 */

export const createRealtimeListener = (table, organizationId, callback) => {
  try {
    const subscription = supabase
      .from(table)
      .on('*', (payload) => {
        // Filter by organization_id if the table has it
        if (payload.new?.organization_id === organizationId || payload.old?.organization_id === organizationId) {
          callback(payload);
        }
      })
      .subscribe();

    console.log(`🔔 Real-time listener created for ${table} (org: ${organizationId})`);
    return subscription;
  } catch (error) {
    console.error(`❌ Error creating listener for ${table}:`, error);
    throw error;
  }
};

/**
 * Create listeners for all core tables
 */
export const setupRealtimeListeners = (organizationId, callbacks) => {
  const subscriptions = [];

  // Staff listener
  if (callbacks.onStaffChange) {
    subscriptions.push(createRealtimeListener('mt_staff', organizationId, callbacks.onStaffChange));
  }

  // Requests listener
  if (callbacks.onRequestsChange) {
    subscriptions.push(createRealtimeListener('mt_requests', organizationId, callbacks.onRequestsChange));
  }

  // Departments listener
  if (callbacks.onDepartmentsChange) {
    subscriptions.push(createRealtimeListener('mt_departments', organizationId, callbacks.onDepartmentsChange));
  }

  // Settings listener
  if (callbacks.onSettingsChange) {
    subscriptions.push(createRealtimeListener('mt_settings', organizationId, callbacks.onSettingsChange));
  }

  // Term dates listener
  if (callbacks.onTermDatesChange) {
    subscriptions.push(createRealtimeListener('mt_termdates', organizationId, callbacks.onTermDatesChange));
  }

  return subscriptions;
};

/**
 * Cleanup all subscriptions
 */
export const cleanupRealtimeListeners = (subscriptions) => {
  subscriptions.forEach(sub => {
    supabase.removeSubscription(sub);
  });
  console.log(`✅ ${subscriptions.length} real-time listeners cleaned up`);
};
