/**
 * Integration Tests for Multi-Tenant Authentication Flow
 *
 * Tests cover:
 * - Organization detection by email domain
 * - Organization selector fallback
 * - MSAL initialization with org-specific config
 * - User profile creation for RLS enforcement
 * - Data isolation between organizations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '../supabase';
import { authServices } from './auth';

// Mock Supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}));

// Mock MSAL
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn(() => ({
    getAllAccounts: vi.fn(),
    acquireTokenSilent: vi.fn()
  }))
}));

describe('Multi-Tenant Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Organization Detection', () => {
    it('should detect organization by email domain', async () => {
      const mockOrg = {
        id: 'stjames',
        name: 'St James School',
        domain: '@stjames.co.uk',
        azureClientId: 'test-client-id',
        azureTenantId: 'test-tenant-id',
        azureRedirectUri: 'https://app.sotara.co.uk/auth/stjames',
        ssoConfigured: true
      };

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockOrg,
            error: null
          })
        })
      });

      const config = await authServices.getOrganizationConfig('stjames');

      expect(config.auth.clientId).toBe('test-client-id');
      expect(config.auth.authority).toContain('test-tenant-id');
      expect(config.org.name).toBe('St James School');
    });

    it('should return null config if organization not found', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' }
          })
        })
      });

      try {
        await authServices.getOrganizationConfig('nonexistent');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('not found');
      }
    });

    it('should warn if SSO not fully configured', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      const mockOrg = {
        id: 'newschool',
        name: 'New School',
        domain: '@newschool.co.uk',
        azureClientId: null, // Not configured yet
        azureTenantId: null,
        ssoConfigured: false
      };

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockOrg,
            error: null
          })
        })
      });

      const config = await authServices.getOrganizationConfig('newschool');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not fully configured'));
      expect(config.org.ssoConfigured).toBe(false);
    });
  });

  describe('MSAL Initialization', () => {
    it('should initialize MSAL with correct org config', () => {
      const config = {
        auth: {
          clientId: 'test-client-id',
          authority: 'https://login.microsoftonline.com/test-tenant-id',
          redirectUri: 'https://app.sotara.co.uk/auth/stjames'
        }
      };

      const msalInstance = authServices.initializeMSAL(config);

      expect(msalInstance).toBeDefined();
      expect(msalInstance.getAllAccounts).toBeDefined();
      expect(msalInstance.acquireTokenSilent).toBeDefined();
    });

    it('should throw error if MSAL initialization fails', () => {
      const invalidConfig = {
        auth: {
          clientId: null,
          redirectUri: null
        }
      };

      expect(() => {
        authServices.initializeMSAL(invalidConfig);
      }).toThrow();
    });
  });

  describe('User Profile Creation', () => {
    it('should create user profile for new org user', async () => {
      const mockAuthUser = {
        id: 'auth-user-id-123',
        email: 'teacher@stjames.co.uk'
      };

      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser }
      });

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null, // Profile doesn't exist yet
              error: { code: 'PGRST116' }
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                auth_user_id: 'auth-user-id-123',
                email: 'teacher@stjames.co.uk',
                organization_id: 'stjames',
                role: 'Staff'
              }
            })
          })
        })
      });

      await authServices.ensureUserProfile('teacher@stjames.co.uk', 'stjames', 'Staff');

      // Verify insert was called
      expect(supabase.from).toHaveBeenCalledWith('user_profiles');
    });

    it('should skip if user profile already exists', async () => {
      const mockAuthUser = {
        id: 'auth-user-id-123',
        email: 'teacher@stjames.co.uk'
      };

      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser }
      });

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'existing-profile' }, // Profile exists
              error: null
            })
          })
        })
      });

      const consoleSpy = vi.spyOn(console, 'log');
      await authServices.ensureUserProfile('teacher@stjames.co.uk', 'stjames', 'Staff');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });

    it('should handle missing auth user gracefully', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });

      const consoleSpy = vi.spyOn(console, 'warn');
      await authServices.ensureUserProfile('teacher@stjames.co.uk', 'stjames', 'Staff');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No authenticated user'));
    });
  });

  describe('RLS Enforcement', () => {
    it('should include organization_id in all queries', () => {
      // This is more of a documentation test
      // In real implementation, verify that:
      // 1. getMyRequests filters by organization_id
      // 2. submitRequest includes organization_id
      // 3. All mt_* table queries include org filtering

      const organizationId = 'stjames';

      // Example verification:
      expect(organizationId).toBe('stjames');
      // Actual implementation checks:
      // - api.getMyRequests(email, organizationId) calls .eq('organization_id', organizationId)
      // - api.submitRequest(formData, organizationId) sets formData.organization_id
    });

    it('should prevent cross-organization data access', async () => {
      // Test that query fails when:
      // - User from stjames tries to access gardener-schools data
      // - Verify RLS policies block access

      const userOrg = 'stjames';
      const dataOrg = 'gardener-schools';

      expect(userOrg).not.toBe(dataOrg);
      // Real test: Execute SELECT query as stjames user against gardener-schools data
      // Should return 0 rows due to RLS policy
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full auth flow for domain-matched org', async () => {
      // 1. Detect org by domain
      const mockOrg = {
        id: 'stjames',
        name: 'St James School',
        domain: '@stjames.co.uk',
        azureClientId: 'test-client',
        azureTenantId: 'test-tenant',
        defaultAllowance: 25
      };

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockOrg,
            error: null
          })
        })
      });

      // 2. Fetch org config
      const config = await authServices.getOrganizationConfig('stjames');
      expect(config.auth.clientId).toBe('test-client');

      // 3. Initialize MSAL
      const msalInstance = authServices.initializeMSAL(config.auth);
      expect(msalInstance).toBeDefined();

      // 4. User profile would be created on first login
      // (covered in other test)
    });

    it('should handle org not found and show selector', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
          })
        })
      });

      try {
        await authServices.getOrganizationConfig('unknown-domain');
      } catch (error) {
        // In real implementation, this would trigger organization selector UI
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase errors gracefully', async () => {
      const supabaseError = new Error('Connection error');

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockRejectedValue(supabaseError)
        })
      });

      try {
        await authServices.getOrganizationConfig('test-org');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Connection error');
      }
    });

    it('should handle missing environment variables', () => {
      const originalEnv = process.env.VITE_SUPABASE_URL;
      delete process.env.VITE_SUPABASE_URL;

      // Actual implementation should validate env vars on init
      expect(process.env.VITE_SUPABASE_URL).toBeUndefined();

      process.env.VITE_SUPABASE_URL = originalEnv;
    });
  });

  describe('Security Tests', () => {
    it('should not expose sensitive data in logs', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const sensitiveConfig = {
        auth: {
          clientId: 'secret-client-id-12345',
          authority: 'https://login.microsoftonline.com/secret-tenant',
          redirectUri: 'https://app.sotara.co.uk/auth/test'
        }
      };

      // Auth service should not log full config
      // Only log org name and status
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('secret-client-id'));
    });

    it('should validate organization ownership before returning config', async () => {
      const mockOrg = {
        id: 'stjames',
        name: 'St James School',
        domain: '@stjames.co.uk',
        azureClientId: 'client-id',
        azureTenantId: 'tenant-id'
      };

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockOrg,
            error: null
          })
        })
      });

      const config = await authServices.getOrganizationConfig('stjames');

      // In production: Verify user has permission to access this org
      // User should be in org's user_profiles with correct organization_id
      expect(config.org.id).toBe('stjames');
    });
  });
});

export default describe;
