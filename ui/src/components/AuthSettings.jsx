import { useState, useEffect } from 'react';

const EMPTY = {
  type: 'basic',
  basic:  { url: '', accountId: '', username: '', password: '' },
  oauth1: { url: '', accountId: '', consumerKey: '', consumerSecret: '', tokenId: '', tokenSecret: '' },
  oauth2: { url: '', tokenUrl: '', accountId: '', clientId: '', clientSecret: '', redirectUri: '', scope: '' },
};

const AUTH_TYPES = [
  { value: 'basic',  label: 'Basic Authentication' },
  { value: 'oauth1', label: 'OAuth 1.0' },
  { value: 'oauth2', label: 'OAuth 2.0' },
];

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, autoComplete }) {
  return (
    <input
      className="text-input"
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ''}
      autoComplete={autoComplete || 'off'}
    />
  );
}

function SecretInput({ value, onChange, placeholder, show, onToggle }) {
  return (
    <div className="secret-row">
      <input
        className="text-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ''}
        autoComplete="new-password"
      />
      <button type="button" className="btn-reveal" onClick={onToggle}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function BasicForm({ cfg, set, show, toggleShow }) {
  return (
    <>
      <Field label="URL" hint="NetSuite REST API base URL">
        <TextInput value={cfg.url} onChange={v => set('url', v)} placeholder="https://<accountId>.suitetalk.api.netsuite.com/services/rest" />
      </Field>
      <Field label="Account ID" hint="NetSuite account ID">
        <TextInput value={cfg.accountId} onChange={v => set('accountId', v)} placeholder="e.g. 1234567" />
      </Field>
      <Field label="Username">
        <TextInput value={cfg.username} onChange={v => set('username', v)} placeholder="user@company.com" autoComplete="username" />
      </Field>
      <Field label="Password">
        <SecretInput value={cfg.password} onChange={v => set('password', v)} show={show.password} onToggle={() => toggleShow('password')} />
      </Field>
    </>
  );
}

function OAuth1Form({ cfg, set, show, toggleShow }) {
  return (
    <>
      <Field label="URL" hint="NetSuite REST API base URL">
        <TextInput value={cfg.url} onChange={v => set('url', v)} placeholder="https://<accountId>.suitetalk.api.netsuite.com/services/rest" />
      </Field>
      <Field label="Account ID" hint="NetSuite account ID">
        <TextInput value={cfg.accountId} onChange={v => set('accountId', v)} placeholder="e.g. 1234567" />
      </Field>
      <Field label="Consumer Key" hint="From the integration record">
        <TextInput value={cfg.consumerKey} onChange={v => set('consumerKey', v)} placeholder="Consumer key" />
      </Field>
      <Field label="Consumer Secret">
        <SecretInput value={cfg.consumerSecret} onChange={v => set('consumerSecret', v)} show={show.consumerSecret} onToggle={() => toggleShow('consumerSecret')} />
      </Field>
      <Field label="Token ID" hint="From the access token record">
        <TextInput value={cfg.tokenId} onChange={v => set('tokenId', v)} placeholder="Token ID" />
      </Field>
      <Field label="Token Secret">
        <SecretInput value={cfg.tokenSecret} onChange={v => set('tokenSecret', v)} show={show.tokenSecret} onToggle={() => toggleShow('tokenSecret')} />
      </Field>
    </>
  );
}

function OAuth2Form({ cfg, set, show, toggleShow }) {
  return (
    <>
      <Field label="Authorization URL" hint="Browser redirect — e.g. /app/login/oauth2/authorize">
        <TextInput value={cfg.url} onChange={v => set('url', v)} placeholder="https://<accountId>.app.netsuite.com/app/login/oauth2/authorize" />
      </Field>
      <Field label="Token URL" hint="API token endpoint — used for Test Connection">
        <TextInput value={cfg.tokenUrl} onChange={v => set('tokenUrl', v)} placeholder="https://<accountId>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token" />
      </Field>
      <Field label="Account ID" hint="NetSuite account ID">
        <TextInput value={cfg.accountId} onChange={v => set('accountId', v)} placeholder="e.g. 1234567" />
      </Field>
      <Field label="Client ID" hint="From the integration record">
        <TextInput value={cfg.clientId} onChange={v => set('clientId', v)} placeholder="Client ID" />
      </Field>
      <Field label="Client Secret">
        <SecretInput value={cfg.clientSecret} onChange={v => set('clientSecret', v)} show={show.clientSecret} onToggle={() => toggleShow('clientSecret')} />
      </Field>
      <Field label="Redirect URI">
        <TextInput value={cfg.redirectUri} onChange={v => set('redirectUri', v)} placeholder="http://localhost:3001/oauth/callback" />
      </Field>
      <Field label="Scope" hint="Space-separated (e.g. rest_webservices)">
        <TextInput value={cfg.scope} onChange={v => set('scope', v)} placeholder="rest_webservices" />
      </Field>
    </>
  );
}

export default function AuthSettings() {
  const [config, setConfig] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // null | { ok, message }
  const [show, setShow] = useState({});

  useEffect(() => {
    fetch('/api/auth-config')
      .then(r => r.json())
      .then(data => {
        setConfig({
          ...EMPTY,
          ...data,
          basic:  { ...EMPTY.basic,  ...(data.basic  || {}) },
          oauth1: { ...EMPTY.oauth1, ...(data.oauth1 || {}) },
          oauth2: { ...EMPTY.oauth2, ...(data.oauth2 || {}) },
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function setType(type) {
    setConfig(p => ({ ...p, type }));
    setSaveStatus(null);
    setTestResult(null);
  }

  function setField(section, key, value) {
    setConfig(p => ({ ...p, [section]: { ...p[section], [key]: value } }));
    setSaveStatus(null);
    setTestResult(null);
  }

  function toggleShow(key) {
    setShow(p => ({ ...p, [key]: !p[key] }));
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/auth-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: 'Cannot reach server — is it running?' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus(null);
    setSaveError('');
    try {
      const res = await fetch('/api/auth-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || 'Save failed'); setSaveStatus('error'); }
      else setSaveStatus('saved');
    } catch {
      setSaveError('Cannot reach server — is it running?');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  const { type } = config;

  return (
    <div>
      <div className="card">
        <h2>Authentication Settings</h2>

        <div className="field">
          <label>Authentication Type</label>
          <div className="auth-type-selector">
            {AUTH_TYPES.map(t => (
              <button
                key={t.value}
                className={`auth-type-btn${type === t.value ? ' active' : ''}`}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="alert alert-info" style={{ marginTop: '1rem' }}>Loading…</div>}

        {!loading && (
          <>
            <hr className="auth-divider" />

            {type === 'basic' && (
              <BasicForm
                cfg={config.basic}
                set={(k, v) => setField('basic', k, v)}
                show={show}
                toggleShow={toggleShow}
              />
            )}
            {type === 'oauth1' && (
              <OAuth1Form
                cfg={config.oauth1}
                set={(k, v) => setField('oauth1', k, v)}
                show={show}
                toggleShow={toggleShow}
              />
            )}
            {type === 'oauth2' && (
              <OAuth2Form
                cfg={config.oauth2}
                set={(k, v) => setField('oauth2', k, v)}
                show={show}
                toggleShow={toggleShow}
              />
            )}

            <div className="save-row">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || testing}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-test" onClick={handleTest} disabled={saving || testing}>
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
              {saveStatus === 'saved' && <span className="save-ok">Saved</span>}
              {saveStatus === 'error' && <span className="save-err">{saveError}</span>}
              {testResult && (
                <span className={testResult.ok ? 'test-ok' : 'test-err'}>
                  {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
