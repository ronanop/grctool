# Example: Multiple Control IDs in Bulk Import

This document shows how to structure your Excel file when you have **multiple control IDs** with **multiple questions per control**.

## Key Concepts

1. **Same Control ID, Multiple Questions**: Use the same `control_id` and `control_name` for multiple rows, but different `question_id` values
2. **Different Control IDs**: Each unique `control_id` represents a different control
3. **Multiple Controls per Framework**: You can have many different controls within the same compliance framework and department

## Example Structure

### Example 1: Multiple Questions for Same Control

```
ISO 27001 | IT | A.9.2.1 | Access control | Question 1 | a
ISO 27001 | IT | A.9.2.1 | Access control | Question 2 | b
ISO 27001 | IT | A.9.2.1 | Access control | Question 3 | c
ISO 27001 | IT | A.9.2.1 | Access control | Question 4 | d
```

**Result**: Creates 4 questions under control A.9.2.1

### Example 2: Multiple Different Controls

```
ISO 27001 | IT | A.9.2.1 | Access control | Question 1 | a
ISO 27001 | IT | A.9.2.2 | User access management | Question 1 | a
ISO 27001 | IT | A.9.4.2 | Secure log-on procedures | Question 1 | a
ISO 27001 | IT | A.12.4.1 | Event logging | Question 1 | a
```

**Result**: Creates 4 different controls, each with 1 question

### Example 3: Mixed - Multiple Controls with Multiple Questions Each

```
ISO 27001 | IT | A.9.2.1 | Access control | Question 1 | a
ISO 27001 | IT | A.9.2.1 | Access control | Question 2 | b
ISO 27001 | IT | A.9.2.1 | Access control | Question 3 | c
ISO 27001 | IT | A.9.2.2 | User access management | Question 1 | a
ISO 27001 | IT | A.9.2.2 | User access management | Question 2 | b
ISO 27001 | IT | A.9.2.2 | User access management | Question 3 | c
ISO 27001 | IT | A.9.4.2 | Secure log-on procedures | Question 1 | a
ISO 27001 | IT | A.9.4.2 | Secure log-on procedures | Question 2 | b
```

**Result**: 
- Control A.9.2.1 has 3 questions (a, b, c)
- Control A.9.2.2 has 3 questions (a, b, c)
- Control A.9.4.2 has 2 questions (a, b)

## Real-World Example from Template

The template includes:

### ISO 27001 - IT Department

**Control A.9.2.1 (Access control)** - 4 questions:
- a: Do you have user access management procedures in place?
- b: Are user access rights reviewed regularly?
- c: Do you maintain an access control list?
- d: Are access rights removed when employees change roles?

**Control A.9.2.2 (User access management)** - 4 questions:
- a: Are user accounts created only after proper authorization?
- b: Are user accounts deleted when employees leave?
- c: Do you have a process for managing privileged access?
- d: Are privileged accounts reviewed regularly?

**Control A.9.4.2 (Secure log-on procedures)** - 3 questions:
- a: Do you require strong passwords?
- b: Is multi-factor authentication implemented?
- c: Are failed login attempts logged?

**Control A.12.4.1 (Event logging)** - 3 questions:
- a: Do you maintain audit logs?
- b: Are audit logs protected from tampering?
- c: Are audit logs reviewed regularly?

**Control A.12.6.1 (Vulnerability management)** - 3 questions:
- a: Do you have a process for identifying vulnerabilities?
- b: Are security patches applied within timeframes?
- c: Do you maintain an inventory of software?

### ISO 27001 - HR Department

**Control A.7.1.1 (Screening)** - 2 questions:
- a: Do you perform background checks?
- b: Are employment contracts signed before access?

**Control A.7.1.2 (Terms and conditions)** - 2 questions:
- a: Do contracts include security responsibilities?
- b: Are confidentiality agreements required?

### ISO 27001 - Finance Department

**Control A.10.1.1 (Documented procedures)** - 2 questions:
- a: Do you have documented procedures?
- b: Are procedures reviewed regularly?

**Control A.10.1.2 (Change management)** - 2 questions:
- a: Do you have a change management process?
- b: Are changes tested before implementation?

## Pattern Summary

```
Framework | Department | Control ID | Control Name | Question | ID
----------|------------|------------|--------------|----------|----
ISO 27001 | IT         | A.9.2.1    | Access       | Q1       | a
ISO 27001 | IT         | A.9.2.1    | Access       | Q2       | b
ISO 27001 | IT         | A.9.2.1    | Access       | Q3       | c
ISO 27001 | IT         | A.9.2.2    | User mgmt    | Q1       | a
ISO 27001 | IT         | A.9.2.2    | User mgmt    | Q2       | b
ISO 27001 | IT         | A.9.4.2    | Log-on       | Q1       | a
```

## Important Notes

1. **Question IDs are per control**: Each control starts with question_id "a"
2. **Same control_id = same control**: All rows with A.9.2.1 belong to the same control
3. **Different control_id = different control**: A.9.2.1 and A.9.2.2 are different controls
4. **Auto-generation**: If you leave question_id blank, it auto-generates sequentially per control
5. **Order doesn't matter**: You can mix controls in any order, the system groups them correctly

## Best Practices

1. **Group by control**: Put all questions for the same control together (easier to read)
2. **Consistent naming**: Use the same `control_name` for all rows with the same `control_id`
3. **Sequential IDs**: Use a, b, c, d... for question IDs within each control
4. **Leave blank for auto**: You can leave question_id blank and let the system auto-generate

## Example: Complete Import

If you import this data:

```
ISO 27001 | IT | A.9.2.1 | Access control | Q1 | a
ISO 27001 | IT | A.9.2.1 | Access control | Q2 | b
ISO 27001 | IT | A.9.2.2 | User mgmt | Q1 | a
ISO 27001 | IT | A.9.2.2 | User mgmt | Q2 | b
```

**Result in System**:
- **Control A.9.2.1** (Access control) with 2 questions
- **Control A.9.2.2** (User mgmt) with 2 questions

Total: 2 controls, 4 questions
