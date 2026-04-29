import React from 'react'
import ReactDOM from 'react-dom/client'
import { getMsalInstance, initializeMsal } from './services/entraAuth'
import App from './app.jsx'
import './index_mobile.css'

/**
 * Application startup sequence
 *
 * CRITICAL: We must call handleRedirectPromise() on every page load.
 * After Microsoft redirects the user back to our app (following login),
 * MSAL needs to process the auth code in the URL. If we don't call this,
 * the login appears to "not work" — the redirect happens but MSAL never
 * stores the account, so the user stays on the login screen.
 */
const startApp = async () => {
  const msalInstance = getMsalInstance()

  if (msalInstance) {
    // Step 1: Initialize MSAL (required before any MSAL operations)
    await initializeMsal().catch(err => {
      console.error('Failed to initialize MSAL:', err)
    })

    // Step 2: CRITICAL — Process the Microsoft redirect response
    // This runs on EVERY page load but only does something when:
    //   - The URL contains a Microsoft auth code (after loginRedirect completes)
    // On normal page loads it returns null and completes instantly.
    try {
      const response = await msalInstance.handleRedirectPromise()

      if (response && response.account) {
        // ✅ User just completed Microsoft authentication
        // Store their verified email and mark auth method as 'entra'
        const account = response.account
        console.log('✅ Microsoft authentication completed for:', account.username)
        localStorage.setItem('GSG_USER_EMAIL', account.username)
        localStorage.setItem('GSG_USER_NAME', account.name || '')
        localStorage.setItem('GSG_AUTH_METHOD', 'entra')
      }
    } catch (err) {
      console.error('Error processing Microsoft login redirect:', err)
      // Don't block the app — user can try logging in again
    }
  }

  // Step 3: Render the app (after auth state is resolved)
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

startApp()
