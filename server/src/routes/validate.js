const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validateData, formatErrorLog } = require('../services/validateData');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const INSTRUCTIONS_DIR = path.join(__dirname, '../../instructions');
const LOGGING_DIR = path.join(__dirname, '../../logging');

// POST /api/validate
router.post('/', upload.single('dataFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No data file uploaded' });

  const rawName = req.body.instructionFile;
  if (!rawName) return res.status(400).json({ error: 'instructionFile parameter is required' });

  const safeName = path.basename(rawName);
  if (!safeName.endsWith('.json')) return res.status(400).json({ error: 'Invalid instruction file name' });

  const instructionPath = path.join(INSTRUCTIONS_DIR, safeName);
  if (!fs.existsSync(instructionPath)) {
    return res.status(404).json({ error: `Instruction file not found: ${safeName}` });
  }

  try {
    const errors = validateData(instructionPath, req.file.buffer, req.file.originalname);

    let logFile = null;
    if (errors.length > 0) {
      if (!fs.existsSync(LOGGING_DIR)) fs.mkdirSync(LOGGING_DIR, { recursive: true });
      const now = new Date();
      const p = n => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
      logFile = `${baseName}_error_${stamp}.logging`;
      const meta = { dataFile: req.file.originalname, instructionFile: safeName };
      fs.writeFileSync(path.join(LOGGING_DIR, logFile), formatErrorLog(errors, meta), 'utf8');
    }

    res.json({
      status: errors.length === 0 ? 'PASSED' : 'FAILED',
      errorCount: errors.length,
      ...(errors.length > 0 && { errors, logFile }),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
