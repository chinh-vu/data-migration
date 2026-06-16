const XLSX = require('xlsx');
const path = require('path');
const { parseInstructionFile } = require('./parseInstruction');

const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no', 't', 'f', '1', '0']);

function validateData(instructionPath, dataBuffer, dataFilename) {
  const { columns } = parseInstructionFile(instructionPath);

  const ext = path.extname(dataFilename).toLowerCase();
  if (!['.xlsx', '.xls', '.xlsm', '.csv'].includes(ext)) {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  const workbook = ext === '.csv'
    ? XLSX.read(dataBuffer.toString('utf8'), { type: 'string' })
    : XLSX.read(dataBuffer, { type: 'buffer' });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length === 0) return [];

  const headers = rows[0].map(h => String(h).trim());
  const errors = [];

  // Required columns entirely absent from the data file (FR-28)
  const missingRequired = columns
    .filter(c => c.required && !headers.includes(c.name))
    .map(c => c.name);

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const raw = rows[rowIdx];
    const recordNum = rowIdx + 1; // 1-based, matching display row numbers

    const record = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = raw[i] !== undefined ? String(raw[i]).trim() : '';
    }

    for (const col of columns) {
      const { name, data_format, required, length } = col;

      if (missingRequired.includes(name)) {
        errors.push({
          recordNumber: recordNum,
          attribute: name,
          message: `Row ${recordNum}, '${name}': (column not in file)`,
          record: { ...record, [name]: '(column not in file)' },
        });
        continue;
      }

      const value = record[name] !== undefined ? record[name] : '';

      if (data_format === 'boolean') {
        if (value === '') {
          if (required) {
            errors.push({
              recordNumber: recordNum,
              attribute: name,
              message: `Row ${recordNum}, '${name}': boolean field is required and must be true or false`,
              record,
            });
          }
        } else if (!BOOLEAN_VALUES.has(value.toLowerCase())) {
          errors.push({
            recordNumber: recordNum,
            attribute: name,
            message: `Row ${recordNum}, '${name}': expected boolean (true/false/yes/no/1/0)`,
            record,
          });
        }
      } else if (data_format === 'list') {
        if (required && value === '') {
          errors.push({
            recordNumber: recordNum,
            attribute: name,
            message: `Row ${recordNum}, '${name}': required but empty`,
            record,
          });
        } else if (value !== '' && col.values) {
          const rawValues = (typeof col.values === 'string' ? col.values.split('\n') : col.values)
            .map(v => String(v)).filter(v => v.trim().length > 0);
          if (rawValues.length > 0 && !rawValues.map(v => v.trim().toLowerCase()).includes(value.toLowerCase())) {
            errors.push({
              recordNumber: recordNum,
              attribute: name,
              message: `Row ${recordNum}, '${name}': expected one of: ${rawValues.join(', ')}`,
              record,
            });
          }
        }
      } else {
        if (required && value === '') {
          errors.push({
            recordNumber: recordNum,
            attribute: name,
            message: `Row ${recordNum}, '${name}': required but empty`,
            record,
          });
        }
        if (length && value.length > parseInt(length, 10)) {
          errors.push({
            recordNumber: recordNum,
            attribute: name,
            message: `Row ${recordNum}, '${name}': value length ${value.length} exceeds max ${length}`,
            record,
          });
        }
      }
    }
  }

  return errors;
}

function formatTimestamp(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ` +
         `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

function formatErrorLog(errors, meta = {}) {
  const SEP = '------------------------------------------------------------';
  const lines = [];

  // Header block with timestamp and file context
  lines.push(SEP);
  lines.push(`Validated     : ${formatTimestamp(new Date())}`);
  if (meta.dataFile)        lines.push(`Data File     : ${meta.dataFile}`);
  if (meta.instructionFile) lines.push(`Instruction   : ${meta.instructionFile}`);
  lines.push(`Total Errors  : ${errors.length}`);
  lines.push(SEP);
  lines.push('');

  errors.forEach((err, idx) => {
    lines.push(SEP);
    lines.push(`Error #${idx + 1}`);
    lines.push(SEP);
    lines.push(`Record Number : ${err.recordNumber}`);
    lines.push(`Attribute     : ${err.attribute}`);
    lines.push(`Error         : ${err.message}`);
    lines.push('Record        :');

    const maxKeyLen = Math.max(30, ...Object.keys(err.record).map(k => k.length));
    for (const [key, val] of Object.entries(err.record)) {
      lines.push(`  ${key.padEnd(maxKeyLen)} = ${val === '' ? '(empty)' : val}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

module.exports = { validateData, formatErrorLog };
