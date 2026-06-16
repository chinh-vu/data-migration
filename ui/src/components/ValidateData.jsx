import { useState, useEffect } from 'react';
import ProgressBar from './ProgressBar';
import { uploadWithProgress } from '../utils/uploadWithProgress';

export default function ValidateData() {
  const [instructions, setInstructions] = useState([]);
  const [selected, setSelected] = useState('');
  const [dataFile, setDataFile] = useState(null);
  const [progress, setProgress] = useState(null); // null | { pct, label }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const busy = progress !== null;

  useEffect(() => {
    fetch('/api/instructions')
      .then(r => r.json())
      .then(list => { setInstructions(list); if (list.length === 1) setSelected(list[0]); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected || !dataFile) return;

    setProgress({ pct: 0, label: 'Uploading…' });
    setResult(null);
    setError('');

    const formData = new FormData();
    formData.append('dataFile', dataFile);
    formData.append('instructionFile', selected);

    try {
      const data = await uploadWithProgress('/api/validate', formData, pct => {
        if (pct < 100) {
          setProgress({ pct, label: 'Uploading…' });
        } else {
          setProgress({ pct: null, label: 'Validating…' });
        }
      });
      setResult(data);
    } catch (err) {
      setError(err?.error || 'Validation failed');
    } finally {
      setProgress(null);
    }
  }

  function recordLines(record) {
    const maxLen = Math.max(30, ...Object.keys(record).map(k => k.length));
    return Object.entries(record)
      .map(([k, v]) => `  ${k.padEnd(maxLen)} = ${v === '' ? '(empty)' : v}`)
      .join('\n');
  }

  return (
    <div>
      <div className="card">
        <h2>Validate Data File</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Instruction File</label>
            <select
              value={selected}
              onChange={e => { setSelected(e.target.value); setResult(null); }}
              disabled={instructions.length === 0}
            >
              <option value="">
                {instructions.length === 0
                  ? 'No instruction files — generate one first'
                  : 'Select an instruction file…'}
              </option>
              {instructions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Data File (.xlsx, .xls, .xlsm, .csv)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              onChange={e => { setDataFile(e.target.files[0] || null); setResult(null); }}
            />
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || !selected || !dataFile}
          >
            {busy ? 'Working…' : 'Validate'}
          </button>
          {progress && <ProgressBar pct={progress.pct} label={progress.label} />}
        </form>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="card">
          <div className="results-header">
            <span className={`badge ${result.status === 'PASSED' ? 'badge-pass' : 'badge-fail'}`}>
              {result.status}
            </span>
            {result.errorCount > 0 && (
              <span className="results-meta">
                {result.errorCount} error{result.errorCount !== 1 ? 's' : ''}
                {result.logFile && <> · log: <code>{result.logFile}</code></>}
              </span>
            )}
          </div>

          {result.status === 'PASSED' && (
            <div className="alert alert-success">No validation errors found.</div>
          )}

          {result.errors && (
            <div className="error-list">
              {result.errors.map((err, i) => (
                <div key={i} className="error-item">
                  <div className="error-meta">Row {err.recordNumber} · {err.attribute}</div>
                  <div className="error-msg">{err.message}</div>
                  {err.record && (
                    <div className="error-record">{recordLines(err.record)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
