const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const router = express.Router();
const CONFIG_DIR = path.join(__dirname, '../../config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'auth.json');

const DEFAULT = {
  type: 'basic',
  basic:  { url: '', accountId: '', username: '', password: '' },
  oauth1: { url: '', accountId: '', consumerKey: '', consumerSecret: '', tokenId: '', tokenSecret: '' },
  oauth2: { url: '', tokenUrl: '', accountId: '', clientId: '', clientSecret: '', redirectUri: '', scope: '' },
};

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return structuredClone(DEFAULT);
  try {
    const stored = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return {
      ...structuredClone(DEFAULT),
      ...stored,
      basic:  { ...DEFAULT.basic,  ...(stored.basic  || {}) },
      oauth1: { ...DEFAULT.oauth1, ...(stored.oauth1 || {}) },
      oauth2: { ...DEFAULT.oauth2, ...(stored.oauth2 || {}) },
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

// GET /api/auth-config
router.get('/', (req, res) => {
  res.json(readConfig());
});

// PUT /api/auth-config
router.put('/', (req, res) => {
  const { type, basic, oauth1, oauth2 } = req.body || {};
  if (!['basic', 'oauth1', 'oauth2'].includes(type)) {
    return res.status(400).json({ error: 'Invalid auth type' });
  }
  const current = readConfig();
  const config = {
    type,
    basic:  { ...current.basic,  ...(basic  || {}) },
    oauth1: { ...current.oauth1, ...(oauth1 || {}) },
    oauth2: { ...current.oauth2, ...(oauth2 || {}) },
  };
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  res.json({ ok: true });
});

// ── HTTP helper ──────────────────────────────────────────────────────────────
function httpRequest(method, targetUrl, headers, body, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(targetUrl); } catch { return reject(new Error(`Invalid URL: ${targetUrl}`)); }

    const lib = parsed.protocol === 'https:' ? https : http;
    const reqHeaders = { ...headers };
    if (body) reqHeaders['Content-Length'] = Buffer.byteLength(body);

    const req = lib.request({
      method,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      headers: reqHeaders,
      rejectUnauthorized: false,
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timed out after ${timeoutMs / 1000}s`)));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── OAuth 1.0 HMAC-SHA256 header ─────────────────────────────────────────────
function buildOAuth1Header(method, targetUrl, cfg) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const params = {
    oauth_consumer_key: cfg.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_token: cfg.tokenId,
    oauth_version: '1.0',
  };

  const baseUrl = targetUrl.split('?')[0];
  const sortedStr = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const sigBase = [method.toUpperCase(), encodeURIComponent(baseUrl), encodeURIComponent(sortedStr)].join('&');
  const sigKey = `${encodeURIComponent(cfg.consumerSecret)}&${encodeURIComponent(cfg.tokenSecret)}`;
  params.oauth_signature = crypto.createHmac('sha256', sigKey).update(sigBase).digest('base64');

  return 'OAuth realm="NetSuite",' +
    Object.entries(params).map(([k, v]) => `${k}="${encodeURIComponent(v)}"`).join(',');
}

// ── Status interpreter ────────────────────────────────────────────────────────
function interpret(statusCode, bodyText) {
  if (statusCode >= 200 && statusCode < 300) return { ok: true, message: `Connected — HTTP ${statusCode}` };
  if (statusCode === 401) return { ok: false, message: 'HTTP 401 — credentials rejected by server' };
  if (statusCode === 403) return { ok: false, message: 'HTTP 403 — access forbidden' };
  if (statusCode === 404) return { ok: false, message: 'HTTP 404 — endpoint not found' };

  // Try to surface an OAuth error description from the body
  try {
    const json = JSON.parse(bodyText);
    const msg = json.error_description || json.error || json.message;
    if (msg) return { ok: false, message: `HTTP ${statusCode} — ${msg}` };
  } catch { /* ignore */ }

  return { ok: false, message: `HTTP ${statusCode}` };
}

// ── POST /api/auth-config/test ────────────────────────────────────────────────
router.post('/test', async (req, res) => {
  const { type, basic, oauth1, oauth2 } = req.body || {};
  try {
    let result;

    if (type === 'basic') {
      if (!basic?.url)      return res.json({ ok: false, message: 'URL is required' });
      if (!basic?.username) return res.json({ ok: false, message: 'Username is required' });
      if (!basic?.password) return res.json({ ok: false, message: 'Password is required' });

      const token = Buffer.from(`${basic.username}:${basic.password}`).toString('base64');
      const r = await httpRequest('GET', basic.url, {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      result = interpret(r.statusCode, r.body);

    } else if (type === 'oauth1') {
      if (!oauth1?.url)           return res.json({ ok: false, message: 'URL is required' });
      if (!oauth1?.consumerKey)   return res.json({ ok: false, message: 'Consumer Key is required' });
      if (!oauth1?.consumerSecret)return res.json({ ok: false, message: 'Consumer Secret is required' });
      if (!oauth1?.tokenId)       return res.json({ ok: false, message: 'Token ID is required' });
      if (!oauth1?.tokenSecret)   return res.json({ ok: false, message: 'Token Secret is required' });

      const authHeader = buildOAuth1Header('GET', oauth1.url, oauth1);
      const r = await httpRequest('GET', oauth1.url, {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      result = interpret(r.statusCode, r.body);

    } else if (type === 'oauth2') {
      const tokenUrl = oauth2?.tokenUrl || oauth2?.url;
      if (!tokenUrl)            return res.json({ ok: false, message: 'Token URL is required' });
      if (!oauth2?.clientId)    return res.json({ ok: false, message: 'Client ID is required' });
      if (!oauth2?.clientSecret)return res.json({ ok: false, message: 'Client Secret is required' });

      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: oauth2.clientId,
        client_secret: oauth2.clientSecret,
        ...(oauth2.scope ? { scope: oauth2.scope } : {}),
      }).toString();

      const r = await httpRequest('POST', tokenUrl, {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      }, body);

      if (r.statusCode >= 200 && r.statusCode < 300) {
        try {
          const json = JSON.parse(r.body);
          const tokenType = json.token_type || 'Bearer';
          result = json.access_token
            ? { ok: true, message: `Connected — ${tokenType} token received` }
            : { ok: true, message: `Connected — HTTP ${r.statusCode}` };
        } catch {
          result = { ok: true, message: `Connected — HTTP ${r.statusCode}` };
        }
      } else {
        result = interpret(r.statusCode, r.body);
      }

    } else {
      return res.status(400).json({ ok: false, message: 'Invalid auth type' });
    }

    res.json(result);
  } catch (err) {
    res.json({ ok: false, message: err.message || 'Connection failed' });
  }
});

module.exports = router;
