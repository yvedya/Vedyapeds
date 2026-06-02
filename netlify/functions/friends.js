// Public, read-only data for the "Friend update" page (friends.html).
// Returns ONLY what the user explicitly published (repo:friendshare), and only
// when the secret share token in the link matches. Photos are signed server-side.
const SUPABASE_URL = 'https://feixedobrnjvcnasaeyd.supabase.co';

const json = (obj, status = 200) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  const s = event && event.queryStringParameters && event.queryStringParameters.s;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return json({ error: 'config' }, 500);
  if (!s) return json({ error: 'inactive' }, 403);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/store?select=key,value`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (!r.ok) return json({ error: 'read' }, 502);
    const rows = await r.json();
    const row = rows.find(x => x.key === 'repo:friendshare');
    let fs = null;
    if (row && row.value) { try { fs = JSON.parse(row.value); } catch (e) {} }
    if (!fs || !fs.published || fs.token !== s) return json({ error: 'inactive' }, 403);

    const sign = async (path) => {
      if (!path) return null;
      if (/^data:|^https?:/.test(path)) return path; // legacy base64/URL — pass through
      try {
        const sr = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/photos/${path}`, {
          method: 'POST',
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ expiresIn: 3600 })
        });
        if (!sr.ok) return null;
        const d = await sr.json();
        return d && d.signedURL ? `${SUPABASE_URL}/storage/v1${d.signedURL}` : null;
      } catch (e) { return null; }
    };

    const photos = [];
    for (const p of (fs.photos || [])) {
      const url = await sign(p.path);
      if (url) photos.push({ url, cap: p.cap || '', place: p.place || '', date: p.date || '' });
    }
    return json({
      intro: fs.intro || '',
      publishedAt: fs.publishedAt || null,
      photos,
      reflections: (fs.reflections || []).map(r => ({ text: r.text || '', date: r.date || '' }))
    });
  } catch (e) {
    return json({ error: 'server' }, 500);
  }
};
