const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const LOGGING_DIR = path.join(__dirname, '../../logging');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// GET /api/logs  →  [{ name, modified, size }, ...] sorted newest first
router.get('/', (req, res) => {
  ensureDir(LOGGING_DIR);
  const files = fs.readdirSync(LOGGING_DIR)
    .filter(f => f.endsWith('.logging'))
    .map(f => {
      const stat = fs.statSync(path.join(LOGGING_DIR, f));
      return { name: f, modified: stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.modified - a.modified);
  res.json(files);
});

// GET /api/logs/:name  →  plain text content
router.get('/:name', (req, res) => {
  const name = path.basename(req.params.name);
  if (!name.endsWith('.logging')) return res.status(400).json({ error: 'Invalid file name' });

  const filePath = path.join(LOGGING_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Log file not found' });

  try {
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/logs/:name  →  remove a single log file
router.delete('/:name', (req, res) => {
  const name = path.basename(req.params.name);
  if (!name.endsWith('.logging')) return res.status(400).json({ error: 'Invalid file name' });

  const filePath = path.join(LOGGING_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Log file not found' });

  try {
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/logs  →  purge all log files
router.delete('/', (req, res) => {
  ensureDir(LOGGING_DIR);
  const files = fs.readdirSync(LOGGING_DIR).filter(f => f.endsWith('.logging'));
  try {
    files.forEach(f => fs.unlinkSync(path.join(LOGGING_DIR, f)));
    res.json({ deleted: files.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
