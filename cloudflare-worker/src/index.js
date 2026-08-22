const ALLOWED_ORIGINS = new Set([
  'http://localhost:8765',
  'https://lucasteixeiratst.github.io'
]);

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://lucasteixeiratst.github.io',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin'
  };
}

async function authenticate(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: env.SUPABASE_PUBLISHABLE_KEY }
  });
  return response.ok ? response.json() : null;
}

export default {
  async fetch(request, env) {
    const headers = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return Response.json({ error: 'Método não permitido' }, { status: 405, headers });
    const user = await authenticate(request, env);
    if (!user) return Response.json({ error: 'Autenticação necessária' }, { status: 401, headers });

    const url = new URL(request.url);
    if (url.pathname === '/files') {
      const listed = await env.NETWORK_FILES.list({ limit: 1000 });
      return Response.json({ files: listed.objects.map(({ key, size, uploaded, etag }) => ({ key, size, uploaded, etag })) }, { headers });
    }

    if (url.pathname.startsWith('/files/')) {
      const key = decodeURIComponent(url.pathname.slice(7));
      if (!/\.(kml|kmz|zip)$/i.test(key)) return Response.json({ error: 'Tipo de arquivo não permitido' }, { status: 400, headers });
      const object = await env.NETWORK_FILES.get(key);
      if (!object) return Response.json({ error: 'Arquivo não encontrado' }, { status: 404, headers });
      const responseHeaders = new Headers(headers);
      object.writeHttpMetadata(responseHeaders);
      responseHeaders.set('etag', object.httpEtag);
      responseHeaders.set('Cache-Control', 'private, max-age=3600');
      return new Response(object.body, { headers: responseHeaders });
    }
    return Response.json({ service: 'cpfl-network-api', status: 'ok' }, { headers });
  }
};

