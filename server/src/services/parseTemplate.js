const XLSX = require('xlsx');

function parseTemplate(buffer, filename) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new Error(`Cannot read Excel file: ${filename}`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Template file has no sheets');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 4) throw new Error('Template must have at least 4 rows');

  const names = rows[0];      // Row 1: column display names
                               // Row 2: Internal NetSuite IDs — skipped
                               // Row 3: skipped
  const row4 = rows[3];       // Row 4: data validation (type + constraints)
  const row5 = rows[4] || []; // Row 5: date format (optional)

  const template = {};

  for (let i = 0; i < names.length; i++) {
    const name = String(names[i]).trim();
    if (!name) continue;

    const row4val  = String(row4[i] || '').trim();
    const row4low  = row4val.toLowerCase();
    const row5val  = String(row5[i] || '').trim();

    const field = { required: false };

    if (row4low === 'boolean') {
      field.data_format = 'boolean';
    } else if (/reference/i.test(row4val)) {
      field.data_format = 'list';
      field.reference = 'reference';
    } else if (row4low === 'date') {
      field.data_format = 'date';
      if (row5val) field.format = row5val;
    } else if (row4low === 'number' || row4low === 'integer') {
      field.data_format = 'number';
    } else if (row4low === 'double' || row4low === 'decimal' || row4low === 'float') {
      field.data_format = 'double';
    } else {
      field.data_format = 'string';
      const lengthMatch = row4val.match(/max\s+length\s+(\d+)/i);
      if (lengthMatch) field.length = lengthMatch[1];
    }

    template[name] = field;
  }

  return { file: '', template };
}

module.exports = { parseTemplate };
