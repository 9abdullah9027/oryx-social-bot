const GRAPH_FB_BASE = 'https://graph.facebook.com/v19.0';
const GRAPH_IG_BASE = 'https://graph.instagram.com';

function getBaseUrl(accessToken) {
  return accessToken?.startsWith('IGAA') ? GRAPH_IG_BASE : GRAPH_FB_BASE;
}

/**
 * Retrieve account profile details.
 * @param {string} accountId
 * @param {string} accessToken
 * @returns {Promise<{id: string, username?: string, name?: string, profile_picture_url?: string}>}
 */
export async function getAccountProfile(accountId, accessToken) {
  const base = getBaseUrl(accessToken);
  const target = (base === GRAPH_IG_BASE && (!accountId || accountId === 'me')) ? 'me' : (accountId || 'me');
  const fields = base === GRAPH_IG_BASE ? 'id,username,account_type' : 'id,username,name,profile_picture_url';

  const url = new URL(`${base}/${target}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`[ERROR] Instagram profile request failed: ${data.error?.message || res.statusText}`);
  }

  return data;
}

/**
 * Fetch recent media posts from the target Instagram account.
 * @param {string} accountId Instagram account ID or 'me'
 * @param {string} accessToken User access token
 * @param {number} limit Number of recent posts to query
 * @returns {Promise<Array<object>>}
 */
export async function fetchRecentMedia(accountId, accessToken, limit = 5) {
  const base = getBaseUrl(accessToken);
  const target = (base === GRAPH_IG_BASE && (!accountId || accountId === 'me')) ? 'me' : (accountId || 'me');

  const url = new URL(`${base}/${target}/media`);
  url.searchParams.set('fields', 'id,caption,media_type,media_url,permalink,timestamp,thumbnail_url,username');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error?.message || `HTTP ${res.status} ${res.statusText}`;
    const code = data.error?.code ? ` (Code ${data.error.code})` : '';
    throw new Error(`[ERROR] Instagram API media request failed: ${msg}${code}`);
  }

  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Inspect access token metadata, permissions, and validity.
 * @param {string} accessToken
 * @returns {Promise<object>}
 */
export async function inspectToken(accessToken) {
  const base = getBaseUrl(accessToken);

  if (base === GRAPH_IG_BASE) {
    const profile = await getAccountProfile('me', accessToken);
    return {
      isValid: true,
      appId: 'Instagram Login App',
      type: 'INSTAGRAM_USER',
      username: profile.username,
      scopes: ['instagram_business_basic'],
      expiresAt: '60 days from generation/refresh',
      daysRemaining: 60,
      raw: profile
    };
  }

  const url = new URL(`${base}/debug_token`);
  url.searchParams.set('input_token', accessToken);
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`[ERROR] Instagram token inspection failed: ${data.error?.message || res.statusText}`);
  }

  const tokenData = data.data;
  const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : null;
  const now = new Date();
  const daysRemaining = expiresAt ? Math.round((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;

  return {
    isValid: tokenData.is_valid,
    appId: tokenData.app_id,
    type: tokenData.type,
    scopes: tokenData.scopes,
    expiresAt: expiresAt ? expiresAt.toISOString() : 'Not specified',
    daysRemaining,
    raw: tokenData
  };
}

/**
 * Refresh a long-lived Instagram User Access Token.
 * @param {string} accessToken
 * @returns {Promise<{access_token: string, token_type: string, expires_in: number}>}
 */
export async function refreshLongLivedToken(accessToken) {
  const base = getBaseUrl(accessToken);
  const endpoint = base === GRAPH_IG_BASE ? `${base}/refresh_access_token` : `${base}/oauth/access_token`;

  const url = new URL(endpoint);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`[ERROR] Instagram token refresh failed: ${data.error?.message || res.statusText}`);
  }

  return data;
}
