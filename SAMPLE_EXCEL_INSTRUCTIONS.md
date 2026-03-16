# Sample Excel File for Bulk Import

## Quick Access

A sample CSV template has been created at: `backend/questions_import_template.csv`

## How to Use the CSV Template

### Option 1: Use CSV Directly
1. Open `backend/questions_import_template.csv` in Excel
2. Excel will automatically format it as a table
3. Replace the sample data with your own
4. Save as `.xlsx` format (File → Save As → Excel Workbook)
5. Upload via the Bulk Import feature

### Option 2: Create Excel File with Script

If you have `openpyxl` installed, run:

```bash
cd backend
pip install openpyxl
python scripts/create_sample_excel.py
```

This will create `backend/questions_import_template.xlsx` with:
- Formatted headers (colored, bold)
- Sample data for multiple compliance frameworks
- Instructions sheet
- Proper column widths
- Frozen header row

## Sample Data Included

The template includes examples for:

1. **ISO 27001** (IT & HR departments)
   - Access control (A.9.2.1)
   - User access management (A.9.2.2)
   - Secure log-on procedures (A.9.4.2)
   - Screening (A.7.1.1)

2. **SOC 2** (IT department)
   - Logical access controls (CC6.1)
   - Authentication (CC6.2)
   - Data transmission (CC6.6)

3. **GDPR** (Legal department)
   - Security of processing (Article 32)
   - Notification of breach (Article 33)

4. **HIPAA** (Healthcare department)
   - Access control (164.312(a)(1))
   - Transmission security (164.312(e)(1))

## Column Format

| Column | Header | Example | Required |
|--------|--------|---------|----------|
| A | compliance_framework | ISO 27001 | Yes |
| B | department | IT | Yes |
| C | control_id | A.9.2.1 | Yes |
| D | control_name | Access control | Yes |
| E | question_text | Do you have user access management procedures? | Yes |
| F | question_id | a | No (auto-generated if blank) |

## Important Notes

1. **Framework & Department Names**: Must match exactly (case-sensitive) with what's in your system
2. **Control Auto-Creation**: Controls will be automatically created if they don't exist
3. **Question ID**: Leave blank to auto-generate (a, b, c, ...)
4. **Multiple Questions**: You can have multiple rows with the same control_id
5. **File Format**: Must be `.xlsx` for upload (CSV can be converted in Excel)

## Steps to Use

1. **Open the template** (`backend/questions_import_template.csv`)
2. **Review the sample data** to understand the format
3. **Replace with your data**:
   - Keep the header row
   - Replace sample rows with your questions
   - Ensure framework and department names match your system
4. **Save as Excel** (File → Save As → Excel Workbook → .xlsx)
5. **Upload** via Admin → Questions → Bulk Import

## Example Row

```
ISO 27001 | IT | A.9.2.1 | Access control | Do you have user access management procedures? | a
```

This creates:
- A question under ISO 27001 framework
- For IT department
- Under control A.9.2.1 (Access control)
- With question ID "a"

## Need More Examples?

The template includes 24 sample questions across 4 compliance frameworks. Use these as a reference for formatting your own data.
