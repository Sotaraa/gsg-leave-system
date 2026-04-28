import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: 'df2ff508-580d-43b7-93ee-60d5863ce57c',
    authority: 'https://login.microsoftonline.com/9196dde2-b3f2-470e-bc68-ef2144cb2343',
    redirectUri: typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:5173',
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
