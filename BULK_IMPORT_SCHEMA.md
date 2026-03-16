# Bulk Import Questions Schema for Excel

## Excel File Format

Create an Excel file (`.xlsx`) with the following columns in the exact order:

### Required Columns:

1. **compliance_framework** (Column A)
   - The name of the compliance framework (e.g., "ISO 27001", "SOC 2", "GDPR")
   - Must match an existing framework name in the system
   - Case-sensitive

2. **department** (Column B)
   - The name of the department (e.g., "IT", "HR", "Finance")
   - Must match an existing department name in the system
   - Case-sensitive

3. **control_id** (Column C)
   - The control identifier (e.g., "A.9.2.1", "CC6.1", "Article 32")
   - Format depends on the compliance framework
   - Required

4. **control_name** (Column D)
   - The name/description of the control (e.g., "Access control", "Data encryption")
   - Required

5. **question_text** (Column E)
   - The actual question text
   - Required
   - Can be multiple rows for the same control (multiple questions per control)

### Optional Columns:

6. **question_id** (Column F) - Optional
   - Custom question ID (e.g., "a", "b", "c")
   - If not provided, will auto-generate sequentially (a, b, c, ..., z, aa, ab, ...)
   - Must be unique within the same control

## Example Excel Data:

| compliance_framework | department | control_id | control_name | question_text | question_id |
|---------------------|------------|------------|--------------|---------------|-------------|
| ISO 27001 | IT | A.9.2.1 | Access control | Do you have user access management procedures in place? | a |
| ISO 27001 | IT | A.9.2.1 | Access control | Are user access rights reviewed regularly? | b |
| ISO 27001 | IT | A.9.2.2 | User access management | Are user accounts created only after proper authorization? | a |
| SOC 2 | IT | CC6.1 | Logical access controls | Do you have logical access controls to protect against unauthorized access? | a |
| GDPR | Legal | Article 32 | Security of processing | Do you implement appropriate technical measures to ensure data security? | a |

## Notes:

1. **Header Row**: The first row must contain the column headers exactly as shown above
2. **Empty Rows**: Empty rows will be skipped
3. **Auto-Creation**: 
   - If a compliance framework doesn't exist, the import will fail (create it first via admin panel)
   - If a department doesn't exist, the import will fail (create it first via admin panel)
   - If a control doesn't exist, it will be auto-created
   - If a question already exists (same control + question_id), it will be skipped or updated (depending on import mode)
4. **Question ID Generation**: If question_id is not provided, the system will auto-generate sequential IDs (a, b, c, etc.) for each control
5. **Validation**: 
   - All required fields must be filled
   - Framework and department names must match exactly (case-sensitive)
   - Control IDs must be unique within the same department and framework combination

## Import Modes:

1. **Create Only**: Only creates new questions, skips existing ones
2. **Update Existing**: Updates existing questions if they match (by control_id + question_id)
3. **Replace All**: Deletes all existing questions for the specified controls and creates new ones

## File Size Limits:

- Maximum file size: 10MB
- Maximum rows: 10,000 questions
- Supported formats: `.xlsx` (Excel 2007+)

## Error Handling:

The import will return a detailed report showing:
- Total rows processed
- Successfully imported questions
- Failed rows with error messages
- Warnings (e.g., skipped duplicates)
