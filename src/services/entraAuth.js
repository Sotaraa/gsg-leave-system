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
      ? window.location.origin
      : 'http://localhost:5173',
    knownAuthorities: ['login.microsoftonline.com'], // Trusted authorities
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: () => {}, // Suppress verbose logging
    },
  },
};

const scopes = {
  loginRequest: {
    scopes: ['openid', 'profile', 'email'],
  },
};

let msalInstance = null;

export const getMsalInstance = () => {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
};

export const loginWithEntra = async () => {
  try {
    const instance = getMsalInstance();
    const response = await instance.loginPopup(scopes.loginRequest);
    return {
      success: true,
      user: {
        email: response.account.username || response.account.homeAccountId,
        name: response.account.name,
        account: response.account,
      },
    };
  } catch (error) {
    console.error('Entra login error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const logoutEntra = async () => {
  try {
    const instance = getMsalInstance();
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      await instance.logoutPopup({
        postLogoutRedirectUri: '/',
      });
    }
  } catch (error) {
    console.error('Entra logout error:', error);
  }
};

export const getEntraUser = () => {
  const instance = getMsalInstance();
  const accounts = instance.getAllAccounts();
  if (accounts.length > 0) {
    return {
      email: accounts[0].username || accounts[0].homeAccountId,
      name: accounts[0].name,
      account: accounts[0],
    };
  }
  return null;
};
