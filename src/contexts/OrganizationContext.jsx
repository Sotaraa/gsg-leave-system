import React, { createContext, useContext, useMemo } from 'react';

/**
 * OrganizationContext
 *
 * Provides organization context to the entire app for:
 * 1. Defense in depth - all queries include organization_id filtering
 * 2. Admin checks - verify user can perform org-level actions
 * 3. Data isolation - ensure no cross-org data leakage
 *
 * Pattern: Every Supabase query MUST include:
 *   .eq('organization_id', currentOrganization.id)
 *
 * RLS is the database-level enforcement, this is the app-level defense.
 */
const OrganizationContext = createContext(null);

export const OrganizationProvider = ({ user, children }) => {
  const currentOrganization = useMemo(() => {
    if (!user) return null;

    return {
      id: user.organization,
      name: user.organizationName,
      email: user.email,
      isSuperAdmin: user.email?.toLowerCase() === 'info@sotara.co.uk',
      isOrgAdmin: user.isOrgAdmin || false,
      dataSource: user.dataSource, // 'firebase' or 'supabase'
    };
  }, [user]);

  const value = {
    currentOrganization,
    organizationId: currentOrganization?.id,
    isSuperAdmin: currentOrganization?.isSuperAdmin || false,
    isOrgAdmin: currentOrganization?.isOrgAdmin || false,
    canManageOrg: currentOrganization?.isSuperAdmin || currentOrganization?.isOrgAdmin,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

/**
 * useOrganization Hook
 *
 * Usage:
 *   const { currentOrganization, organizationId, canManageOrg } = useOrganization();
 *
 * Always available:
 *   - currentOrganization: { id, name, email, isSuperAdmin, isOrgAdmin, dataSource }
 *   - organizationId: shortcut for currentOrganization.id
 *   - isSuperAdmin: true if user is Sotara master admin
 *   - isOrgAdmin: true if user can manage their organization
 *   - canManageOrg: true if user can make org-level changes
 */
export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
};

export default OrganizationContext;
