import React from 'react'
import ReactDOM from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { getMsalInstance, initializeMsal } from './services/entraAuth'
import App from './app.jsx'
import './index_mobile.css'

// Get MSAL instance (synchronous)
const msalInstance = getMsalInstance()

// Initialize MSAL after DOM is ready
if (msalInstance) {
  initializeMsal().catch(err => {
    console.error('Failed to initialize MSAL:', err)
    // Continue anyway - email login still works
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </React.StrictMode>,
)
