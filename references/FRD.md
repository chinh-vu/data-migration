# Functional Requirement and Design Document

**Project:** BTM Data Templates — NetSuite Data Migration Validation Pipeline  
**Version:** 1.0  
**Date:** 2026-06-05

---

## 1. Purpose

This document describes the functional requirements and design of the PowerShell pipeline used to validate NetSuite data migration files before upload. The pipeline reduces manual review effort and catches formatting errors (missing required values, invalid booleans, exceeded field lengths) before they reach NetSuite.

---

## 2. Scope

The pipeline covers the following activities:

- Generating an instruction JSON file from a NetSuite template Excel file
- Batch-generating instruction JSON files for all templates in a folder
- Validating an Excel or CSV data file against an instruction JSON
- Logging all validation errors with full record detail

Out of scope: uploading files to NetSuite, modifying source data files, referential integrity checks against NetSuite lookup values.

---

## 3. Supported Templates

The following NetSuite template files are in scope:

| Template File | Instruction JSON |
|---|---|
| Address Template BTM.xlsx | Address Template BTM.json |
| BinTemplate BTM.xlsx | BinTemplate BTM.json |
| Chart of AccountsTemplate BTM.xlsx | Chart of AccountsTemplate BTM.json |
| ClassTemplate BTM.xlsx | ClassTemplate BTM.json |
| DepartmentTemplate BTM.xlsx | DepartmentTemplate BTM.json |
| Entity Bank DetailsTemplate BTM.xlsx | Entity Bank DetailsTemplate BTM.json |
| FAM Asset Template BTM.xlsx | FAM Asset Template BTM.json |
| FAM Asset Type Template BTM.xlsx | FAM Asset Type Template BTM.json |
| Journal Entry Template BTM.xlsx | Journal Entry Template BTM.json |
| LocationTemplate BTM.xlsx | LocationTemplate BTM.json |
| NetSuite LOOKUP.xlsx | NetSuite LOOKUP.json |
| Trial Balance Template BTM.xlsx | Trial Balance Template BTM.json |
| Unit of MeasureTemplate BTM.xlsx | Unit of MeasureTemplate BTM.json |

---

## 4. Functional Requirements

### 4.1 Instruction File Generation (`New-InstructionFile.ps1`)

| ID | Requirement |
|---|---|
| FR-01 | The script shall accept a mandatory `-TemplateFile` parameter pointing to a NetSuite template Excel file. |
| FR-02 | The script shall accept a mandatory `-OutputFile` parameter specifying where to write the instruction JSON. |
| FR-03 | The script shall read the first sheet of the template Excel only. |
| FR-04 | Row 1 of the template sheet shall be used as column attribute names (keys in the instruction JSON). |
| FR-05 | Row 3 shall determine `data_format`: `Boolean` maps to `boolean`; all others map to `string` unless Row 4 contains "Reference", in which case it maps to `list`. |
| FR-06 | Row 4 shall be parsed for max length (`Max Length N` → `"length": "N"`) and reference type (`*Reference` → `"reference": "reference"`). |
| FR-07 | All generated fields shall default to `"required": false`. The user sets `required: true` manually after generation. |
| FR-08 | The `"file"` key in the output JSON shall be an empty string. The user fills it in with the relative path to the data file. |
| FR-09 | The output directory shall be created automatically if it does not exist. |
| FR-10 | The script shall exit with code `1` and display an error if the template file is not found. |

### 4.2 Batch Instruction File Generation (`New-AllInstructionFiles.ps1`)

| ID | Requirement |
|---|---|
| FR-11 | The script shall accept a mandatory `-TemplatesPath` parameter pointing to a folder of template Excel files. |
| FR-12 | The script shall accept a mandatory `-OutputPath` parameter specifying the output folder. |
| FR-13 | The script shall process every `.xlsx` file found in `-TemplatesPath`. |
| FR-14 | Each output JSON file shall be named after its source template with `.json` replacing the `.xlsx` extension. |
| FR-15 | If any individual template fails, the error shall be reported and processing shall continue for remaining templates. |
| FR-16 | The script shall exit with code `1` if any template failed, `0` if all succeeded. |

### 4.3 Data File Validation (`Validate-File.ps1`)

| ID | Requirement |
|---|---|
| FR-17 | The script shall accept an optional `-InstructionFile` parameter (default: `..\instructions\address.json`). |
| FR-18 | The script shall accept an optional `-DataFile` parameter to override the data file path from the instruction JSON. |
| FR-19 | The script shall accept an optional `-LogFile` parameter. When omitted, the log file shall be derived as `<datafilename>_error.logging` in the same directory as the data file. |
| FR-20 | The script shall support Excel (`.xlsx`, `.xls`, `.xlsm`) and CSV (`.csv`) data files. |
| FR-21 | The script shall validate every row in the data file against every column defined in the instruction JSON. |
| FR-22 | The script shall exit with code `0` (PASSED) if no errors are found, or `1` (FAILED) if any errors exist. |
| FR-23 | The error log shall only be written when at least one error is found. |
| FR-24 | The error log shall contain one block per error with: error index, record number, attribute name, error message, and full record field values. |

### 4.4 Validation Rules

| ID | Rule |
|---|---|
| FR-25 | A `required: true` non-boolean field that is empty shall produce error: `required but empty`. |
| FR-26 | A `required: true` boolean field that is empty shall produce error: `boolean field is required and must be true or false`. |
| FR-27 | A boolean field with a non-empty value not in `{true, false, yes, no, t, f, 1, 0}` shall produce error: `expected boolean (true/false/yes/no/1/0)`. |
| FR-28 | A `string` field whose value length exceeds the defined `length` shall produce error: `value length N exceeds max M`. |
| FR-29 | A column defined as `required: true` that is entirely absent from the data file shall produce a schema-level error, and every row shall be logged with `(column not in file)`. |

---

## 5. Design

### 5.1 Folder Structure

```
BTM Data Templates\
  src\
    New-InstructionFile.ps1       # Single template → instruction JSON
    New-AllInstructionFiles.ps1   # Batch wrapper
    Validate-File.ps1             # Data file validator
  templates\                      # NetSuite Excel template files
  instructions\                   # Generated instruction JSON files
  samples\                        # Data files to be validated
  requirements\
    FRD.md                        # This document
    todo.md                       # Backlog
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
|---|---|---|
| `file` | string | Relative path from the JSON file to the data file. Filled in manually after generation. |
| `template` | object | Map of column name → field definition. |
| `data_format` | string | `string`, `boolean`, or `list`. |
| `length` | string | Maximum character length (string fields only). |
| `reference` | string | Always `"reference"` when present (list fields only). |
| `required` | boolean | Whether the field must be non-empty in every row. |

### 5.3 Template Sheet Row Mapping

| Excel Row | Content | Used For |
|---|---|---|
| 1 | Display attribute names | Column keys in instruction JSON |
| 2 | Internal NetSuite field IDs | Skipped |
| 3 | Data types (`Text` / `List` / `Boolean`) | `data_format` |
| 4 | `Max Length N` / `* Reference` / `List Value` | `length` / `reference` |
| 5 | Descriptions | Ignored |

### 5.4 JSON Parsing Design

`ConvertFrom-Json` is not used for reading instruction files because the JSON may contain duplicate keys (e.g. `label` and `Label` as distinct columns). Instead, `System.Runtime.Serialization.Json.JsonReaderWriterFactory` converts the JSON to XML, preserving duplicate keys as sibling elements.

Column names containing spaces are encoded by the WCF XML layer as `<a:item item="original name">`. The validator reads the `item` XML attribute to recover the original column name.

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

### 5.6 Script Parameters Summary

**`New-InstructionFile.ps1`**

| Parameter | Mandatory | Description |
|---|---|---|
| `-TemplateFile` | Yes | Path to the NetSuite template Excel file |
| `-OutputFile` | Yes | Path for the output instruction JSON |

**`New-AllInstructionFiles.ps1`**

| Parameter | Mandatory | Description |
|---|---|---|
| `-TemplatesPath` | Yes | Folder containing template `.xlsx` files |
| `-OutputPath` | Yes | Folder for output `.json` files |

**`Validate-File.ps1`**

| Parameter | Mandatory | Description |
|---|---|---|
| `-InstructionFile` | No | Path to instruction JSON (default: `..\instructions\address.json`) |
| `-DataFile` | No | Override data file path (default: value from instruction JSON `"file"` key) |
| `-LogFile` | No | Override log file path (default: `<datafilename>_error.logging` next to data file) |

---

## 6. Workflow

```
1. Place NetSuite template Excel files in templates\

2. Generate instruction JSON files:
   .\src\New-AllInstructionFiles.ps1 -TemplatesPath ".\templates" -OutputPath ".\instructions"

3. For each generated JSON:
   a. Set "file" to the relative path of the data file
   b. Set "required": true on mandatory fields

4. Place data files in samples\ (or any location)

5. Validate:
   .\src\Validate-File.ps1 -InstructionFile ".\instructions\<name>.json"

6. If exit code = 1, review <datafilename>_error.logging for error details
   Correct the data file and re-run validation
```

---

## 7. Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success / PASSED — no errors found |
| `1` | Failure / FAILED — one or more validation errors, or script error |
