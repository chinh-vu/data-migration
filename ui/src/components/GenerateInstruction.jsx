import { useState } from 'react';
import ProgressBar from './ProgressBar';
import { uploadWithProgress } from '../utils/uploadWithProgress';

export default function GenerateInstruction() {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(null); // null | { pct, label }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const busy = progress !== null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0) return;

    setProgress({ pct: 0, label: 'Uploading…' });
    setResult(null);
    setError('');

    const formData = new FormData();
    const isBatch = files.length > 1;
    if (isBatch) { for (const f of files) formData.append('templates', f); }
    else          { formData.append('template', files[0]); }

    const url = isBatch ? '/api/instructions/generate-batch' : '/api/instructions/generate';

    try {
      const data = await uploadWithProgress(url, formData, pct => {
        if (pct < 100) {
          setProgress({ pct, label: 'Uploading…' });
        } else {
          setProgress({ pct: null, label: 'Processing…' });
        }
      });
      setResult({ isBatch, data });
    } catch (err) {
      setError(err?.error || 'Generation failed');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Generate Instruction Files</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>NetSuite Template Excel File(s)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm"
              multiple
              onChange={e => { setFiles(Array.from(e.target.files)); setResult(null); setError(''); }}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || files.length === 0}>
            {busy ? 'Working…' : `Generate${files.length > 1 ? ` (${files.length} files)` : ''}`}
          </button>
          {progress && <ProgressBar pct={progress.pct} label={progress.label} />}
        </form>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && !result.isBatch && (
        <div className="card">
          <div className="alert alert-success">
            Generated <strong>{result.data.instructionFile}</strong>
          </div>
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#555' }}>
              Preview ({Object.keys(result.data.template).length} columns)
            </summary>
            <pre style={{ fontSize: '0.78rem', marginTop: '0.6rem', overflow: 'auto', maxHeight: '280px', padding: '0.5rem', background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
              {JSON.stringify(result.data.template, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {result && result.isBatch && (
        <div className="card">
          <div className="generated-results">
            {result.data.succeeded.length > 0 && (
              <>
                <h3>{result.data.succeeded.length} Generated</h3>
                <ul className="file-list success">
                  {result.data.succeeded.map(f => <li key={f}>{f}</li>)}
                </ul>
              </>
            )}
            {result.data.failed.length > 0 && (
              <>
                <h3 className="failed">{result.data.failed.length} Failed</h3>
                <ul className="file-list fail">
                  {result.data.failed.map(f => <li key={f.file}>{f.file} — {f.error}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
