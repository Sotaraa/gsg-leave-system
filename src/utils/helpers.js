import CONFIG from '../config.js';
 
// The live URL for your GSG HR Portal
const PORTAL_URL = "https://gray-beach-036360010.1.azurestaticapps.net";
 
export const generateUKBankHolidays = (year) => {
  const hols = [
    { date: `${year}-01-01`, description: "New Year's Day", type: "Bank Holiday" },
    { date: `${year}-12-25`, description: "Christmas Day", type: "Bank Holiday" },
    { date: `${year}-12-26`, description: "Boxing Day", type: "Bank Holiday" }
  ];
  if (year === 2025) hols.push(
    { date: "2025-04-18", description: "Good Friday", type: "Bank Holiday" },
    { date: "2025-04-21", description: "Easter Monday", type: "Bank Holiday" },
    { date: "2025-05-05", description: "Early May Bank Holiday", type: "Bank Holiday" },
    { date: "2025-05-26", description: "Spring Bank Holiday", type: "Bank Holiday" },
    { date: "2025-08-25", description: "Summer Bank Holiday", type: "Bank Holiday" }
  );
  if (year === 2026) hols.push(
    { date: "2026-04-03", description: "Good Friday", type: "Bank Holiday" },
    { date: "2026-04-06", description: "Easter Monday", type: "Bank Holiday" },
    { date: "2026-05-04", description: "Early May Bank Holiday", type: "Bank Holiday" },
    { date: "2026-05-25", description: "Spring Bank Holiday", type: "Bank Holiday" },
    { date: "2026-08-31", description: "Summer Bank Holiday", type: "Bank Holiday" }
  );
  if (year === 2027) hols.push(
    { date: "2027-03-26", description: "Good Friday", type: "Bank Holiday" },
    { date: "2027-03-29", description: "Easter Monday", type: "Bank Holiday" },
    { date: "2027-05-03", description: "Early May Bank Holiday", type: "Bank Holiday" },
    { date: "2027-05-31", description: "Spring Bank Holiday", type: "Bank Holiday" },
    { date: "2027-08-30", description: "Summer Bank Holiday", type: "Bank Holiday" },
    { date: "2027-12-27", description: "Christmas Day", type: "Bank Holiday" },
    { date: "2027-12-28", description: "Boxing Day", type: "Bank Holiday" }
  );
  return hols;
};
 
export const formatDateUK = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '';
 
export const getShortLeaveType = (type) => {
  if (type === CONFIG.termTimeWorkType) return "Work (+)";
  if (type === 'Annual Leave') return "Annual";
  return type.split(' ')[0];
};
 
export const calculateWorkingDays = (startDate, endDate, isHalfDay, termDates) => {
  if (!startDate) return 0;

  // Parse date strings as UTC noon to avoid DST clock-change boundary issues.
  // e.g. UK clocks go back on 26 Oct — iterating via local midnight causes a
  // 1-hour drift that makes the end-date comparison fail, dropping the last day.
  const toUTCNoon = (str) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  };
  const toDateStr = (d) => {
    const y  = d.getUTCFullYear();
    const m  = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const start = toUTCNoon(startDate);
  const end   = toUTCNoon(endDate || startDate);
  const currentYear = new Date().getFullYear();
  const staticHols = [...generateUKBankHolidays(currentYear), ...generateUKBankHolidays(currentYear + 1)];
  const allDates = [...staticHols.map(h => h.date), ...termDates.filter(t => t.type === 'Bank Holiday').map(t => t.date)];
  const bankHolidaySet = new Set(allDates);

  if (isHalfDay) {
    const day = start.getUTCDay();
    if (day === 0 || day === 6 || bankHolidaySet.has(startDate)) return 0;
    return 0.5;
  }

  let count = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day     = d.getUTCDay();
    const dateStr = toDateStr(d);
    if (day !== 0 && day !== 6 && !bankHolidaySet.has(dateStr)) count++;
  }
  return count;
};
 
const buildEmailHTML = (title, color, rows, footerNote) => `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
 
  <!-- Outer wrapper -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
 
        <!-- Email card -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
 
          <!-- Header -->
          <tr>
            <td style="background-color:${color};padding:28px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <p style="margin:0 0 6px 0;color:rgba(255,255,255,0.85);font-size:11px;text-transform:uppercase;letter-spacing:2px;">Gardener Schools Group</p>
                    <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">${title}</p>
                  </td>
                  <td align="right" valign="middle" width="60">
                    <p style="margin:0;font-size:28px;line-height:1;">🎓</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
 
          <!-- Details table -->
          <tr>
            <td style="padding:28px 32px 20px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                ${rows.map((row, i) => {
                  if (row.isSection) {
                    return `<tr><td colspan="2" style="padding:10px 14px 7px 14px;background-color:#ecfdf5;border-top:2px solid #6ee7b7;border-bottom:1px solid #a7f3d0;"><p style="margin:0;color:#065f46;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${row.label}</p></td></tr>`;
                  }
                  const bg = row.highlight === 'red' ? '#fef2f2' : row.highlight === 'amber' ? '#fffbeb' : (i % 2 === 0 ? '#f9fafb' : '#ffffff');
                  const valCol = row.highlight === 'red' ? '#991b1b' : row.highlight === 'amber' ? '#78350f' : '#111827';
                  const bold   = row.highlight || row.bold ? 'bold' : 'normal';
                  return `<tr style="background-color:${bg};">
                    <td style="padding:11px 14px;color:#6b7280;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;width:38%;border-bottom:1px solid #f0f0f0;">${row.label}</td>
                    <td style="padding:11px 14px;color:${valCol};font-size:14px;font-weight:${bold};border-bottom:1px solid #f0f0f0;">${row.value}</td>
                  </tr>`;
                }).join('')}
              </table>
            </td>
          </tr>
 
          <!-- Footer note -->
          <tr>
            <td style="padding:0 32px 20px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;padding:12px 16px;">
                    <p style="margin:0;color:#065f46;font-size:13px;text-align:center;">${footerNote}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
 
          <!-- CTA Button — Outlook-safe bulletproof button -->
          <tr>
            <td align="center" style="padding:0 32px 28px 32px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" bgcolor="${color}" style="padding:0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                      href="${PORTAL_URL}"
                      style="height:44px;v-text-anchor:middle;width:220px;"
                      arcsize="14%"
                      stroke="f"
                      fillcolor="${color}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">Open GSG HR Portal</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${PORTAL_URL}"
                       target="_blank"
                       style="background-color:${color};border:2px solid ${color};border-radius:6px;color:#ffffff;display:inline-block;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;line-height:1;padding:13px 28px;text-decoration:none;text-align:center;">
                      &#128279; Open GSG HR Portal
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
              <!-- Plain text fallback link -->
              <p style="margin:10px 0 0 0;font-size:11px;color:#9ca3af;text-align:center;">
                Or copy this link: <a href="${PORTAL_URL}" style="color:#6b7280;">${PORTAL_URL}</a>
              </p>
            </td>
          </tr>
 
          <!-- Footer bar -->
          <tr>
            <td style="background-color:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">GSG HR Portal &bull; Automated Notification &bull; Do not reply to this email</p>
            </td>
          </tr>
 
        </table>
        <!-- End email card -->
 
      </td>
    </tr>
  </table>
 
</body>
</html>`;
 
export const sendEmail = async (graphToken, toEmails, subject, title, color, rows, footerNote) => {
  if (!graphToken || !toEmails || toEmails.length === 0) return;
  const uniqueEmails = [...new Set(toEmails.filter(Boolean))];
  if (uniqueEmails.length === 0) return;
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${graphToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: buildEmailHTML(title, color, rows, footerNote)
          },
          toRecipients: uniqueEmails.map(email => ({
            emailAddress: { address: email }
          }))
        }
      })
    });
 
    if (response.status === 401) {
      alert("⚠️ Your email session has expired.\n\nThe action was saved, but the email notification failed to send. Please refresh the page and log in again so future emails will send.");
      console.error("Graph API Token Expired (401)");
      return;
    }
 
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error sending email via Graph API:", errorData);
    }
  } catch (err) {
    console.error('Email send failed:', err);
  }
};
