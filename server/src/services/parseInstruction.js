const fs = require('fs');

function parseInstructionFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return parseInstructionText(text);
}

function parseInstructionText(text) {
  const parsed = JSON.parse(text);
  const columns = extractColumns(text);
  return { file: parsed.file, columns };
}

// Walk the raw text to extract template columns in insertion order, preserving
// duplicate keys that JSON.parse would silently collapse.
function extractColumns(text) {
  const tmplMatch = /"template"\s*:\s*\{/.exec(text);
  if (!tmplMatch) return [];

  const start = tmplMatch.index + tmplMatch[0].length;
  let depth = 1;
  let end = start;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  const body = text.slice(start, end);
  const columns = [];

  // Each entry: "column name": { ... } — allow one level of nested objects (e.g. required_if)
  const entryRe = /"((?:[^"\\]|\\.)*)"\s*:\s*(\{(?:[^{}]|\{[^{}]*\})*\})/g;
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    const name = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const def = JSON.parse(m[2]);
    columns.push({ name, ...def });
  }

  return columns;
}

module.exports = { parseInstructionFile, parseInstructionText };
