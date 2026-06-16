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

  const names = rows[0];     // Row 1: column display names
  const dataTypes = rows[2]; // Row 3: data types (Boolean / Text / List)
  const row4 = rows[3];      // Row 4: Max Length N / *Reference / List Value

  const template = {};

  for (let i = 0; i < names.length; i++) {
    const name = String(names[i]).trim();
    if (!name) continue;

    const dataType = String(dataTypes[i] || '').trim();
    const row4val = String(row4[i] || '').trim();

    const field = { required: false };

    if (dataType.toLowerCase() === 'boolean') {
      field.data_format = 'boolean';
    } else if (/reference/i.test(row4val)) {
      field.data_format = 'list';
      field.reference = 'reference';
    } else {
      field.data_format = 'string';
      const lengthMatch = row4val.match(/max\s+length\s+(\d+)/i);
      if (lengthMatch) {
        field.length = lengthMatch[1];
      }
    }

    template[name] = field;
  }

  return { file: '', template };
}

module.exports = { parseTemplate };
