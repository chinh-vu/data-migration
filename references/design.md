# Functional and Design Document

**Project:** NetSuite Data Migration Validator
**Stack:** ReactJS (Vite) · Node.js · Express

---

## 1. Purpose

This application validates NetSuite data migration files before they are uploaded to NetSuite. It reduces manual review effort by catching formatting errors — missing required values, invalid booleans, exceeded field lengths, invalid list values — before they reach the target system.

---

## 2. Scope

| In scope | Out of scope |
| --- | --- |
| Generating instruction JSON files from NetSuite Excel templates | Uploading files directly to NetSuite |
| Editing instruction files (types, lengths, list values, required) | Modifying source data files |
| Validating Excel / CSV data files against instruction files | Referential integrity checks against live NetSuite data |
| Logging validation errors with full record detail | |
| Viewing, filtering, and deleting error log files | |
| Storing and testing NetSuite API authentication credentials | |

---

## 3. Features

The UI is a five-tab single-page application.

| Tab | Description |
| --- | --- |
| **Generate Instructions** | Upload one or more NetSuite template Excel files to generate instruction JSON files |
| **Edit Instructions** | Edit column definitions in an instruction file — data type, max length, allowed list values, required flag, and data file path |
| **Validate Data** | Select an instruction file and upload a data file for validation; results display inline |
| **Logs** | Browse timestamped error log files; view errors as a sortable table; delete individual files or a selected set |
| **Authentication** | Configure Basic, OAuth 1.0, or OAuth 2.0 credentials for NetSuite; test the connection live |

---

## 4. Functional Requirements

### 4.1 Instruction File Generation

| ID | Requirement |
| --- | --- |
| FR-01 | Upload a single NetSuite template Excel file (.xlsx). |
| FR-02 | Upload multiple template Excel files in one batch operation. |
| FR-03 | The server reads only the first sheet of each template. |
| FR-04 | Row 1 of the template sheet provides column attribute names (keys in the instruction JSON). |
| FR-05 | Row 3 is skipped. |
| FR-06 | Row 4 (data validation) determines both the type and constraints for each column — case-insensitive: `Boolean` → `boolean`; `Date` → `date`; `*Reference` → `list`; `Number` / `Integer` → `number`; `Double` / `Decimal` / `Float` → `double`; `Max Length N` → `string` with `length: "N"`; otherwise `string`. |
| FR-06a | Row 5 provides the date format for `date` columns (e.g. `MM/DD/YYYY`) → `"format": "MM/DD/YYYY"`. Ignored for all other column types. |
| FR-07 | All generated fields default to `"required": false`. |
| FR-08 | The `"file"` key in the output is an empty string for manual fill-in. |
| FR-09 | The `instructions/` directory is created automatically if absent. |
| FR-10 | Batch generation reports per-file success and failure; a failure in one file does not stop others. |

### 4.2 Instruction File Editing

| ID | Requirement |
| --- | --- |
| FR-11 | Display all columns from the selected instruction file in an editable table. |
| FR-12 | Allow changing `data_format` per column: `string`, `boolean`, or `list`. |
| FR-13 | Allow setting a numeric max length for `string` fields. |
| FR-14 | Show a textarea for `list` fields to enter allowed values, one per line. Non-list fields show the textarea as disabled with explanatory placeholder text. |
| FR-15 | Allow toggling `required` per column. |
| FR-16 | Allow editing the data file path (`file` key). |
| FR-17 | Blank lines in the list values textarea are ignored on save; internal spaces within a value are preserved. |
| FR-18 | Save posts the full updated instruction JSON to the server via `PUT /api/instructions/:name`. |

### 4.3 Data File Validation

| ID | Requirement |
| --- | --- |
| FR-19 | Allow selecting an instruction JSON from the server-side list. |
| FR-20 | Allow uploading a data file (.xlsx, .xls, .xlsm, .csv) for validation. |
| FR-21 | The server validates every row against every column in the instruction JSON. |
| FR-22 | Validation result is `PASSED` (no errors) or `FAILED` (error count + details). |
| FR-23 | An error log is written only when at least one error exists. |
| FR-24 | The error log filename includes a timestamp: `<datafile>_error_YYYYMMDD_HHMMSS.logging`. Each run creates a new file; previous logs are retained. |

### 4.4 Validation Rules

| ID | Rule |
| --- | --- |
| FR-25 | A `required: true` non-boolean field that is empty → `required but empty`. |
| FR-26 | A `required: true` boolean field that is empty → `boolean field is required and must be true or false`. |
| FR-27 | A boolean field with an unrecognised value → `expected boolean (true/false/yes/no/1/0)`. Recognised values: `true false yes no t f 1 0` (case-insensitive). |
| FR-28 | A `string` field whose value length exceeds `length` → `value length N exceeds max M`. |
| FR-29 | A `list` field with a `values` constraint whose value is not in the list → `expected one of: <values>`. Comparison is case-insensitive and trims whitespace. If `values` is absent, any non-empty value is accepted. |
| FR-30 | A `required: true` column that is entirely absent from the data file → schema-level error; every row is logged with `(column not in file)`. |

### 4.5 Log Management

| ID | Requirement |
| --- | --- |
| FR-31 | List all `.logging` files in `server/logging/`, newest first, with size and timestamp. |
| FR-32 | Display a selected log file as a structured error table (error #, row, attribute, message) with expandable record detail. |
| FR-33 | The row column in the error table supports ascending/descending/natural sort. |
| FR-34 | The highlighted row in the expanded detail identifies the error attribute (red left border, bold key, red value). |
| FR-35 | Allow deleting individual log files. |
| FR-36 | Allow multi-selecting log files with checkboxes (including select-all with indeterminate state) and deleting the selection in one confirmed operation. |

### 4.6 Authentication

| ID | Requirement |
| --- | --- |
| FR-37 | Support three authentication types: Basic, OAuth 1.0 (Token-Based Authentication), OAuth 2.0. |
| FR-38 | Basic Authentication fields: URL, Account ID, Username, Password. |
| FR-39 | OAuth 1.0 fields: URL, Account ID, Consumer Key, Consumer Secret, Token ID, Token Secret. |
| FR-40 | OAuth 2.0 fields: Authorization URL, Token URL, Account ID, Client ID, Client Secret, Redirect URI, Scope. |
| FR-41 | Secret fields (passwords, secrets, tokens) use masked input with a Show/Hide toggle. |
| FR-42 | Save persists configuration to `server/config/auth.json`. |
| FR-43 | Test Connection makes a live HTTP request from the server using the current form values (not the saved config), and returns the HTTP status code or network error message. |

---

## 5. Design

### 5.1 Technology

| Layer | Technology |
| --- | --- |
| Frontend | React 18 · Vite 5 (port 5173 in dev) |
| Backend | Node.js · Express (port 3001) |
| File uploads | multer 2.x (memory storage) |
| Excel parsing | SheetJS (xlsx 0.18.x) |
| Dev tooling | concurrently · nodemon |

Vite proxies all `/api` requests to the server during development so no CORS configuration or hard-coded ports are needed in the UI.

### 5.2 Folder Structure

```text
data-migration/
  ui/src/
    App.jsx                       # Tab shell
    App.css                       # Global styles
    components/
      GenerateInstruction.jsx
      EditInstruction.jsx
      ValidateData.jsx
      LogViewer.jsx
      AuthSettings.jsx
    utils/
      uploadWithProgress.js       # XHR wrapper for upload progress events
  server/src/
    index.js                      # Express app bootstrap
    routes/
      instructions.js             # /api/instructions/*
      validate.js                 # /api/validate
      logs.js                     # /api/logs/*
      authConfig.js               # /api/auth-config/*
    services/
      parseTemplate.js            # Excel → instruction object
      parseInstruction.js         # Duplicate-key-safe JSON parser
      validateData.js             # Validation engine + log formatter
  server/templates/               # Source Excel templates
  server/instructions/            # Generated instruction JSON files
  server/samples/                 # Data files for validation
  server/logging/                 # Timestamped error log files
  server/config/
    auth.json                     # Authentication config (exclude from version control)
  references/
    design.md                     # This document
    FRD.md                        # Original PowerShell FRD (historical)
  CLAUDE.md                       # Developer guidance for Claude Code
```

### 5.3 Instruction JSON Schema

```json
{
  "file": "../samples/address.xlsx",
  "template": {
    "Entity": {
      "data_format": "list",
      "reference": "reference",
      "required": false,
      "values": "Customer\nVendor\nEmployee"
    },
    "Label": {
      "data_format": "string",
      "length": "150",
      "required": true
    },
    "Default Shipping": {
      "data_format": "boolean",
      "required": true
    }
  }
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `file` | string | Relative path from the JSON file to the data file. Set manually after generation. |
| `template` | object | Map of column name → field definition. Order is preserved. |
| `data_format` | `"string"` \| `"boolean"` \| `"list"` | Determines validation behaviour. |
| `length` | string | Max character length. String fields only. Absent = no limit. |
| `reference` | `"reference"` | Present on list fields parsed from templates. |
| `values` | string | Newline-delimited list of allowed values. List fields only. Absent = any value accepted. |
| `required` | boolean | Whether empty values are an error. Default `false`. |

### 5.4 Excel Template Row Mapping

| Row | Content | Action |
| --- | --- | --- |
| 1 | Display attribute names | Column keys in the instruction JSON |
| 2 | Internal NetSuite field IDs | Skipped |
| 3 | Skipped | — |
| 4 | Data validation: type label + constraint (`Boolean`, `Date`, `*Reference`, `Max Length N`, `Number`, `Double`, etc.) | Sets `data_format`, `length`, `reference` |
| 5 | Date format for `date` columns (e.g. `MM/DD/YYYY`) | Sets `format`; ignored for other types |

### 5.5 Duplicate-Key JSON Parsing

NetSuite templates can produce instruction files with duplicate keys that differ only in case (`label` vs `Label`). JavaScript's `JSON.parse` silently discards the earlier duplicate. The custom parser in `parseInstruction.js` walks the raw JSON text with a regex, extracts all entries in order, and returns them as an array — ensuring all columns are validated.

### 5.6 Upload Progress

`fetch` provides no upload progress API. `uploadWithProgress.js` wraps `XMLHttpRequest` and fires an `onProgress(pct)` callback from `xhr.upload.progress` events. The UI shows a two-phase progress bar: determinate while uploading (0–100%), then indeterminate while the server processes.

### 5.7 Error Log Format

Filename: `<datafile>_error_YYYYMMDD_HHMMSS.logging`

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
Record Number : 4
Attribute     : Default Shipping
Error         : Row 4, 'Default Shipping': boolean field is required and must be true or false
Record        :
  Entity                         = CUST 12442
  Label                          = Main Office
  Default Shipping               = (empty)
  Default Billing                = false
```

Fields are padded to a fixed width of 30 characters (or the longest key, whichever is greater). Empty values are shown as `(empty)`; missing columns as `(column not in file)`.

### 5.8 Authentication Config

`server/config/auth.json` stores all three auth type configurations simultaneously; only `type` indicates which is active.

```json
{
  "type": "oauth2",
  "basic":  { "url": "", "accountId": "", "username": "", "password": "" },
  "oauth1": { "url": "", "accountId": "", "consumerKey": "", "consumerSecret": "", "tokenId": "", "tokenSecret": "" },
  "oauth2": {
    "url": "https://<accountId>.app.netsuite.com/app/login/oauth2/authorize",
    "tokenUrl": "https://<accountId>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token",
    "accountId": "",
    "clientId": "",
    "clientSecret": "",
    "redirectUri": "",
    "scope": "rest_webservices"
  }
}
```

**OAuth 2.0 endpoints (NetSuite):**

| Endpoint | URL pattern |
| --- | --- |
| Authorization URL | `https://{accountId}.app.netsuite.com/app/login/oauth2/authorize` |
| Token URL | `https://{accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token` |

The Test Connection endpoint (`POST /api/auth-config/test`) sends the form's current (unsaved) values to the server. The server makes a live HTTP request:

| Type | Request |
| --- | --- |
| Basic | `GET {url}` with `Authorization: Basic base64(user:pass)` |
| OAuth 1.0 | `GET {url}` with HMAC-SHA256 signed `Authorization: OAuth …` header |
| OAuth 2.0 | `POST {tokenUrl}` with `grant_type=client_credentials` body |

Any HTTP response (including 4xx) indicates the server is reachable. A network error means the URL is unreachable.

---

## 6. API Reference

### POST /api/instructions/generate

| | |
| --- | --- |
| Request | `multipart/form-data` · field `template` · one `.xlsx` file |
| 200 | `{ "instructionFile": "Address Template BTM.json", "template": { … } }` |
| 400 | `{ "error": "…" }` — missing file or parse failure |

### POST /api/instructions/generate-batch

| | |
| --- | --- |
| Request | `multipart/form-data` · field `templates` · one or more `.xlsx` files |
| 200 | `{ "succeeded": ["…"], "failed": [{ "file": "…", "error": "…" }] }` |

### GET /api/instructions

Returns `["Address Template BTM.json", …]`

### GET /api/instructions/:name

Returns the full instruction JSON object, or `404`.

### PUT /api/instructions/:name

| | |
| --- | --- |
| Request | `application/json` · full instruction object `{ file, template }` |
| 200 | `{ "ok": true }` |
| 400 | Invalid body or filename |

### POST /api/validate

| | |
| --- | --- |
| Request | `multipart/form-data` · field `dataFile` · field `instructionFile` (filename string) |
| 200 PASSED | `{ "status": "PASSED", "errorCount": 0 }` |
| 200 FAILED | `{ "status": "FAILED", "errorCount": N, "errors": […], "logFile": "…_error_YYYYMMDD_HHMMSS.logging" }` |
| 400 | Missing file, unsupported format, or missing instruction |
| 404 | Instruction file not found |

### GET /api/logs

Returns `[{ "name": "…", "modified": <ms>, "size": <bytes> }, …]` sorted newest first.

### GET /api/logs/:name

Returns log file content as `text/plain`.

### DELETE /api/logs/:name

Deletes a single log file.

### DELETE /api/logs

Deletes all `.logging` files. Returns `{ "deleted": N }`.

### GET /api/auth-config

Returns the full auth config object (all sections, regardless of active type).

### PUT /api/auth-config

Saves the auth config. Merges incoming sections with existing file to avoid overwriting unedited sections.

### POST /api/auth-config/test

| | |
| --- | --- |
| Request | Full auth config object (current form state, not necessarily saved) |
| 200 ok | `{ "ok": true, "message": "Connected — HTTP 200" }` |
| 200 fail | `{ "ok": false, "message": "HTTP 401 — credentials rejected by server" }` |

---

## 7. Workflow

```text
1.  Upload NetSuite template Excel files (single or batch)
    → Instruction JSON files generated in server/instructions/

2.  Open Edit Instructions
    → Set required fields, adjust types, add list values, set data file path

3.  Open Validate Data
    → Select instruction file, upload data file, review result

4.  If FAILED:
    → Error count and details shown in UI
    → Error log written to server/logging/<file>_error_YYYYMMDD_HHMMSS.logging

5.  Open Logs
    → Browse timestamped logs, sort by row, expand record detail
    → Delete reviewed logs individually or by selection

6.  Open Authentication
    → Enter NetSuite API credentials, test connection before saving
```

---

## 8. HTTP Response Codes

| Code | Meaning |
| --- | --- |
| 200 | Success |
| 400 | Bad request — invalid input, missing field, unsupported format |
| 404 | Resource not found |
| 500 | Unexpected server error |
