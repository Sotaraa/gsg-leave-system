import { supabase } from '../supabase';

/**
 * Action audit log — records who did what in the system.
 *
 * Action types (use these constants so callers stay consistent):
 *
 *   Leave / Requests
 *     APPROVE_REQUEST  REJECT_REQUEST  DELETE_REQUEST
 *     MANUAL_LEAVE_ADD  BULK_IMPORT  ROLLBACK_SILENT_IMPORTS
 *
 *   Staff
 *     ADD_STAFF  EDIT_STAFF  ARCHIVE_STAFF  RESTORE_STAFF  DELETE_STAFF
 *
 *   Departments
 *     ADD_DEPARTMENT  DELETE_DEPARTMENT
 *
 *   Term Dates / School Terms
 *     ADD_TERM_DATE  DELETE_TERM_DATE  IMPORT_BANK_HOLIDAYS
 *     ADD_SCHOOL_TERM  DELETE_SCHOOL_TERM
 *
 *   Announcements
 *     POST_ANNOUNCEMENT  DELETE_ANNOUNCEMENT
 *
 *   Settings / Admin
 *     UPDATE_SETTINGS  CARRY_FORWARD_RESET
 *
 * Never throws — logging failures must not break the calling flow.
 */
export const logAction = async ({
  organizationId,
  performedBy,
  actionType,
  entityType,
  entityId     = null,
  entityDescription = null,
  details      = {},
}) => {
  if (!organizationId || !performedBy || !actionType || !entityType) return;
  try {
    await supabase.from('action_log').insert({
      organization_id:    organizationId,
      performed_by:       performedBy,
      action_type:        actionType,
      entity_type:        entityType,
      entity_id:          entityId     ? String(entityId) : null,
      entity_description: entityDescription,
      details:            details,
    });
  } catch (err) {
    // Best-effort — never break the parent operation
    console.warn('action_log insert failed:', err?.message);
  }
};

/**
 * Fetch recent audit log entries for the current organisation.
 * @param {string} organizationId
 * @param {number} limit
 * @param {string|null} actionTypeFilter  Optional — e.g. 'APPROVE_REQUEST'
 */
export const getRecentActionLog = async (organizationId, limit = 100, actionTypeFilter = null) => {
  if (!organizationId) return [];
  try {
    let q = supabase
      .from('action_log')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (actionTypeFilter) q = q.eq('action_type', actionTypeFilter);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('action_log fetch failed:', err);
    return [];
  }
};

// ─── Convenient category groupings for the UI filter ────────────────────────
export const ACTION_CATEGORIES = {
  'Leave & Requests': [
    'APPROVE_REQUEST', 'REJECT_REQUEST', 'DELETE_REQUEST',
    'MANUAL_LEAVE_ADD', 'BULK_IMPORT', 'ROLLBACK_SILENT_IMPORTS',
  ],
  'Staff Management': [
    'ADD_STAFF', 'EDIT_STAFF', 'ARCHIVE_STAFF', 'RESTORE_STAFF', 'DELETE_STAFF',
  ],
  'Departments': [
    'ADD_DEPARTMENT', 'DELETE_DEPARTMENT',
  ],
  'Calendar': [
    'ADD_TERM_DATE', 'DELETE_TERM_DATE', 'IMPORT_BANK_HOLIDAYS',
    'ADD_SCHOOL_TERM', 'DELETE_SCHOOL_TERM',
  ],
  'Announcements': [
    'POST_ANNOUNCEMENT', 'DELETE_ANNOUNCEMENT',
  ],
  'Settings': [
    'UPDATE_SETTINGS', 'CARRY_FORWARD_RESET',
  ],
};

/** Map action_type → { label, colour } for display badges */
export const ACTION_META = {
  APPROVE_REQUEST:          { label: 'Approved',           colour: 'bg-emerald-100 text-emerald-800' },
  REJECT_REQUEST:           { label: 'Rejected',           colour: 'bg-red-100 text-red-800' },
  DELETE_REQUEST:           { label: 'Deleted request',    colour: 'bg-red-100 text-red-800' },
  MANUAL_LEAVE_ADD:         { label: 'Manual leave',       colour: 'bg-blue-100 text-blue-800' },
  BULK_IMPORT:              { label: 'Bulk import',        colour: 'bg-blue-100 text-blue-800' },
  ROLLBACK_SILENT_IMPORTS:  { label: 'Rollback imports',   colour: 'bg-orange-100 text-orange-800' },
  ADD_STAFF:                { label: 'Staff added',        colour: 'bg-emerald-100 text-emerald-800' },
  EDIT_STAFF:               { label: 'Staff edited',       colour: 'bg-indigo-100 text-indigo-800' },
  ARCHIVE_STAFF:            { label: 'Archived',           colour: 'bg-amber-100 text-amber-800' },
  RESTORE_STAFF:            { label: 'Restored',           colour: 'bg-emerald-100 text-emerald-800' },
  DELETE_STAFF:             { label: 'Staff deleted',      colour: 'bg-red-100 text-red-800' },
  ADD_DEPARTMENT:           { label: 'Dept added',         colour: 'bg-emerald-100 text-emerald-800' },
  DELETE_DEPARTMENT:        { label: 'Dept deleted',       colour: 'bg-red-100 text-red-800' },
  ADD_TERM_DATE:            { label: 'Date added',         colour: 'bg-emerald-100 text-emerald-800' },
  DELETE_TERM_DATE:         { label: 'Date deleted',       colour: 'bg-red-100 text-red-800' },
  IMPORT_BANK_HOLIDAYS:     { label: 'Holidays imported',  colour: 'bg-blue-100 text-blue-800' },
  ADD_SCHOOL_TERM:          { label: 'Term added',         colour: 'bg-emerald-100 text-emerald-800' },
  DELETE_SCHOOL_TERM:       { label: 'Term deleted',       colour: 'bg-red-100 text-red-800' },
  POST_ANNOUNCEMENT:        { label: 'Announcement',       colour: 'bg-purple-100 text-purple-800' },
  DELETE_ANNOUNCEMENT:      { label: 'Ann. deleted',       colour: 'bg-red-100 text-red-800' },
  UPDATE_SETTINGS:          { label: 'Settings changed',   colour: 'bg-indigo-100 text-indigo-800' },
  CARRY_FORWARD_RESET:      { label: 'Carry-fwd reset',    colour: 'bg-orange-100 text-orange-800' },
};
