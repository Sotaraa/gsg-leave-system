import React, { useState } from 'react';
import { Lock, Plus, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';

const OnboardingAdmin = ({ user, onSuccess }) => {
  const [step, setStep] = useState('password'); // 'password' or 'form'
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formData, setFormData] = useState({
    organizationName: '',
    emailDomain: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    defaultAllowance: 25,
    hoursPerDay: 8,
    azureClientId: '',
    azureTenantId: '',
    notificationEmail: ''
  });
  const [showSSO, setShowSSO] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Check if user is the master admin
  const isMasterAdmin = user?.email?.toLowerCase() === 'info@sotara.co.uk';

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');

    const masterPassword = import.meta.env.VITE_MASTER_PASSWORD;

    if (password === masterPassword) {
      setStep('form');
      setPassword('');
    } else {
      setPasswordError('Invalid master password');
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value
    });
  };

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Validate form
      if (!formData.organizationName || !formData.emailDomain || !formData.adminEmail) {
        throw new Error('Please fill in all required fields');
      }

      // Normalize domain (add @ if missing)
      const domain = formData.emailDomain.startsWith('@')
        ? formData.emailDomain
        : '@' + formData.emailDomain;

      // Generate org ID from domain (remove @, lowercase)
      const orgId = domain.substring(1).toLowerCase().replace(/\./g, '-');

      console.log(`📝 Creating organization: ${formData.organizationName} (${orgId})`);

      // Insert organization record with SSO config
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          id: orgId,
          name: formData.organizationName,
          domain: domain,
          superAdmin: formData.adminEmail,
          isActive: true,
          defaultAllowance: formData.defaultAllowance,
          hoursPerDay: formData.hoursPerDay,
          azureClientId: formData.azureClientId || null,
          azureTenantId: formData.azureTenantId || null,
          azureRedirectUri: `https://app.sotara.co.uk/auth/${orgId}`,
          notificationEmail: formData.notificationEmail || formData.adminEmail,
          useGraphApi: true,
          ssoConfigured: !!(formData.azureClientId && formData.azureTenantId)
        })
        .select();

      if (error) throw error;

      console.log(`✅ Organization created: ${orgId}`);

      setMessage({
        type: 'success',
        text: `Organization "${formData.organizationName}" created successfully!

The admin can now sign in with: ${formData.adminEmail}

Organization ID: ${orgId}
Domain: ${domain}`
      });

      // Reset form
      setFormData({
        organizationName: '',
        emailDomain: '',
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
        defaultAllowance: 25,
        hoursPerDay: 8,
        azureClientId: '',
        azureTenantId: '',
        notificationEmail: ''
      });
      setShowSSO(false);

      // Call callback if provided
      if (onSuccess) onSuccess(data[0]);
    } catch (error) {
      console.error('Error creating organization:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to create organization'
      });
    } finally {
      setLoading(false);
    }
  };

  // If not master admin, show access denied
  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="backdrop-blur-xl bg-white/30 rounded-3xl p-8 shadow-2xl border border-white/40 text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <h1 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-600 mb-6">Only info@sotara.co.uk can access this page.</p>
            <p className="text-sm text-slate-500">Current user: {user?.email || 'Not signed in'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
            <Lock className="text-blue-600" size={24} />
            Organization Onboarding
          </h1>
          <p className="text-xs text-slate-600">Create new schools/organizations for Sotara LeaveHub</p>
        </div>

        {/* Password Step */}
        {step === 'password' && (
          <div className="backdrop-blur-xl bg-white/30 rounded-3xl p-5 shadow-2xl border border-white/40">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Master Password Required</h2>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Master Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password"
                  className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 placeholder-slate-500"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-red-600 text-sm mt-2">{passwordError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Verify & Continue
              </button>
            </form>
          </div>
        )}

        {/* Organization Creation Form */}
        {step === 'form' && (
          <div className="backdrop-blur-xl bg-white/30 rounded-3xl p-5 shadow-2xl border border-white/40">
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              Create New Organization
            </h2>

            {message.text && (
              <div
                className={`mb-3 p-3 rounded-xl border text-sm ${
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
                  <div className="whitespace-pre-wrap text-sm">{message.text}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateOrganization} className="space-y-3">
              {/* Organization Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  name="organizationName"
                  value={formData.organizationName}
                  onChange={handleFormChange}
                  placeholder="e.g., St. James School"
                  className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
                  required
                />
              </div>

              {/* Email Domain */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Email Domain *
                </label>
                <input
                  type="text"
                  name="emailDomain"
                  value={formData.emailDomain}
                  onChange={handleFormChange}
                  placeholder="e.g., @stjames.co.uk or stjames.co.uk"
                  className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
                  required
                />
                <p className="text-xs text-slate-500 mt-0.5">Users with this domain auto-assign to this organization</p>
              </div>

              {/* Admin Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Admin First Name
                  </label>
                  <input
                    type="text"
                    name="adminFirstName"
                    value={formData.adminFirstName}
                    onChange={handleFormChange}
                    placeholder="e.g., John"
                    className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Admin Last Name
                  </label>
                  <input
                    type="text"
                    name="adminLastName"
                    value={formData.adminLastName}
                    onChange={handleFormChange}
                    placeholder="e.g., Smith"
                    className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Admin Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Admin Email *
                </label>
                <input
                  type="email"
                  name="adminEmail"
                  value={formData.adminEmail}
                  onChange={handleFormChange}
                  placeholder="e.g., john.smith@stjames.co.uk"
                  className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
                  required
                />
                <p className="text-xs text-slate-500 mt-0.5">This admin can sign in and manage the organization</p>
              </div>

              {/* Settings */}
              <div className="border-t border-white/40 pt-3">
                <h3 className="text-sm font-bold text-slate-700 mb-2">Default Settings</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Leave Allowance (days)
                    </label>
                    <input
                      type="number"
                      name="defaultAllowance"
                      value={formData.defaultAllowance}
                      onChange={handleFormChange}
                      min="0"
                      className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Hours Per Day
                    </label>
                    <input
                      type="number"
                      name="hoursPerDay"
                      value={formData.hoursPerDay}
                      onChange={handleFormChange}
                      min="1"
                      className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </div>

              </div>

              {/* Azure AD SSO Configuration (Optional) */}
              <div className="border-t border-white/40 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSSO(!showSSO)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-1"
                >
                  {showSSO ? '▼' : '▶'} Configure Azure AD SSO (Optional)
                </button>

                {showSSO && (
                  <div className="space-y-3 bg-blue-50/30 p-3 rounded-lg border border-blue-200/30">
                    <p className="text-xs text-slate-600 mb-2">
                      Leave blank for now. Can be configured later in Organization Settings.
                    </p>

                    {/* Azure Client ID */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Azure Client ID
                      </label>
                      <input
                        type="text"
                        name="azureClientId"
                        value={formData.azureClientId}
                        onChange={handleFormChange}
                        placeholder="e.g., xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 text-xs"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">From Azure AD app registration</p>
                    </div>

                    {/* Azure Tenant ID */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Azure Tenant ID
                      </label>
                      <input
                        type="text"
                        name="azureTenantId"
                        value={formData.azureTenantId}
                        onChange={handleFormChange}
                        placeholder="e.g., xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 text-xs"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">School's Azure AD directory ID</p>
                    </div>

                    {/* Notification Email */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Notification Email
                      </label>
                      <input
                        type="email"
                        name="notificationEmail"
                        value={formData.notificationEmail}
                        onChange={handleFormChange}
                        placeholder="e.g., noreply@stjames.co.uk"
                        className="w-full px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500 text-xs"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Email to send notifications from (defaults to admin email)</p>
                    </div>

                    <div className="bg-blue-100/40 border border-blue-200/50 p-2 rounded text-xs text-blue-800">
                      <strong>Setup Instructions:</strong> After organization creation, the school admin can add these details in Organization Settings.
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-2 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Organization'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="px-6 bg-white/40 hover:bg-white/60 text-slate-900 font-bold py-2 rounded-xl transition-all border border-white/60"
                >
                  Back
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingAdmin;
