const XLSX = require('xlsx');
const path = require('path');
const { parseInstructionFile } = require('./parseInstruction');

const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no', 't', 'f', '1', '0']);

function extractDateParts(fmt, value, sep) {
  let day, month, year;
  if (sep) {
    const fParts = fmt.split(sep);
    const vParts = value.split(sep);
    if (fParts.length !== 3 || vParts.length !== 3) return null;
    for (let i = 0; i < 3; i++) {
      const token = fParts[i].toUpperCase();
      const num = parseInt(vParts[i], 10);
      if (isNaN(num)) return null;
      if (token === 'DD' || token === 'D') day = num;
      else if (token === 'MM' || token === 'M') month = num;
      else if (token === 'YYYY') year = num;
      else if (token === 'YY') year = num < 100 ? 2000 + num : num;
    }
  } else {
    // No separator — parse positionally by token width
    let fi = 0, pos = 0;
    const f = fmt.toUpperCase();
    while (fi < f.length && pos < value.length) {
      let type, len;
      if (f.slice(fi, fi + 4) === 'YYYY')      { type = 'YYYY'; len = 4; fi += 4; }
      else if (f.slice(fi, fi + 2) === 'MM')   { type = 'MM';   len = 2; fi += 2; }
      else if (f.slice(fi, fi + 2) === 'DD')   { type = 'DD';   len = 2; fi += 2; }
      else if (f.slice(fi, fi + 2) === 'YY')   { type = 'YY';   len = 2; fi += 2; }
      else if (f[fi] === 'M')                   { type = 'M';    len = 1; fi += 1; }
      else if (f[fi] === 'D')                   { type = 'D';    len = 1; fi += 1; }
      else { fi++; continue; }
      const num = parseInt(value.slice(pos, pos + len), 10);
      if (isNaN(num)) return null;
      if (type === 'DD' || type === 'D') day = num;
      else if (type === 'MM' || type === 'M') month = num;
      else if (type === 'YYYY') year = num;
      else if (type === 'YY') year = num < 100 ? 2000 + num : num;
      pos += len;
    }
  }
  if (day == null || month == null || year == null) return null;
  return { day, month, year };
}

function isValidDate(value, format) {
  if (!format) {
    const d = new Date(value);
    return !isNaN(d.getTime());
  }
  const sep = /[\/\-\.]/.exec(format)?.[0] || null;
  const parts = extractDateParts(format, value, sep);
  if (!parts) return false;
  const { day, month, year } = parts;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

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

  // Warn when a column header in the data file doesn't match the instruction name at the same position
  const warnings = [];
  for (let i = 0; i < columns.length; i++) {
    if (i < headers.length && headers[i] !== columns[i].name) {
      warnings.push({
        columnIndex: i + 1,
        expected: columns[i].name,
        actual: headers[i],
        message: `Column ${i + 1}: header mismatch — instruction expects "${columns[i].name}", data file has "${headers[i]}"`,
      });
    }
  }

  const errors = [];

  // Columns whose position falls outside the data file's width are treated as absent
  const missingRequired = columns
    .filter((c, i) => c.required && i >= headers.length)
    .map(c => c.name);

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const raw = rows[rowIdx];
    const recordNum = rowIdx + 1;

    // Match by position — use instruction column name as the key regardless of header label
    const record = {};
    for (let i = 0; i < columns.length; i++) {
      record[columns[i].name] = i < raw.length ? String(raw[i]).trim() : '';
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
      } else if (data_format === 'number') {
        if (required && value === '') {
          errors.push({ recordNumber: recordNum, attribute: name, message: `Row ${recordNum}, '${name}': required but empty`, record });
        } else if (value !== '' && !/^-?\d+$/.test(value.trim())) {
          errors.push({ recordNumber: recordNum, attribute: name, message: `Row ${recordNum}, '${name}': expected an integer number`, record });
        }
      } else if (data_format === 'double') {
        if (required && value === '') {
          errors.push({ recordNumber: recordNum, attribute: name, message: `Row ${recordNum}, '${name}': required but empty`, record });
        } else if (value !== '' && (isNaN(parseFloat(value.trim())) || !isFinite(Number(value.trim())))) {
          errors.push({ recordNumber: recordNum, attribute: name, message: `Row ${recordNum}, '${name}': expected a numeric value`, record });
        }
      } else if (data_format === 'date') {
        if (required && value === '') {
          errors.push({ recordNumber: recordNum, attribute: name, message: `Row ${recordNum}, '${name}': required but empty`, record });
        } else if (value !== '' && !isValidDate(value.trim(), col.format || '')) {
          const hint = col.format ? ` in format ${col.format}` : '';
          errors.push({ recordNumber: recordNum, attribute: name, message: `Row ${recordNum}, '${name}': expected a valid date${hint}`, record });
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
        if (col.format && value !== '') {
          try {
            if (!new RegExp(col.format).test(value)) {
              errors.push({
                recordNumber: recordNum,
                attribute: name,
                message: `Row ${recordNum}, '${name}': does not match required pattern (${col.format})`,
                record,
              });
            }
          } catch { /* invalid regex in instruction — skip */ }
        }
      }
    }
  }

  return { errors, warnings };
}

function formatTimestamp(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ` +
         `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

function formatErrorLog(errors, meta = {}, warnings = []) {
  const SEP = '------------------------------------------------------------';
  const lines = [];

  lines.push(SEP);
  lines.push(`Validated     : ${formatTimestamp(new Date())}`);
  if (meta.dataFile)        lines.push(`Data File     : ${meta.dataFile}`);
  if (meta.instructionFile) lines.push(`Instruction   : ${meta.instructionFile}`);
  lines.push(`Total Errors  : ${errors.length}`);
  if (warnings.length > 0)  lines.push(`Warnings      : ${warnings.length}`);
  lines.push(SEP);
  lines.push('');

  if (warnings.length > 0) {
    lines.push('HEADER WARNINGS');
    lines.push(SEP);
    warnings.forEach(w => lines.push(w.message));
    lines.push('');
  }

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
