import { useState, useEffect, Fragment } from 'react';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// Extract base name and human-readable timestamp from filenames like:
//   address_error_20260608_143215.logging  →  { base: 'address', ts: '2026-06-08 14:32:15' }
//   address_error.logging (legacy)         →  { base: 'address', ts: null }
function parseLogFileName(name) {
  const m = name.match(/^(.+)_error_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.logging$/);
  if (m) return { base: m[1], ts: `${m[2]}-${m[3]}-${m[4]} ${m[5]}:${m[6]}:${m[7]}` };
  return { base: name.replace(/_error\.logging$/, ''), ts: null };
}

// Parse the fixed-format error log into structured objects.
// Each block looks like:
//   ------------------------------------------------------------
//   Error #N
//   ------------------------------------------------------------
//   Record Number : <n>
//   Attribute     : <name>
//   Error         : <message>
//   Record        :
//     <Key padded>  = <value>
//     ...
function parseLog(text) {
  const SEP = '------------------------------------------------------------';
  const lines = text.split('\n');
  const errors = [];
  const meta = {};
  let i = 0;

  // Extract header block (first SEP…SEP section before any "Error #" block)
  if (lines[0] === SEP && !lines[1]?.startsWith('Error #')) {
    i = 1; // skip opening SEP
    while (i < lines.length && lines[i] !== SEP) {
      const line = lines[i];
      let m;
      if ((m = line.match(/^Validated\s+:\s*(.+)/)))   meta.timestamp = m[1].trim();
      if ((m = line.match(/^Data File\s+:\s*(.+)/)))    meta.dataFile = m[1].trim();
      if ((m = line.match(/^Instruction\s+:\s*(.+)/)))  meta.instructionFile = m[1].trim();
      if ((m = line.match(/^Total Errors\s+:\s*(.+)/))) meta.totalErrors = m[1].trim();
      i++;
    }
    i++; // skip closing SEP of header
  }

  while (i < lines.length) {
    if (lines[i] === SEP && lines[i + 1]?.startsWith('Error #')) {
      const m = lines[i + 1].match(/Error #(\d+)/);
      if (!m) { i++; continue; }

      const error = { index: parseInt(m[1]), recordNumber: null, attribute: null, message: null, record: [] };
      i += 3; // skip first SEP, "Error #N", second SEP

      let inRecord = false;
      while (i < lines.length && lines[i] !== SEP) {
        const line = lines[i];
        if (!inRecord) {
          let match;
          if ((match = line.match(/^Record Number\s*:\s*(.+)/)))  error.recordNumber = match[1].trim();
          else if ((match = line.match(/^Attribute\s+:\s*(.+)/))) error.attribute = match[1].trim();
          else if ((match = line.match(/^Error\s+:\s*(.+)/)))     error.message = match[1].trim();
          else if (/^Record\s+:/.test(line))                      inRecord = true;
        } else if (line.startsWith('  ')) {
          const eqIdx = line.indexOf(' = ');
          if (eqIdx > 0) {
            error.record.push({ key: line.slice(2, eqIdx).trim(), value: line.slice(eqIdx + 3) });
          }
        }
        i++;
      }

      errors.push(error);
    } else {
      i++;
    }
  }

  return { errors, meta };
}

const SORT_ICONS = { asc: ' ↑', desc: ' ↓', none: ' ↕' };

function ErrorTable({ errors }) {
  const [expanded, setExpanded] = useState(new Set());
  const [sortDir, setSortDir] = useState('none'); // 'none' | 'asc' | 'desc'

  function toggle(idx) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function expandAll()   { setExpanded(new Set(errors.map(e => e.index))); }
  function collapseAll() { setExpanded(new Set()); }

  function cycleSort() {
    setSortDir(d => d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none');
  }

  const rows = sortDir === 'none'
    ? errors
    : [...errors].sort((a, b) => {
        const diff = parseInt(a.recordNumber) - parseInt(b.recordNumber);
        return sortDir === 'asc' ? diff : -diff;
      });

  return (
    <div className="error-table-wrap">
      <div className="error-table-toolbar">
        <button className="btn-text" onClick={expandAll}>Expand all</button>
        <span className="toolbar-sep">·</span>
        <button className="btn-text" onClick={collapseAll}>Collapse all</button>
      </div>

      <table className="error-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th style={{ width: 56, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={cycleSort}>
              Row{SORT_ICONS[sortDir]}
            </th>
            <th style={{ width: '22%' }}>Attribute</th>
            <th>Error</th>
            <th style={{ width: 28 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(err => (
            <Fragment key={err.index}>
              <tr
                className={`err-row${expanded.has(err.index) ? ' expanded' : ''}`}
                onClick={() => toggle(err.index)}
              >
                <td className="err-num">{err.index}</td>
                <td className="err-row-num">{err.recordNumber}</td>
                <td className="err-attr">{err.attribute}</td>
                <td className="err-msg">{err.message}</td>
                <td className="err-chevron">{expanded.has(err.index) ? '▲' : '▼'}</td>
              </tr>

              {expanded.has(err.index) && (
                <tr className="err-detail-row">
                  <td colSpan={5}>
                    <table className="record-detail-table">
                      <tbody>
                        {err.record.map(({ key, value }) => {
                          const isError = key === err.attribute;
                          return (
                            <tr key={key} className={isError ? 'record-row-hl' : ''}>
                              <td className={`record-key${isError ? ' record-key-hl' : ''}`}>{key}</td>
                              <td className={`record-val${value === '(empty)' || value === '(column not in file)' ? ' record-val-empty' : ''}${isError ? ' record-val-hl' : ''}`}>
                                {value}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LogViewer() {
  const [files, setFiles] = useState([]);
  const [viewedFile, setViewedFile] = useState(null);
  const [checkedFiles, setCheckedFiles] = useState(new Set());
  const [errors, setErrors] = useState([]);
  const [meta, setMeta] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);

  function loadFiles() {
    setLoadingList(true);
    fetch('/api/logs')
      .then(r => r.json())
      .then(list => { setFiles(list); setLoadingList(false); })
      .catch(() => setLoadingList(false));
  }

  useEffect(() => { loadFiles(); }, []);

  function openFile(file) {
    if (viewedFile === file.name) return;
    setViewedFile(file.name);
    setErrors([]);
    setMeta({});
    setLoadingFile(true);
    fetch(`/api/logs/${encodeURIComponent(file.name)}`)
      .then(r => r.text())
      .then(text => {
        const { errors, meta } = parseLog(text);
        setErrors(errors);
        setMeta(meta);
        setLoadingFile(false);
      })
      .catch(() => setLoadingFile(false));
  }

  function toggleCheck(name, e) {
    e.stopPropagation();
    setCheckedFiles(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  const allChecked = files.length > 0 && checkedFiles.size === files.length;
  const someChecked = checkedFiles.size > 0 && !allChecked;

  function toggleAll() {
    setCheckedFiles(allChecked || someChecked ? new Set() : new Set(files.map(f => f.name)));
  }

  async function deleteChecked() {
    const names = [...checkedFiles];
    if (!window.confirm(`Delete ${names.length} selected log file${names.length !== 1 ? 's' : ''}?`)) return;
    await Promise.all(names.map(name =>
      fetch(`/api/logs/${encodeURIComponent(name)}`, { method: 'DELETE' })
    ));
    if (names.includes(viewedFile)) { setViewedFile(null); setErrors([]); setMeta({}); }
    setCheckedFiles(new Set());
    loadFiles();
  }

  return (
    <div className="log-viewer">
      {/* ── Left panel: file list ── */}
      <div className="log-list-panel">
        <div className="log-panel-header">
          <label className="log-select-all">
            <input
              type="checkbox"
              className="log-cb"
              checked={allChecked}
              ref={el => { if (el) el.indeterminate = someChecked; }}
              onChange={toggleAll}
              disabled={files.length === 0}
            />
            <span>Log Files{!loadingList && ` (${files.length})`}</span>
          </label>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            {checkedFiles.size > 0 && (
              <button className="btn-delete-selected" onClick={deleteChecked}>
                Delete ({checkedFiles.size})
              </button>
            )}
            <button className="btn-refresh" onClick={loadFiles} title="Refresh list">↻</button>
          </div>
        </div>

        {!loadingList && files.length === 0 && (
          <p className="log-empty">No log files yet.<br />Run a validation with errors to generate one.</p>
        )}

        <ul className="log-list">
          {files.map(f => {
            const { base, ts } = parseLogFileName(f.name);
            const isChecked = checkedFiles.has(f.name);
            return (
              <li
                key={f.name}
                className={`log-item${viewedFile === f.name ? ' active' : ''}${isChecked ? ' checked' : ''}`}
                onClick={() => openFile(f)}
              >
                <div className="log-item-row">
                  <input
                    type="checkbox"
                    className="log-cb"
                    checked={isChecked}
                    onChange={e => toggleCheck(f.name, e)}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="log-item-name">{base}</span>
                </div>
                <span className="log-item-meta log-item-meta-indented">
                  {ts ?? new Date(f.modified).toLocaleString()} · {formatSize(f.size)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Right panel: error table ── */}
      <div className="log-content-panel">
        {!viewedFile && !loadingFile && (
          <div className="log-placeholder"><span>Select a log file to view its contents</span></div>
        )}

        {loadingFile && (
          <div className="log-placeholder"><span>Loading…</span></div>
        )}

        {!loadingFile && viewedFile && (
          <>
            <div className="log-content-header">
              <div className="log-header-main">
                <span className="log-content-title">{viewedFile}</span>
                {meta.timestamp && (
                  <span className="log-timestamp">{meta.timestamp}</span>
                )}
              </div>
              <div className="log-header-right">
                {meta.dataFile && (
                  <span className="log-meta-chip" title="Data file">{meta.dataFile}</span>
                )}
                {meta.instructionFile && (
                  <span className="log-meta-chip" title="Instruction file">{meta.instructionFile}</span>
                )}
                <span className="log-error-count">
                  {errors.length} error{errors.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            {errors.length > 0
              ? <ErrorTable errors={errors} />
              : <div className="log-placeholder"><span>No errors parsed from this file.</span></div>
            }
          </>
        )}
      </div>
    </div>
  );
}
