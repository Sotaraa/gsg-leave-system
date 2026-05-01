/**
 * Calendar Sync Status Component
 * Displays holiday calendar sync status and provides management controls
 * Visible to admins and super admins
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import '../styles/calendar-sync.css';

export default function CalendarSyncStatus({ user, organizationId }) {
  const [syncStatus, setSyncStatus] = useState(null);
  const [recentSyncs, setRecentSyncs] = useState([]);
  const [holidayStats, setHolidayStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [orgConfig, setOrgConfig] = useState(null);

  // Fetch organization config and sync status
  useEffect(() => {
    loadSyncData();
    // Refresh every 30 seconds
    const interval = setInterval(loadSyncData, 30000);
    return () => clearInterval(interval);
  }, [organizationId]);

  async function loadSyncData() {
    try {
      setLoading(true);

      // Get organization config
      const { data: org } = await supabase
        .from('organizations')
        .select(
          'id, name, notificationemail, ssoconfigured, azureClientId, azureTenantId'
        )
        .eq('id', organizationId)
        .single();

      setOrgConfig(org);

      // Get holiday sync status
      const { data: holidays } = await supabase
        .from('mt_termdates')
        .select('calendar_sync_status')
        .eq('organization_id', organizationId)
        .neq('type', 'Bank Holiday');

      if (holidays) {
        const synced = holidays.filter((h) => h.calendar_sync_status === 'synced')
          .length;
        const pending = holidays.filter(
          (h) =>
            h.calendar_sync_status === 'pending' ||
            h.calendar_sync_status === null
        ).length;
        const errors = holidays.filter(
          (h) => h.calendar_sync_status === 'error'
        ).length;

        setHolidayStats({
          total: holidays.length,
          synced,
          pending,
          errors,
        });
      }

      // Get recent sync logs
      const { data: logs } = await supabase
        .from('calendar_sync_log')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentSyncs(logs || []);

      // Determine overall status
      if (org && org.ssoconfigured && org.azureClientId && org.azureTenantId) {
        setSyncStatus('ready');
      } else if (org && !org.ssoconfigured) {
        setSyncStatus('sso-not-configured');
      } else if (org && !org.azureClientId) {
        setSyncStatus('credentials-incomplete');
      } else {
        setSyncStatus('unknown');
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading sync status:', err);
      setSyncStatus('error');
      setLoading(false);
    }
  }

  async function triggerManualSync() {
    if (!user.azureToken) {
      alert(
        'Azure token not available. Please re-authenticate and try again.'
      );
      return;
    }

    setSyncing(true);

    try {
      // Call API to manually trigger sync for this organization
      const response = await fetch('/api/sync-holidays-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: organizationId,
          azureToken: user.azureToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Manual sync request failed');
      }

      const result = await response.json();

      // Refresh sync data
      await loadSyncData();

      alert(
        `Sync completed! ${result.holidaysSynced || 0} holidays synced.`
      );
    } catch (err) {
      console.error('Manual sync error:', err);
      alert(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'ready':
        return '#4caf50';
      case 'sso-not-configured':
      case 'credentials-incomplete':
        return '#ff9800';
      case 'error':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  }

  function getStatusMessage(status) {
    switch (status) {
      case 'ready':
        return '✅ Calendar sync configured and ready';
      case 'sso-not-configured':
        return '⚠️ SSO not configured. Enable SSO to enable calendar sync.';
      case 'credentials-incomplete':
        return '⚠️ Azure AD credentials incomplete. Configure in organization settings.';
      case 'error':
        return '❌ Error loading sync status';
      default:
        return '⏳ Loading...';
    }
  }

  if (loading) {
    return (
      <div className="sync-status-card loading">
        <p>Loading calendar sync status...</p>
      </div>
    );
  }

  return (
    <div className="sync-status-container">
      {/* Header */}
      <div className="sync-status-card">
        <div className="sync-header">
          <h3>📅 Holiday Calendar Sync</h3>
          <div
            className="sync-indicator"
            style={{ backgroundColor: getStatusColor(syncStatus) }}
          ></div>
        </div>

        <p className="sync-status-message">{getStatusMessage(syncStatus)}</p>

        {/* Organization Details */}
        {orgConfig && (
          <div className="org-details">
            <div className="detail-row">
              <span className="label">Organization:</span>
              <span className="value">{orgConfig.name}</span>
            </div>
            <div className="detail-row">
              <span className="label">Notification Email:</span>
              <span className="value">{orgConfig.notificationemail || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="label">SSO Configured:</span>
              <span className="value">
                {orgConfig.ssoconfigured ? '✅ Yes' : '❌ No'}
              </span>
            </div>
          </div>
        )}

        {/* Holiday Stats */}
        {holidayStats && (
          <div className="holiday-stats">
            <div className="stat-box">
              <div className="stat-number">{holidayStats.total}</div>
              <div className="stat-label">Total Holidays</div>
            </div>
            <div className="stat-box synced">
              <div className="stat-number">{holidayStats.synced}</div>
              <div className="stat-label">Synced</div>
            </div>
            <div className="stat-box pending">
              <div className="stat-number">{holidayStats.pending}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-box error">
              <div className="stat-number">{holidayStats.errors}</div>
              <div className="stat-label">Errors</div>
            </div>
          </div>
        )}

        {/* Actions */}
        {syncStatus === 'ready' && (
          <div className="sync-actions">
            <button
              className="sync-button"
              onClick={triggerManualSync}
              disabled={syncing}
            >
              {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
            </button>
            <p className="sync-note">
              Holidays sync automatically daily at 2:00 AM UTC.
              <br />
              Click "Sync Now" for immediate sync.
            </p>
          </div>
        )}

        {syncStatus !== 'ready' && (
          <div className="sync-warning">
            <p>
              ⚠️ Configure Azure AD credentials in organization settings to
              enable automatic calendar sync.
            </p>
          </div>
        )}
      </div>

      {/* Recent Syncs */}
      {recentSyncs.length > 0 && (
        <div className="sync-status-card">
          <h4>Recent Sync Activity</h4>
          <div className="sync-log">
            {recentSyncs.map((log) => (
              <div key={log.id} className="sync-log-entry">
                <div className="log-time">
                  {new Date(log.created_at).toLocaleString()}
                </div>
                <div className="log-details">
                  <span className="log-type">{log.sync_type}</span>
                  <span className="log-result">
                    {log.holidays_synced} synced
                    {log.errors && ` • ${log.errors}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help & Documentation */}
      <div className="sync-status-card info">
        <h4>📚 Need Help?</h4>
        <ul>
          <li>
            <a
              href="/docs/CALENDAR_SYNC_SETUP.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Calendar Sync Setup Guide
            </a>
          </li>
          <li>
            <a href="https://graph.microsoft.com" target="_blank">
              Microsoft Graph Documentation
            </a>
          </li>
          <li>Contact support if sync fails repeatedly</li>
        </ul>
      </div>
    </div>
  );
}
