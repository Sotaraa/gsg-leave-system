import React, { useState } from 'react';
import { Copy, Check, Calendar } from 'lucide-react';
import { getCalendarSubscriptionUrls } from '../services/calendarSync';

/**
 * Calendar Subscription Component
 *
 * Displays shareable calendar subscription links for:
 * - Outlook/Microsoft 365
 * - Google Calendar
 * - Apple Calendar
 * - Generic iCalendar (for any app)
 */
export default function CalendarSubscription({ organizationId, organizationName }) {
  const [copied, setCopied] = useState(null);
  const baseUrl = window.location.origin; // https://gsg-leave-system.vercel.app

  const urls = getCalendarSubscriptionUrls(baseUrl, organizationId);

  const copyToClipboard = (text, name) => {
    navigator.clipboard.writeText(text);
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  };

  const subscriptionOptions = [
    {
      name: 'Outlook / Microsoft 365',
      icon: '📧',
      url: urls.webcal,
      button: 'Add to Outlook',
      description: 'Automatic subscription in Outlook'
    },
    {
      name: 'Google Calendar',
      icon: '📅',
      url: urls.google,
      button: 'Add to Google',
      description: 'Opens Google Calendar import dialog'
    },
    {
      name: 'Apple Calendar / iCloud',
      icon: '🍎',
      url: urls.webcal,
      button: 'Add to Apple Calendar',
      description: 'Works with Calendar app and iCloud'
    },
    {
      name: 'Any Calendar App',
      icon: '📋',
      url: urls.ics,
      button: 'Download .ics file',
      description: 'Generic iCalendar format'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Subscribe to Calendar</h2>
      </div>

      <p className="text-gray-600 mb-8">
        Subscribe to {organizationName}'s school holiday and term dates calendar.
        <br />
        <span className="text-sm">Approved leave can be optionally included using: <code className="bg-gray-100 px-2 py-1 rounded text-xs">?include=leave</code></span>
      </p>

      <div className="grid gap-4 mb-8">
        {subscriptionOptions.map((option) => (
          <div
            key={option.name}
            className="border rounded-lg p-4 hover:bg-gray-50 transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{option.icon}</span>
                  <h3 className="font-semibold text-lg">{option.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">{option.description}</p>

                {/* Show URL for copy */}
                <div className="bg-gray-50 rounded p-2 mb-3 break-all text-xs font-mono text-gray-700 flex items-center justify-between">
                  <span className="flex-1">{option.url}</span>
                  <button
                    onClick={() => copyToClipboard(option.url, option.name)}
                    className="ml-2 p-1 hover:bg-gray-200 rounded"
                    title="Copy URL"
                  >
                    {copied === option.name ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              <a
                href={option.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition whitespace-nowrap font-medium"
              >
                {option.button}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">📌 What's Included:</h4>
        <ul className="text-sm text-blue-800 space-y-1 ml-4">
          <li>✅ School holidays and closures</li>
          <li>✅ Term start and end dates</li>
          <li>✅ Auto-updates every hour</li>
          <li>❓ Approved staff leave (optional, add <code className="bg-blue-100 px-1 rounded text-xs">?include=leave</code> to URL)</li>
        </ul>
      </div>

      {/* Share Link */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2">Share Calendar Link:</h4>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={urls.ics}
            className="flex-1 px-3 py-2 border rounded bg-white text-sm font-mono"
          />
          <button
            onClick={() => copyToClipboard(urls.ics, 'link')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition flex items-center gap-2"
          >
            {copied === 'link' ? (
              <>
                <Check className="w-4 h-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy Link
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
