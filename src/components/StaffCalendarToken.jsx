import React, { useState } from 'react';
import { Copy, RefreshCw, Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';
import { generateToken, maskToken, getStaffCalendarUrls } from '../utils/tokenUtils.js';

const StaffCalendarToken = ({ organizationId, organizationName, supabase, user }) => {
  const [token, setToken] = useState(null);
  const [tokenEnabled, setTokenEnabled] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Fetch current token on mount
  React.useEffect(() => {
    fetchToken();
  }, [organizationId]);

  const fetchToken = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('organizations')
        .select('calendar_access_token, calendar_token_enabled')
        .eq('id', organizationId)
        .single();

      if (err) throw err;

      setToken(data.calendar_access_token);
      setTokenEnabled(data.calendar_token_enabled ?? true);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching token:', err);
    } finally {
      setLoading(false);
    }
  };

  const regenerateToken = async () => {
    if (!window.confirm('This will invalidate the old token. Staff will need the new URL to subscribe. Continue?')) {
      return;
    }

    try {
      setRegenerating(true);
      setError(null);

      const newToken = generateToken();

      const { data, error: err } = await supabase
        .from('organizations')
        .update({
          calendar_access_token: newToken,
          calendar_token_created_at: new Date().toISOString()
        })
        .eq('id', organizationId)
        .select('calendar_access_token');

      if (err) {
        console.error('Database update error:', err);
        throw err;
      }

      console.log('✅ Token saved to database:', newToken.substring(0, 8) + '...');
      setToken(newToken);
    } catch (err) {
      console.error('Token generation failed:', err);
      setError(`Failed to save token: ${err.message}`);
    } finally {
      setRegenerating(false);
    }
  };

  const toggleTokenEnabled = async () => {
    try {
      const { error: err } = await supabase
        .from('organizations')
        .update({ calendar_token_enabled: !tokenEnabled })
        .eq('id', organizationId);

      if (err) throw err;

      setTokenEnabled(!tokenEnabled);
      setError(null);
    } catch (err) {
      setError(`Failed to update token: ${err.message}`);
    }
  };

  const copyToClipboard = (text, type = 'URL') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin"></div>
          Loading token...
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="card p-6 bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900">No Token Generated</h4>
            <p className="text-sm text-amber-800 mt-1">
              Click "Generate Initial Token" below to create an access token for staff calendar subscriptions.
            </p>
          </div>
        </div>
        <button
          onClick={regenerateToken}
          disabled={regenerating}
          className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-amber-400 font-medium text-sm flex items-center gap-2"
        >
          {regenerating ? (
            <>
              <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              Generating...
            </>
          ) : (
            'Generate Initial Token'
          )}
        </button>
      </div>
    );
  }

  const urls = getStaffCalendarUrls(organizationId, token, baseUrl);

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Token Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Lock size={20} className="text-indigo-600" />
            Staff Calendar Access Token
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTokenEnabled}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tokenEnabled
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tokenEnabled ? '✓ Active' : '✗ Disabled'}
            </button>
          </div>
        </div>

        {/* Token Display */}
        <div className="space-y-3">
          <div className="p-4 bg-slate-100 rounded-lg flex items-center justify-between">
            <code className="text-sm font-mono text-slate-700">
              {showToken ? token : maskToken(token)}
            </code>
            <div className="flex gap-2">
              <button
                onClick={() => setShowToken(!showToken)}
                className="p-2 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                title={showToken ? 'Hide' : 'Show'}
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                onClick={() => copyToClipboard(token, 'Token')}
                className="p-2 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                title="Copy token"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            {tokenEnabled ? (
              <span className="text-emerald-600">✓ Token is active and can be used to subscribe to the staff calendar</span>
            ) : (
              <span className="text-red-600">✗ Token is disabled. Staff cannot subscribe until re-enabled.</span>
            )}
          </div>
        </div>

        {/* Regenerate Button */}
        <button
          onClick={regenerateToken}
          disabled={regenerating}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 font-medium text-sm flex items-center gap-2 transition-colors"
        >
          <RefreshCw size={16} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? 'Regenerating...' : 'Regenerate Token'}
        </button>
      </div>

      {/* Calendar Subscription URLs */}
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">📅 Share with Staff</h3>

        <div className="space-y-3">
          {/* Outlook */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-2">🔗 Microsoft Outlook</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urls.webcal}
                readOnly
                className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded text-xs font-mono text-blue-700 truncate"
              />
              <button
                onClick={() => copyToClipboard(urls.webcal, 'Outlook URL')}
                className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title="Copy Outlook URL"
              >
                <Copy size={16} />
              </button>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              Paste in Outlook: File → Open & Export → Import iCalendar
            </p>
          </div>

          {/* Google Calendar */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-900 mb-2">🔗 Google Calendar</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urls.google}
                readOnly
                className="flex-1 px-3 py-2 bg-white border border-red-200 rounded text-xs font-mono text-red-700 truncate"
              />
              <button
                onClick={() => copyToClipboard(urls.google, 'Google URL')}
                className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                title="Copy Google Calendar URL"
              >
                <Copy size={16} />
              </button>
            </div>
            <p className="text-xs text-red-700 mt-2">
              Click to open Google Calendar and add the subscription
            </p>
          </div>

          {/* Apple Calendar */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm font-semibold text-gray-900 mb-2">🔗 Apple Calendar</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urls.webcal}
                readOnly
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded text-xs font-mono text-gray-700 truncate"
              />
              <button
                onClick={() => copyToClipboard(urls.webcal, 'Apple URL')}
                className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                title="Copy Apple Calendar URL"
              >
                <Copy size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-700 mt-2">
              Paste in Apple Calendar: File → New Calendar Subscription
            </p>
          </div>
        </div>

        {/* Status */}
        {copied && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-emerald-700">✓ {copied} copied to clipboard</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="card p-4 bg-slate-50 border border-slate-200">
        <h4 className="font-semibold text-slate-900 mb-2 text-sm">ℹ️ What's Included</h4>
        <ul className="text-xs text-slate-700 space-y-1">
          <li>✓ School holidays and term dates</li>
          <li>✓ Staff annual leave, school holiday worked, and other approved leave</li>
          <li>✗ Excludes: Sick leave, medical appointments, compassionate leave (private)</li>
          <li>✓ Auto-refreshes hourly in calendar applications</li>
          <li>✓ Secured with access token</li>
        </ul>
      </div>
    </div>
  );
};

export default StaffCalendarToken;
