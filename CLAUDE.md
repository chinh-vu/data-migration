# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web application for validating NetSuite data migration files before upload. A ReactJS SPA uploads files; a Node.js/Express server generates instruction JSON files from NetSuite template Excel files, validates data files against those instructions, manages error logs, and stores NetSuite authentication configuration.

Full functional and design documentation is in [references/design.md](references/design.md).

## Dev Commands

```bash
# First-time setup
npm run install:all

# Run both server and UI concurrently (with file-watching)
npm run dev

# Server only (port 3001)
npm run dev --prefix server

# UI only (port 5173, proxies /api → server)
npm run dev --prefix ui
```

## Structure

```text
data-migration/
  ui/src/
    App.jsx                      # Tab shell (Generate / Edit / Validate / Logs / Authentication)
    App.css                      # Global styles
    components/
      GenerateInstruction.jsx    # Upload template Excel → generate instruction JSON
      EditInstruction.jsx        # Edit instruction fields (type, length, values, required)
      ValidateData.jsx           # Upload data file + select instruction → validate
      LogViewer.jsx              # Browse, view, select and delete error log files
      AuthSettings.jsx           # Basic / OAuth 1.0 / OAuth 2.0 credential configuration
    utils/
      uploadWithProgress.jsx     # XHR wrapper that fires onProgress callbacks
  server/src/
    index.js                     # Express app, route registration
    routes/
      instructions.js            # /api/instructions — generate, list, fetch, update
      validate.js                # /api/validate — validate data file
      logs.js                    # /api/logs — list, fetch, delete log files
      authConfig.js              # /api/auth-config — read, write, test connection
    services/
      parseTemplate.js           # Read Excel template → instruction JSON object
      parseInstruction.js        # Custom parser preserving duplicate JSON keys
      validateData.js            # Validation engine + error log formatter
  server/templates/              # NetSuite Excel template files (.xlsx)
  server/instructions/           # Generated instruction JSON files
  server/samples/                # Data files to validate
  server/logging/                # Timestamped error log files
  server/config/
    auth.json                    # Saved authentication configuration (gitignore this)
  references/
    design.md                    # Functional and design documentation
    FRD.md                       # Original PowerShell FRD (historical reference)
```

## Architecture

### Dual-process development

UI (Vite, port 5173) and server (nodemon, port 3001) run concurrently via `concurrently`. Vite proxies all `/api` requests to the server so the UI never hard-codes the server port.

### Instruction JSON schema

```json
{
  "file": "../samples/address.xlsx",
  "template": {
    "Entity": { "data_format": "list", "reference": "reference", "required": false },
    "Label":  { "data_format": "string", "length": "150", "required": true },
    "Default Shipping": { "data_format": "boolean", "required": true },
    "Country": {
      "data_format": "list",
      "reference": "reference",
      "required": false,
      "values": "US\nCA\nUK"
    }
  }
}
```

`values` (list fields only) is a newline-delimited string. Blank lines are stripped on save. If absent, any non-empty value is accepted.

### Excel template row mapping

| Row | Purpose |
| --- | --- |
| 1 | Column names — keys in the instruction JSON |
| 2 | Internal NetSuite IDs — skipped |
| 3 | Skipped |
| 4 | Data validation: `Boolean` · `Date` · `Number` / `Integer` · `Double` / `Decimal` / `Float` · `*Reference` · `Max Length N` |
| 5 | Date format for `date` columns (e.g. `MM/DD/YYYY`) — ignored for other types |

### Duplicate-key JSON parsing

`JSON.parse` silently drops duplicate keys (e.g. `label` vs `Label` as distinct columns). `parseInstruction.js` uses a custom text-walker that extracts entries with a regex over raw text, preserving all keys and their insertion order.

### Validation rules

| Condition | Error message |
| --- | --- |
| `required: true` non-boolean field is empty | `required but empty` |
| `required: true` boolean field is empty | `boolean field is required and must be true or false` |
| Boolean field has unrecognised value | `expected boolean (true/false/yes/no/1/0)` |
| String field value exceeds `length` | `value length N exceeds max M` |
| List field value not in `values` (when set) | `expected one of: <values>` |
| Required column absent from data file | schema error; every row logged as `(column not in file)` |

### Error log format

Written to `server/logging/<datafilename>_error_YYYYMMDD_HHMMSS.logging` only when errors exist. Each run produces a new timestamped file.

```text
------------------------------------------------------------
Validated     : 2026-06-08 14:32:15
Data File     : address.xlsx
Instruction   : Address Template BTM.json
Total Errors  : 3
------------------------------------------------------------

------------------------------------------------------------
Error #1
------------------------------------------------------------
Record Number : 3
Attribute     : Default Shipping
Error         : Row 3, 'Default Shipping': boolean field is required and must be true or false
Record        :
  Entity                         = CUST 12442
  Default Shipping               = (empty)
```

### Authentication config

Stored in `server/config/auth.json`. Supports Basic, OAuth 1.0 (HMAC-SHA256 signed), and OAuth 2.0 (client credentials). The test connection endpoint (`POST /api/auth-config/test`) makes a live HTTP request from the server. **Add `server/config/auth.json` to `.gitignore`.**

## API Endpoints

| Method + Path | Purpose |
| --- | --- |
| `POST /api/instructions/generate` | Upload one template Excel → generate instruction JSON |
| `POST /api/instructions/generate-batch` | Upload multiple templates → batch generate |
| `GET /api/instructions` | List instruction JSON filenames |
| `GET /api/instructions/:name` | Fetch a specific instruction JSON |
| `PUT /api/instructions/:name` | Save edited instruction JSON |
| `POST /api/validate` | Upload data file + `instructionFile` name → validate |
| `GET /api/logs` | List log files `[{ name, modified, size }]` newest-first |
| `GET /api/logs/:name` | Fetch log file as plain text |
| `DELETE /api/logs/:name` | Delete a single log file |
| `DELETE /api/logs` | Purge all log files |
| `GET /api/auth-config` | Read saved auth configuration |
| `PUT /api/auth-config` | Save auth configuration |
| `POST /api/auth-config/test` | Test live connection with current credentials |

All endpoints return HTTP 200 on success, 400 for bad input, 404 for missing resources, 500 for unexpected failures.
