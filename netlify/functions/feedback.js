// Returns the user's in-app feedback notes (the `repo:feedback` key) as JSON.
// Read-only, server-side via the Supabase service_role key, guarded by the same
// secret token as the backup function (?key=...). Lets Claude fetch the notes on
// demand without any Supabase credentials on the client side.
const SUPABASE_URL = 'https://feixedobrnjvcnasaeyd.supabase.co';

exports.handler = async (event) => {
  const token = event && event.queryStringParameters && event.queryStringParameters.key;
  if (!token || token !== process.env.BACKUP_TRIGGER_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) { return { statusCode: 500, body: 'Missing service key' }; }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/store?select=key,value`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (!r.ok) { return { statusCode: 502, body: 'Supabase read failed: ' + (await r.text()) }; }
    const rows = await r.json();
    const row = rows.find(x => x.key === 'repo:feedback');
    let notes = [];
    if (row && row.value) { try { notes = JSON.parse(row.value); } catch (e) {} }
    // newest first, and split open vs. addressed for convenience
    notes.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const open = notes.filter(n => !n.done);
    const done = notes.filter(n => n.done);
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ count: notes.length, openCount: open.length, open, done }, null, 2)
    };
  } catch (e) {
    return { statusCode: 500, body: 'Error: ' + ((e && e.message) || e) };
  }
};
