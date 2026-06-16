const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseTemplate } = require('../services/parseTemplate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const INSTRUCTIONS_DIR = path.join(__dirname, '../../instructions');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeJsonName(name) {
  const base = path.basename(name);
  return base.endsWith('.json') ? base : null;
}

// POST /api/instructions/generate
router.post('/generate', upload.single('template'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No template file uploaded' });

  try {
    const instruction = parseTemplate(req.file.buffer, req.file.originalname);
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const outputName = `${baseName}.json`;

    ensureDir(INSTRUCTIONS_DIR);
    fs.writeFileSync(path.join(INSTRUCTIONS_DIR, outputName), JSON.stringify(instruction, null, 4), 'utf8');

    res.json({ instructionFile: outputName, template: instruction.template });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/instructions/generate-batch
router.post('/generate-batch', upload.array('templates'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No template files uploaded' });
  }

  ensureDir(INSTRUCTIONS_DIR);
  const succeeded = [];
  const failed = [];

  for (const file of req.files) {
    try {
      const instruction = parseTemplate(file.buffer, file.originalname);
      const baseName = path.basename(file.originalname, path.extname(file.originalname));
      const outputName = `${baseName}.json`;
      fs.writeFileSync(path.join(INSTRUCTIONS_DIR, outputName), JSON.stringify(instruction, null, 4), 'utf8');
      succeeded.push(outputName);
    } catch (err) {
      failed.push({ file: file.originalname, error: err.message });
    }
  }

  res.json({ succeeded, failed });
});

// GET /api/instructions
router.get('/', (req, res) => {
  ensureDir(INSTRUCTIONS_DIR);
  const files = fs.readdirSync(INSTRUCTIONS_DIR).filter(f => f.endsWith('.json'));
  res.json(files);
});

// GET /api/instructions/:name
router.get('/:name', (req, res) => {
  const name = safeJsonName(req.params.name);
  if (!name) return res.status(400).json({ error: 'Invalid file name' });

  const filePath = path.join(INSTRUCTIONS_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Instruction file not found' });

  try {
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    res.status(500).json({ error: 'Failed to parse instruction file' });
  }
});

// PUT /api/instructions/:name
router.put('/:name', express.json(), (req, res) => {
  const name = safeJsonName(req.params.name);
  if (!name) return res.status(400).json({ error: 'Invalid file name' });

  const filePath = path.join(INSTRUCTIONS_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Instruction file not found' });

  const body = req.body;
  if (typeof body.file !== 'string' || typeof body.template !== 'object' || body.template === null) {
    return res.status(400).json({ error: 'Body must have "file" (string) and "template" (object)' });
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(body, null, 4), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
