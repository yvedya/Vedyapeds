// Weekly data backup: reads all of the user's data from Supabase (server-side,
// using the service_role key) and emails it as a JSON attachment via Resend.
// - Runs on a schedule once configured in netlify.toml.
// - Also HTTP-triggerable with a secret token (?key=...) for one-off testing.
// Photos live separately in Storage, so this backup stays small and email-friendly.
const SUPABASE_URL = 'https://feixedobrnjvcnasaeyd.supabase.co';

exports.handler = async (event) => {
  // Scheduled invocations carry a body with "next_run"; HTTP ones don't and need the token.
  const scheduled = !!(event && typeof event.body === 'string' && event.body.includes('next_run'));
  if (!scheduled) {
    const token = event && event.queryStringParameters && event.queryStringParameters.key;
    if (!token || token !== process.env.BACKUP_TRIGGER_SECRET) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.BACKUP_EMAIL;
  if (!serviceKey || !resendKey || !to) {
    return { statusCode: 500, body: 'Missing backup configuration (service key, resend key, or email).' };
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/store?select=key,value`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (!r.ok) { return { statusCode: 502, body: 'Supabase read failed: ' + (await r.text()) }; }
    const rows = await r.json();
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), data: rows }, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    const sizeKB = Math.round(json.length / 1024);

    const er = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'Vedyapeds Backup <onboarding@resend.dev>',
        to: [to],
        subject: `Vedyapeds backup — ${date}`,
        text: `Your automatic Vedyapeds backup is attached (${sizeKB} KB). Keep it somewhere safe. (Photos are stored separately and aren't in this file.)`,
        attachments: [{ filename: `vedyapeds-backup-${date}.json`, content: b64 }]
      })
    });
    if (!er.ok) { return { statusCode: 502, body: 'Email send failed: ' + (await er.text()) }; }
    return { statusCode: 200, body: 'Backup emailed to ' + to };
  } catch (e) {
    return { statusCode: 500, body: 'Error: ' + ((e && e.message) || e) };
  }
};
