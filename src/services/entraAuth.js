import { PublicClientApplication } from '@azure/msal-browser';

/**
 * MULTI-TENANT AZURE AD CONFIGURATION
 *
 * This app is configured as a multi-tenant application, allowing users from any
 * Azure AD organization to sign in with their corporate credentials.
 *
 * Configuration Details:
 * - Client ID: 2beb6b60-ecff-4467-bd64-92757a67b369 (Sotara account)
 * - Authority: https://login.microsoftonline.com/common (multi-tenant)
 * - Tenant ID: deef90b7-a94c-4dd3-92a1-5d8055068d6b (Sotara's home tenant)
 *
 * Users can sign in from:
 * ✓ Sotara's Azure AD (deef90b7-a94c-4dd3-92a1-5d8055068d6b)
 * ✓ Any other organization's Azure AD (multi-tenant)
 * ✓ Microsoft personal accounts (if configured)
 */

const msalConfig = {
  auth: {
    clientId: '2beb6b60-ecff-4467-bd64-92757a67b369', // Multi-tenant app ID
    authority: 'https://login.microsoftonline.com/common', // Multi-tenant authority
    redirectUri: typeof window !== 'undefined'
      ? window.location.origin + '/'
      : 'http://localhost:5173/',
    knownAuthorities: ['login.microsoftonline.com'], // Trusted authorities
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    allowNativeBroker: false,
    loggerOptions: {
      loggerCallback: () => {}, // Suppress verbose logging
    },
  },
};

const scopes = {
  loginRequest: {
    scopes: ['openid', 'profile', 'email', 'User.Read', 'Mail.Send'],
    prompt: 'select_account', // Force organization/account selection for multi-tenant
  },
};

let msalInstance = null;

// Create and initialize MSAL instance synchronously
export const getMsalInstance = () => {
  if (!msalInstance) {
    console.log('🔄 Creating MSAL instance...');
    try {
      msalInstance = new PublicClientApplication(msalConfig);
      console.log('✅ MSAL instance created successfully');
    } catch (err) {
      console.error('❌ Failed to create MSAL instance:', err);
    }
  }
  return msalInstance;
};

// Initialize MSAL when the DOM is ready
export const initializeMsal = async () => {
  if (!msalInstance) {
    getMsalInstance();
  }

  if (msalInstance) {
    try {
      console.log('🔄 Running MSAL initialization...');
      await msalInstance.initialize();
      console.log('✅ MSAL initialized successfully');
    } catch (err) {
      console.error('❌ MSAL initialization failed:', err);
    }
  }
};

export const loginWithEntra = async () => {
  try {
    console.log('🔵 Starting Entra login flow...');
    const instance = getMsalInstance();

    if (!instance) {
      throw new Error('MSAL instance not available');
    }

    console.log('📱 Triggering login redirect...');
    // Use redirect instead of popup to avoid nested popup blocking
    await instance.loginRedirect(scopes.loginRequest);

    // If we get here, the redirect is happening - return success
    // User will be redirected to Microsoft login, then back to app
    return {
      success: true,
      user: null, // Will be set after redirect returns
    };
  } catch (error) {
    console.error('❌ Entra login error:', error);
    return {
      success: false,
      error: error.errorCode || error.message || 'Unknown error',
    };
  }
};

export const logoutEntra = async () => {
  try {
    const instance = getMsalInstance();
    if (!instance) return;

    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      // Use redirect for logout too (more reliable than popup)
      await instance.logoutRedirect({
        postLogoutRedirectUri: '/',
      });
    }
  } catch (error) {
    console.error('Entra logout error:', error);
  }
};

export const getEntraUser = () => {
  try {
    const instance = getMsalInstance();
    if (!instance) return null;

    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      return {
        email: accounts[0].username || accounts[0].homeAccountId,
        name: accounts[0].name,
        account: accounts[0],
      };
    }
  } catch (error) {
    console.error('Error getting Entra user:', error);
  }
  return null;
};
