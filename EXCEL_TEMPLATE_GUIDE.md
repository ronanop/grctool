# Excel Template for Bulk Import Questions

## Quick Start

1. **Download the template** using the "Download Template" button in the Questions admin page
2. **Fill in your data** following the format below
3. **Upload the file** using the "Bulk Import" button

## Excel File Structure

### Column Headers (Row 1):
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| compliance_framework | department | control_id | control_name | question_text | question_id |

### Required Columns:

1. **Column A: compliance_framework**
   - The exact name of the compliance framework
   - Must exist in the system (create it first via Compliance Frameworks page)
   - Examples: "ISO 27001", "SOC 2", "GDPR", "HIPAA"
   - Case-sensitive

2. **Column B: department**
   - The exact name of the department
   - Must exist in the system (create it first via Departments page)
   - Examples: "IT", "HR", "Finance", "Legal"
   - Case-sensitive

3. **Column C: control_id**
   - The control identifier
   - Format depends on framework (e.g., "A.9.2.1" for ISO 27001, "CC6.1" for SOC 2)
   - Required

4. **Column D: control_name**
   - The name/description of the control
   - Examples: "Access control", "Data encryption", "User access management"
   - Required

5. **Column E: question_text**
   - The actual question text
   - Required
   - Can be multiple rows for the same control (multiple questions per control)

### Optional Column:

6. **Column F: question_id** (Optional)
   - Custom question ID (e.g., "a", "b", "c")
   - If not provided, will auto-generate sequentially (a, b, c, ..., z, aa, ab, ...)
   - Must be unique within the same control

## Example Data

| compliance_framework | department | control_id | control_name | question_text | question_id |
|---------------------|------------|------------|--------------|---------------|-------------|
| ISO 27001 | IT | A.9.2.1 | Access control | Do you have user access management procedures in place? | a |
| ISO 27001 | IT | A.9.2.1 | Access control | Are user access rights reviewed regularly? | b |
| ISO 27001 | IT | A.9.2.1 | Access control | Do you maintain an access control list? | c |
| ISO 27001 | IT | A.9.2.2 | User access management | Are user accounts created only after proper authorization? | a |
| ISO 27001 | IT | A.9.2.2 | User access management | Are user accounts deleted or disabled when no longer needed? | b |
| SOC 2 | IT | CC6.1 | Logical access controls | Do you have logical access controls to protect against unauthorized access? | a |
| SOC 2 | IT | CC6.1 | Logical access controls | Are access controls reviewed periodically? | b |
| GDPR | Legal | Article 32 | Security of processing | Do you implement appropriate technical measures to ensure data security? | a |
| GDPR | Legal | Article 32 | Security of processing | Do you have encryption in place for personal data? | b |

## Step-by-Step Instructions

### Step 1: Prepare Your Data

1. Open Excel (or Google Sheets, then download as .xlsx)
2. Create a new workbook
3. In Row 1, add the headers:
   - A1: `compliance_framework`
   - B1: `department`
   - C1: `control_id`
   - D1: `control_name`
   - E1: `question_text`
   - F1: `question_id` (optional)

### Step 2: Fill in Your Data

Starting from Row 2, fill in your questions:

- **Same control, multiple questions**: Use the same `control_id` and `control_name` for multiple rows
- **Different controls**: Use different `control_id` values
- **Question IDs**: Leave blank to auto-generate, or specify (a, b, c, etc.)

### Step 3: Verify Data

Before importing:
- ✅ All required columns are filled
- ✅ Framework names match exactly (case-sensitive)
- ✅ Department names match exactly (case-sensitive)
- ✅ No empty rows in the middle of data
- ✅ File is saved as .xlsx format

### Step 4: Import

1. Go to Admin → Questions page
2. Click "Bulk Import" button
3. Select your Excel file
4. Wait for import to complete
5. Review the results:
   - Success count
   - Failed rows (check console for details)
   - Warnings

## Import Modes

When importing, you can choose:

1. **Create Only** (default)
   - Only creates new questions
   - Skips existing questions (by control_id + question_id)
   - Safe for re-running imports

2. **Update Existing**
   - Updates existing questions if found
   - Creates new ones if not found
   - Useful for updating question text

3. **Replace All**
   - Deletes ALL existing questions for controls in the file
   - Then creates new questions from the file
   - Use with caution!

## Common Issues & Solutions

### Issue: "Compliance framework 'X' not found"
**Solution**: Create the framework first via Admin → Compliance Frameworks

### Issue: "Department 'Y' not found"
**Solution**: Create the department first via Admin → Departments

### Issue: "Missing required fields"
**Solution**: Check that all columns A-E have values (F is optional)

### Issue: "Question already exists"
**Solution**: 
- Use "Update Existing" mode to update
- Or change the question_id in column F
- Or use "Replace All" mode to replace all questions for that control

### Issue: File not uploading
**Solution**: 
- Ensure file is .xlsx format (not .xls or .csv)
- Check file size (max 10MB)
- Ensure file is not open in Excel

## Tips

1. **Start Small**: Test with 5-10 questions first
2. **Use Templates**: Download the template to ensure correct format
3. **Check Names**: Framework and department names must match exactly
4. **Auto-Generate IDs**: Leave question_id blank to auto-generate
5. **Group by Control**: Put all questions for the same control together
6. **Backup First**: Export existing questions before bulk operations

## File Size Limits

- Maximum file size: 10MB
- Maximum rows: 10,000 questions
- Supported formats: `.xlsx` (Excel 2007+)

## Need Help?

If you encounter issues:
1. Check the import results for specific error messages
2. Review the console for detailed error logs
3. Verify your Excel file matches the template format
4. Ensure all frameworks and departments exist in the system
