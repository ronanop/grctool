#!/usr/bin/env python3
"""
Script to create a sample Excel file for bulk importing questions
Run this script to generate questions_import_template.xlsx
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from pathlib import Path

def create_sample_excel():
    """Create a sample Excel file for bulk importing questions"""
    
    # Create a new workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Questions Import"
    
    # Define headers
    headers = [
        "compliance_framework",
        "department",
        "control_id",
        "control_name",
        "question_text",
        "question_id"
    ]
    
    # Add headers with styling
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
    
    # Sample data rows
    sample_data = [
        # ISO 27001 examples
        ["ISO 27001", "IT", "A.9.2.1", "Access control", "Do you have user access management procedures in place?", "a"],
        ["ISO 27001", "IT", "A.9.2.1", "Access control", "Are user access rights reviewed regularly (at least annually)?", "b"],
        ["ISO 27001", "IT", "A.9.2.1", "Access control", "Do you maintain an access control list for all systems?", "c"],
        ["ISO 27001", "IT", "A.9.2.2", "User access management", "Are user accounts created only after proper authorization?", "a"],
        ["ISO 27001", "IT", "A.9.2.2", "User access management", "Are user accounts deleted or disabled when employees leave?", "b"],
        ["ISO 27001", "IT", "A.9.2.2", "User access management", "Do you have a process for managing privileged access accounts?", "c"],
        ["ISO 27001", "IT", "A.9.4.2", "Secure log-on procedures", "Do you require strong passwords for all user accounts?", "a"],
        ["ISO 27001", "IT", "A.9.4.2", "Secure log-on procedures", "Is multi-factor authentication implemented for sensitive systems?", "b"],
        ["ISO 27001", "HR", "A.7.1.1", "Screening", "Do you perform background checks on new employees?", "a"],
        ["ISO 27001", "HR", "A.7.1.1", "Screening", "Are employment contracts signed before access is granted?", "b"],
        
        # SOC 2 examples
        ["SOC 2", "IT", "CC6.1", "Logical access controls", "Do you have logical access controls to protect against unauthorized access?", "a"],
        ["SOC 2", "IT", "CC6.1", "Logical access controls", "Are access controls reviewed periodically?", "b"],
        ["SOC 2", "IT", "CC6.2", "Authentication", "Is user authentication required for all system access?", "a"],
        ["SOC 2", "IT", "CC6.2", "Authentication", "Are authentication credentials encrypted in transit and at rest?", "b"],
        ["SOC 2", "IT", "CC6.6", "Data transmission", "Is data encrypted when transmitted over public networks?", "a"],
        
        # GDPR examples
        ["GDPR", "Legal", "Article 32", "Security of processing", "Do you implement appropriate technical measures to ensure data security?", "a"],
        ["GDPR", "Legal", "Article 32", "Security of processing", "Do you have encryption in place for personal data?", "b"],
        ["GDPR", "Legal", "Article 32", "Security of processing", "Are regular security assessments conducted?", "c"],
        ["GDPR", "Legal", "Article 33", "Notification of breach", "Do you have a process for detecting personal data breaches?", "a"],
        ["GDPR", "Legal", "Article 33", "Notification of breach", "Can you notify the supervisory authority within 72 hours of a breach?", "b"],
        
        # HIPAA examples
        ["HIPAA", "Healthcare", "164.312(a)(1)", "Access control", "Do you have unique user identification for all system users?", "a"],
        ["HIPAA", "Healthcare", "164.312(a)(1)", "Access control", "Are access controls implemented to allow only authorized access?", "b"],
        ["HIPAA", "Healthcare", "164.312(e)(1)", "Transmission security", "Is ePHI encrypted when transmitted electronically?", "a"],
        ["HIPAA", "Healthcare", "164.312(e)(1)", "Transmission security", "Do you have integrity controls to prevent unauthorized alteration of ePHI?", "b"],
    ]
    
    # Add sample data rows
    for row_idx, row_data in enumerate(sample_data, start=2):
        for col_idx, value in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
    
    # Set column widths for better readability
    ws.column_dimensions['A'].width = 20  # compliance_framework
    ws.column_dimensions['B'].width = 15  # department
    ws.column_dimensions['C'].width = 18  # control_id
    ws.column_dimensions['D'].width = 25  # control_name
    ws.column_dimensions['E'].width = 60  # question_text
    ws.column_dimensions['F'].width = 12  # question_id
    
    # Freeze the header row
    ws.freeze_panes = 'A2'
    
    # Add instructions in a separate sheet
    instructions_sheet = wb.create_sheet("Instructions", 0)
    instructions = [
        ["BULK IMPORT QUESTIONS - INSTRUCTIONS"],
        [""],
        ["Column Descriptions:"],
        ["A - compliance_framework: Name of the compliance framework (must exist in system)"],
        ["B - department: Name of the department (must exist in system)"],
        ["C - control_id: Control identifier (e.g., A.9.2.1, CC6.1)"],
        ["D - control_name: Name/description of the control"],
        ["E - question_text: The actual question text"],
        ["F - question_id: Optional - leave blank to auto-generate (a, b, c, ...)"],
        [""],
        ["Important Notes:"],
        ["1. Framework and department names must match exactly (case-sensitive)"],
        ["2. Controls will be auto-created if they don't exist"],
        ["3. Question IDs will be auto-generated if left blank"],
        ["4. Multiple questions can share the same control_id"],
        ["5. Remove example rows and add your own data"],
        ["6. Save the file as .xlsx format"],
        [""],
        ["Import Modes:"],
        ["- Create Only: Only creates new questions (skips existing)"],
        ["- Update Existing: Updates existing questions if found"],
        ["- Replace All: Deletes all questions for controls in file, then creates new ones"],
    ]
    
    for row_idx, row_data in enumerate(instructions, start=1):
        cell = instructions_sheet.cell(row=row_idx, column=1, value=row_data[0])
        if row_idx == 1:
            cell.font = Font(bold=True, size=14)
        elif row_data[0] and row_data[0].endswith(":"):
            cell.font = Font(bold=True)
    
    instructions_sheet.column_dimensions['A'].width = 80
    
    # Save the file
    output_path = Path(__file__).parent.parent / "questions_import_template.xlsx"
    wb.save(output_path)
    print(f"✅ Sample Excel file created: {output_path}")
    print(f"   File location: {output_path.absolute()}")
    print(f"   Total sample rows: {len(sample_data)}")
    print("\n📝 Next steps:")
    print("   1. Open the Excel file")
    print("   2. Review the sample data")
    print("   3. Replace with your own data")
    print("   4. Save the file")
    print("   5. Use 'Bulk Import' button in the admin panel to upload")

if __name__ == "__main__":
    create_sample_excel()
