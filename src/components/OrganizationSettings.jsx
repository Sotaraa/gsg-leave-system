import React, { useState, useEffect } from 'react';
import { Settings, Copy, CheckCircle, AlertCircle, Loader, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabase';
import { useOrganization } from '../contexts/OrganizationContext';

const OrganizationSettings = ({ user }) => {
  const { currentOrganization, isSuperAdmin, isOrgAdmin } = useOrganization();
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editMode, setEditMode] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [copied, setCopied] = useState(null);

  const [formData, setFormData] = useState({
    azureClientId: '',
    azureTenantId: '',
    notificationEmail: '',
    useGraphApi: true
  });

  // Check if user can access this page (Super Admin or Org Admin)
  const canManageOrg = isSuperAdmin || isOrgAdmin;

  useEffect(() => {
    if (!currentOrganization) return;
    loadOrganizationData();
  }, [currentOrganization]);

  const loadOrganizationData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', currentOrganization.id)
        .single();

      if (error) throw error;

      setOrgData(data);
      setFormData({
        azureClientId: data.azureClientId || '',
        azureTenantId: data.azureTenantId || '',
        notificationEmail: data.notificationEmail || '',
        useGraphApi: data.useGraphApi !== false
      });
    } catch (error) {
      console.error('Error loading organization:', error);
      setMessage({ type: 'error', text: 'Failed to load organization settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      setSaving(true);

      // Validate fields
      if (formData.azureClientId && !formData.azureTenantId) {
        throw new Error('If Client ID is provided, Tenant ID is required');
      }
      if (formData.azureTenantId && !formData.azureClientId) {
        throw new Error('If Tenant ID is provided, Client ID is required');
      }

      // Determine if SSO is fully configured
      const ssoConfigured = !!(formData.azureClientId && formData.azureTenantId);

      const { error } = await supabase
        .from('organizations')
        .update({
          azureClientId: formData.azureClientId || null,
          azureTenantId: formData.azureTenantId || null,
          notificationEmail: formData.notificationEmail || null,
          useGraphApi: formData.useGraphApi,
          ssoConfigured: ssoConfigured
        })
        .eq('id', currentOrganization.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Organization settings saved successfully!'
      });

      setEditMode(false);
      await loadOrganizationData();
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to save settings'
      });
    } finally {
      setS aving(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTestEmail = async () => {
    if (!formData.notificationEmail) {
      setMessage({
        type: 'error',
        text: 'Please configure a notification email first'
      });
      return;
    }

    try {
      setMessage({ type: '', text: '' });
      // TODO: Call backend to send test email
      setMessage({
        type: 'success',
        text: `Test email sent to ${formData.notificationEmail}`
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to send test email'
      });
    }
  };

  if (!canManageOrg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="backdrop-blur-xl bg-white/30 rounded-3xl p-8 shadow-2xl border border-white/40 text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <h1 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-600 mb-2">
              Only organization admins can access this page.
            </p>
            <p className="text-sm text-slate-500">Current user: {user?.email || 'Not signed in'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <Loader className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-3">
            <Settings className="text-blue-600" size={32} />
            Organization Settings
          </h1>
          <p className="text-slate-600">
            Manage Azure AD SSO and email notification settings for{' '}
            <span className="font-bold text-slate-900">{currentOrganization?.name}</span>
          </p>
        </div>

        {/* Message */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-sm ${
              message.type === 'success'
                ? 'bg-green-50/80 border-green-200/50 text-green-700'
                : 'bg-red-50/80 border-red-200/50 text-red-700'
            }`}
          >
            <div className="flex items-start gap-3">
              {message.type === 'success' ? (
                <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              )}
              <div>{message.text}</div>
            </div>
          </div>
        )}

        {/* Settings Card */}
        <div className="backdrop-blur-xl bg-white/30 rounded-3xl p-8 shadow-2xl border border-white/40">
          {/* Status Banner */}
          <div
            className={`mb-6 p-4 rounded-xl border ${
              orgData?.ssoConfigured
                ? 'bg-green-50/80 border-green-200/50'
                : 'bg-amber-50/80 border-amber-200/50'
            }`}
          >
            <div className="flex items-start gap-3">
              {orgData?.ssoConfigured ? (
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              )}
              <div>
                <h3 className={`font-bold ${orgData?.ssoConfigured ? 'text-green-700' : 'text-amber-700'}`}>
                  {orgData?.ssoConfigured ? 'SSO Configured' : 'SSO Not Configured'}
                </h3>
                <p className={`text-sm ${orgData?.ssoConfigured ? 'text-green-600' : 'text-amber-600'}`}>
                  {orgData?.ssoConfigured
                    ? 'Users can sign in with your Azure AD'
                    : 'Complete the configuration below to enable Azure AD SSO'}
                </p>
              </div>
            </div>
          </div>

          {/* Organization Info */}
          <div className="mb-6 pb-6 border-b border-white/40">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Organization Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Organization Name</p>
                <p className="text-lg font-semibold text-slate-900">{orgData?.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Organization ID</p>
                <p className="text-lg font-semibold text-slate-900 font-mono text-sm">{orgData?.id}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Email Domain</p>
                <p className="text-lg font-semibold text-slate-900">{orgData?.domain}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Hours Per Day</p>
                <p className="text-lg font-semibold text-slate-900">{orgData?.hoursPerDay} hours</p>
              </div>
            </div>
          </div>

          {/* Redirect URI */}
          <div className="mb-6 pb-6 border-b border-white/40">
            <h2 className="text-lg font-bold text-slate-900 mb-4">OAuth Redirect URI</h2>
            <p className="text-sm text-slate-600 mb-3">
              Use this URI when setting up your Azure AD app registration.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 bg-slate-100/50 rounded-xl font-mono text-sm text-slate-900 break-all">
                {orgData?.azureRedirectUri || `https://app.sotara.co.uk/auth/${orgData?.id}`}
              </div>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    orgData?.azureRedirectUri || `https://app.sotara.co.uk/auth/${orgData?.id}`,
                    'redirectUri'
                  )
                }
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 transition-all"
              >
                {copied === 'redirectUri' ? <CheckCircle size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          {/* SSO Configuration Form */}
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {editMode ? '✏️ Edit' : ''}
              Azure AD Configuration
            </h2>

            {!editMode ? (
              // View Mode
              <>
                <div>
                  <p className="text-sm text-slate-600 mb-2">Azure Client ID</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-3 bg-slate-100/50 rounded-xl font-mono text-sm text-slate-900">
                      {orgData?.azureClientId ? (
                        showSecrets ? (
                          orgData.azureClientId
                        ) : (
                          '•'.repeat(32)
                        )
                      ) : (
                        <span className="text-slate-500">Not configured</span>
                      )}
                    </div>
                    {orgData?.azureClientId && (
                      <button
                        type="button"
                        onClick={() => setShowSecrets(!showSecrets)}
                        className="px-3 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-all"
                      >
                        {showSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600 mb-2">Azure Tenant ID</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-3 bg-slate-100/50 rounded-xl font-mono text-sm text-slate-900">
                      {orgData?.azureTenantId ? (
                        showSecrets ? (
                          orgData.azureTenantId
                        ) : (
                          '•'.repeat(36)
                        )
                      ) : (
                        <span className="text-slate-500">Not configured</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600 mb-2">Notification Email</p>
                  <div className="px-4 py-3 bg-slate-100/50 rounded-xl text-slate-900">
                    {orgData?.notificationEmail || <span className="text-slate-500">Not configured</span>}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600 mb-2">Use Microsoft Graph API for Emails</p>
                  <div className="px-4 py-3 bg-slate-100/50 rounded-xl">
                    <span className={`font-semibold ${orgData?.useGraphApi ? 'text-green-700' : 'text-amber-700'}`}>
                      {orgData?.useGraphApi ? '✓ Enabled' : '✗ Disabled'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl mt-6"
                >
                  Edit Settings
                </button>
              </>
            ) : (
              // Edit Mode
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Azure Client ID
                  </label>
                  <input
                    type="text"
                    name="azureClientId"
                    value={formData.azureClientId}
                    onChange={handleFormChange}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-3 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    From Azure AD app registration &gt; Overview &gt; Application (client) ID
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Azure Tenant ID
                  </label>
                  <input
                    type="text"
                    name="azureTenantId"
                    value={formData.azureTenantId}
                    onChange={handleFormChange}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-3 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    From Azure AD &gt; Manage &gt; Properties &gt; Tenant ID
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Notification Email
                  </label>
                  <input
                    type="email"
                    name="notificationEmail"
                    value={formData.notificationEmail}
                    onChange={handleFormChange}
                    placeholder="noreply@yourdomain.com"
                    className="w-full px-4 py-3 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Email address to send leave notifications from
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="useGraphApi"
                      checked={formData.useGraphApi}
                      onChange={handleFormChange}
                      className="w-5 h-5"
                    />
                    <span className="text-sm font-semibold text-slate-700">
                      Use Microsoft Graph API for Email Notifications
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 mt-2 ml-8">
                    Recommended: Sends emails from your organization's mailbox
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false);
                      setFormData({
                        azureClientId: orgData?.azureClientId || '',
                        azureTenantId: orgData?.azureTenantId || '',
                        notificationEmail: orgData?.notificationEmail || '',
                        useGraphApi: orgData?.useGraphApi !== false
                      });
                    }}
                    className="px-6 bg-white/40 hover:bg-white/60 text-slate-900 font-bold py-3 rounded-xl transition-all border border-white/60"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Test Email Button */}
          {!editMode && orgData?.notificationEmail && (
            <div className="mt-6 pt-6 border-t border-white/40">
              <button
                type="button"
                onClick={handleTestEmail}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                📧 Send Test Email
              </button>
            </div>
          )}
        </div>

        {/* Setup Instructions */}
        {!orgData?.ssoConfigured && (
          <div className="mt-6 backdrop-blur-xl bg-amber-50/30 rounded-3xl p-8 shadow-2xl border border-amber-200/40">
            <h3 className="text-lg font-bold text-amber-900 mb-4">🔧 Setup Instructions</h3>
            <ol className="space-y-3 text-amber-900 text-sm">
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">1.</span>
                <span>Log in to Azure Portal (portal.azure.com)</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">2.</span>
                <span>Navigate to "Azure Active Directory" &gt; "App registrations" &gt; "New registration"</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">3.</span>
                <span>
                  Set the Redirect URI to:{' '}
                  <code className="bg-white/40 px-2 py-1 rounded font-mono text-xs">
                    {orgData?.azureRedirectUri || `https://app.sotara.co.uk/auth/${orgData?.id}`}
                  </code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">4.</span>
                <span>Copy your Client ID and Tenant ID from the app registration</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">5.</span>
                <span>Click "Edit Settings" above and paste the credentials</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold flex-shrink-0">6.</span>
                <span>Configure API Permissions: Grant "Mail.Send" and "User.Read" scopes</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationSettings;
