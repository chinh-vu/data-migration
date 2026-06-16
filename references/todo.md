# Functional Requirement and Design Document

---

## 1. Purpose

This document describes the functional requirements and design of the web application pipeline with `reactjs` as UI and `nodejs` as a server used to validate NetSuite data migration files before upload. The pipeline reduces manual review effort and catches formatting errors (missing required values, invalid booleans, exceeded field lengths) before they reach NetSuite.

---

## 2. Scope

The pipeline covers the following activities:

- Generating an instruction JSON file from a NetSuite template Excel file
- Batch-generating instruction JSON files for all templates in a folder
- Validating an Excel or CSV data file against an instruction JSON
- Logging all validation errors with full record detail

Out of scope: uploading files to NetSuite, modifying source data files, referential integrity checks against NetSuite lookup values.

---

## 3. Functional Requirements

### 3.1 Instruction File Generation

| ID | Requirement |
| --- | --- |
| FR-01 | The UI shall allow a NetSuite template Excel file to be uploaded. |
| FR-02 | The server shall automatically save the generated instruction JSON to the `instructions/` directory, named after the uploaded template file (`.xlsx` → `.json`). |
| FR-03 | The server shall read the first sheet of the template Excel only. |
| FR-04 | Row 1 of the template sheet shall be used as column attribute names (keys in the instruction JSON). |
| FR-05 | Row 3 shall determine `data_format`: `Boolean` maps to `boolean`; all others map to `string` unless Row 4 contains "Reference", in which case it maps to `list`. |
| FR-06 | Row 4 shall be parsed for max length (`Max Length N` → `"length": "N"`) and reference type (`*Reference` → `"reference": "reference"`). |
| FR-07 | All generated fields shall default to `"required": false`. The user sets `required: true` manually after generation. |
| FR-08 | The `"file"` key in the output JSON shall be an empty string. |
| FR-09 | The `instructions/` directory shall be created automatically if it does not exist. |
| FR-10 | The server shall return an HTTP 400 error response if the template file is missing or cannot be parsed. |

### 3.2 Batch Instruction File Generation

| ID | Requirement |
| --- | --- |
| FR-11 | The UI shall allow multiple template Excel files to be uploaded in a single batch operation. |
| FR-12 | The server shall process every uploaded `.xlsx` file and generate a corresponding instruction JSON. |
| FR-13 | Each output JSON file shall be named after its source template with `.json` replacing the `.xlsx` extension. |
| FR-14 | If any individual template fails, the error shall be reported and processing shall continue for remaining templates. |
| FR-15 | The server shall return a summary response listing succeeded and failed template conversions. |

### 3.3 Data File Validation

| ID | Requirement |
| --- | --- |
| FR-16 | The UI shall allow the user to select an instruction JSON from the list of files available on the server. |
| FR-17 | The UI shall allow a data file to be uploaded for validation. |
| FR-18 | The error log shall be written as `<datafilename>_error.logging` inside a `logging/` subdirectory adjacent to the data file. The `logging/` directory shall be created if it does not exist. |
| FR-19 | The server shall support Excel (`.xlsx`, `.xls`, `.xlsm`) and CSV (`.csv`) data files. |
| FR-20 | The server shall validate every row in the data file against every column defined in the instruction JSON. |
| FR-21 | The server shall return a `PASSED` result if no errors are found, or a `FAILED` result with error details if any errors exist. |
| FR-22 | The error log shall only be written when at least one error is found. |
| FR-23 | The error log shall contain one block per error with: error index, record number, attribute name, error message, and full record field values. |

### 3.4 Validation Rules

| ID | Rule |
| --- | --- |
| FR-24 | A `required: true` non-boolean field that is empty shall produce error: `required but empty`. |
| FR-25 | A `required: true` boolean field that is empty shall produce error: `boolean field is required and must be true or false`. |
| FR-26 | A boolean field with a non-empty value not in `{true, false, yes, no, t, f, 1, 0}` shall produce error: `expected boolean (true/false/yes/no/1/0)`. |
| FR-27 | A `string` field whose value length exceeds the defined `length` shall produce error: `value length N exceeds max M`. |
| FR-28 | A column defined as `required: true` that is entirely absent from the data file shall produce a schema-level error, and every row shall be logged with `(column not in file)`. |

---

## 5. Design

- Application shall be implemented as a single page web application where:
  - `ReactJS` as the selected technology for Front End
  - `NodeJS` as the selected technology for Back End
- Application shall be executed concurrently
- Application shall be monitored for restarting upon change during development

### 5.1 Folder Structure

```text
data-migration\
  ui\
    src\                            # React application source
  server\
    src\                            # Node.js server source
    templates\                      # NetSuite Excel template files
    instructions\                   # Generated instruction JSON files
    samples\                        # Data files to be validated
  references\
    FRD.md                          # Original PowerShell FRD (for reference)
    todo.md                         # This document
```

### 5.2 Instruction JSON Schema

```json
{
    "file": "../samples/address.xlsx",
    "template": {
        "Entity": {
            "data_format": "list",
            "reference": "reference",
            "required": false
        },
        "Label": {
            "data_format": "string",
            "length": "150",
            "required": false
        },
        "Default Shipping": {
            "data_format": "boolean",
            "required": true
        }
    }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `file` | string | Relative path from the JSON file to the data file. Filled in manually after generation. |
| `template` | object | Map of column name → field definition. |
| `data_format` | string | `string`, `boolean`, or `list`. |
| `length` | string | Maximum character length (string fields only). |
| `reference` | string | Always `"reference"` when present (list fields only). |
| `required` | boolean | Whether the field must be non-empty in every row. |

### 5.3 Template Sheet Row Mapping

| Excel Row | Content | Used For |
| --- | --- | --- |
| 1 | Display attribute names | Column keys in instruction JSON |
| 2 | Internal NetSuite field IDs | Skipped |
| 3 | Data types (`Text` / `List` / `Boolean`) | `data_format` |
| 4 | `Max Length N` / `* Reference` / `List Value` | `length` / `reference` |
| 5 | Descriptions | Ignored |

### 5.4 JSON Parsing Design

Node.js's `JSON.parse` does not preserve duplicate keys — if a template has two columns that differ only in case (e.g. `label` and `Label`), the second value silently overwrites the first. The server shall use a custom streaming parser or reviver that collects all keys into an ordered array before validation, preserving duplicate keys as distinct entries.

### 5.5 Error Log Format

One block per error is appended to `<datafilename>_error.logging`:

```
------------------------------------------------------------
Error #1
------------------------------------------------------------
Record Number : 3
Attribute     : Default Shipping
Error         : Row 3, 'Default Shipping': boolean field is required and must be true or false
Record        :
  Entity                         = CUST 12442
  Label                          = Main Office
  Default Shipping               = (empty)
  Default Billing                = false
```

For schema-level errors (column absent from file), every row is logged and the missing column is shown as `(column not in file)`.

### 5.6 API Endpoint Summary

#### POST /api/instructions/generate

| Field | Description |
| --- | --- |
| Request | `multipart/form-data` with one template Excel file |
| Response 200 | `{ "instructionFile": "Address Template BTM.json", "template": { ... } }` |
| Response 400 | `{ "error": "Template file not found or unreadable" }` |

#### POST /api/instructions/generate-batch

| Field | Description |
| --- | --- |
| Request | `multipart/form-data` with multiple template Excel files |
| Response 200 | `{ "succeeded": ["..."], "failed": [{ "file": "...", "error": "..." }] }` |

#### GET /api/instructions

| Field | Description |
| --- | --- |
| Response 200 | `[ "Address Template BTM.json", "BinTemplate BTM.json", ... ]` |

#### GET /api/instructions/:name

| Field | Description |
| --- | --- |
| Response 200 | Full instruction JSON content for the named file |
| Response 404 | `{ "error": "Instruction file not found" }` |

#### POST /api/validate

| Field | Description |
| --- | --- |
| Request | `multipart/form-data` with data file + `instructionFile` (name of server-side JSON) |
| Response 200 PASSED | `{ "status": "PASSED", "errorCount": 0 }` |
| Response 200 FAILED | `{ "status": "FAILED", "errorCount": N, "errors": [...], "logFile": "..." }` |
| Response 400 | `{ "error": "Unsupported file format or missing instruction file" }` |

---

## 6. Workflow

```text
1. Upload NetSuite template Excel files via the UI (single or batch)
   → Server generates instruction JSON files in server/instructions/

2. Review generated instruction JSON files as needed:
   - Set "required": true on mandatory fields

3. Place data files to validate in server/samples/ (or upload directly)

4. In the UI, select an instruction JSON and upload a data file

5. Server validates and returns a result:
   - PASSED: no errors; UI shows success
   - FAILED: UI shows error count; error log written to logging/ next to data file

6. If FAILED, review the error log, correct the data file, and re-validate
```

---

## 7. HTTP Response Codes

| Code | Meaning |
| --- | --- |
| `200` | Success — instruction generated or validation completed (PASSED or FAILED result) |
| `400` | Bad request — invalid or missing file, unsupported format |
| `404` | Not found — requested instruction file does not exist |
| `500` | Server error — unexpected processing failure |
