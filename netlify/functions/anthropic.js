// Secure proxy for the Anthropic API.
// The secret key lives ONLY in the ANTHROPIC_API_KEY environment variable on the
// server (set in Netlify), never in the page. The browser sends the same request
// body it used to send to Anthropic; this function adds the key + version headers
// and forwards it, then returns Anthropic's response unchanged.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
  }
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: event.body
    });
    const text = await resp.text();
    return { statusCode: resp.status, headers: { ...cors(), 'content-type': 'application/json' }, body: text };
  } catch (e) {
    return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
}
