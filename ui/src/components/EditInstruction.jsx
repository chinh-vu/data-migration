import { useState, useEffect } from 'react';

export default function EditInstruction() {
  const [instructions, setInstructions] = useState([]);
  const [selected, setSelected] = useState('');
  const [instruction, setInstruction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saved' | 'error' | null
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    fetch('/api/instructions')
      .then(r => r.json())
      .then(list => { setInstructions(list); if (list.length === 1) setSelected(list[0]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setInstruction(null); return; }
    setLoading(true);
    setSaveStatus(null);
    fetch(`/api/instructions/${encodeURIComponent(selected)}`)
      .then(r => r.json())
      .then(data => { setInstruction(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selected]);

  function updateField(colName, patch) {
    setInstruction(prev => ({
      ...prev,
      template: {
        ...prev.template,
        [colName]: { ...prev.template[colName], ...patch },
      },
    }));
    setSaveStatus(null);
  }

  function setDataFormat(colName, newFormat) {
    setInstruction(prev => {
      const old = prev.template[colName];
      const field = { data_format: newFormat, required: old.required };
      if (newFormat === 'string' && old.length) field.length = old.length;
      if (newFormat === 'list') {
        field.reference = 'reference';
        if (old.values) field.values = old.values;
      }
      if (newFormat === 'date' && old.format) field.format = old.format;
      return { ...prev, template: { ...prev.template, [colName]: field } };
    });
    setSaveStatus(null);
  }

  function setLength(colName, val) {
    setInstruction(prev => {
      const field = { ...prev.template[colName] };
      if (val) field.length = val; else delete field.length;
      return { ...prev, template: { ...prev.template, [colName]: field } };
    });
    setSaveStatus(null);
  }

  function setFormat(colName, val) {
    setInstruction(prev => {
      const field = { ...prev.template[colName] };
      if (val.trim()) field.format = val.trim(); else delete field.format;
      return { ...prev, template: { ...prev.template, [colName]: field } };
    });
    setSaveStatus(null);
  }

  function setValues(colName, text) {
    setInstruction(prev => {
      const field = { ...prev.template[colName] };
      if (text.trim()) field.values = text;
      else delete field.values;
      return { ...prev, template: { ...prev.template, [colName]: field } };
    });
    setSaveStatus(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus(null);
    setSaveError('');
    try {
      const cleanedTemplate = Object.fromEntries(
        Object.entries(instruction.template).map(([col, def]) => {
          if (typeof def.values !== 'string') return [col, def];
          const cv = def.values.split('\n').filter(l => l.trim().length > 0).join('\n');
          const out = { ...def };
          if (cv) out.values = cv; else delete out.values;
          return [col, out];
        })
      );
      const res = await fetch(`/api/instructions/${encodeURIComponent(selected)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...instruction, template: cleanedTemplate }),
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

  const columns = instruction ? Object.entries(instruction.template) : [];
  const requiredCount = columns.filter(([, v]) => v.required).length;

  return (
    <div>
      <div className="card">
        <h2>Edit Instruction File</h2>
        <div className="field">
          <label>Instruction File</label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
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
      </div>

      {loading && <div className="alert alert-info">Loading…</div>}

      {instruction && (
        <div className="card">
          <div className="field">
            <label>Data File Path (file)</label>
            <input
              className="text-input"
              type="text"
              value={instruction.file}
              onChange={e => { setInstruction(p => ({ ...p, file: e.target.value })); setSaveStatus(null); }}
              placeholder="e.g. ../samples/address.xlsx"
            />
          </div>

          <div className="field">
            <label>
              Columns
              <span className="col-count">{columns.length} total · {requiredCount} required</span>
            </label>

            <div className="table-scroll">
              <table className="instruction-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Max Length / Format</th>
                    <th>List Values</th>
                    <th className="col-required">Required</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map(([name, def]) => (
                    <tr key={name} className={def.required ? 'row-required' : ''}>
                      <td className="col-name">{name}</td>

                      <td>
                        <select
                          className="type-select"
                          value={def.data_format}
                          onChange={e => setDataFormat(name, e.target.value)}
                        >
                          <option value="string">string</option>
                          <option value="boolean">boolean</option>
                          <option value="list">list</option>
                          <option value="number">number</option>
                          <option value="double">double</option>
                          <option value="date">date</option>
                        </select>
                      </td>

                      <td>
                        {def.data_format === 'string' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <input
                              className="length-input"
                              type="text"
                              inputMode="numeric"
                              value={def.length || ''}
                              onChange={e => setLength(name, e.target.value.replace(/\D/g, ''))}
                              placeholder="max length"
                            />
                            <input
                              className="length-input"
                              type="text"
                              value={def.format || ''}
                              onChange={e => setFormat(name, e.target.value)}
                              placeholder="regex pattern"
                              title="Regular expression to validate the value (e.g. email, phone)"
                            />
                          </div>
                        ) : def.data_format === 'date' ? (
                          <input
                            className="length-input"
                            type="text"
                            value={def.format || ''}
                            onChange={e => setFormat(name, e.target.value)}
                            placeholder="MM/DD/YYYY"
                            style={{ width: 110 }}
                          />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>

                      <td>
                        <textarea
                          className={`values-input${def.data_format !== 'list' ? ' values-input-off' : ''}`}
                          value={def.data_format === 'list'
                            ? (typeof def.values === 'string' ? def.values : (def.values || []).join('\n'))
                            : ''}
                          onChange={e => setValues(name, e.target.value)}
                          placeholder={def.data_format === 'list'
                            ? 'one value per line\n(leave empty = allow any)'
                            : 'set type to "list" to enable'}
                          rows={3}
                          disabled={def.data_format !== 'list'}
                        />
                      </td>

                      <td className="col-required">
                        <input
                          type="checkbox"
                          checked={!!def.required}
                          onChange={() => updateField(name, { required: !def.required })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="save-row">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saveStatus === 'saved' && <span className="save-ok">Saved</span>}
            {saveStatus === 'error' && <span className="save-err">{saveError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
