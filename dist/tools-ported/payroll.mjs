// src/tools/payroll.ts
// MODULE 9: Payroll — 20 tools for complete payroll management
import { z } from 'zod';
import { XmlBuilder } from '../tally-ported/xml-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
const dateRangeSchema = {
    from_date: z.string().describe('Start date (YYYYMMDD)'),
    to_date: z.string().describe('End date (YYYYMMDD)'),
};
export function registerPayrollTools(server, client, state) {
    let count = 0;
    const getCompany = () => state.activeCompany || undefined;
    const sv = (from, to) => ({
        SVFROMDATE: from, SVTODATE: to,
        ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
    });
    // ── 1. tally_create_employee ──────────────────────────────────
    server.tool('tally_create_employee', 'Create an employee master in TallyPrime.', {
        name: z.string().describe('Employee name'),
        employee_group: z.string().optional().describe('Employee group (default: primary group)'),
        date_of_joining: z.string().optional().describe('Date of joining (YYYYMMDD)'),
        designation: z.string().optional().describe('Designation'),
        function: z.string().optional().describe('Function/Department'),
        location: z.string().optional().describe('Location'),
        gender: z.enum(['Male', 'Female', 'Other']).optional().describe('Gender'),
        date_of_birth: z.string().optional().describe('Date of birth (YYYYMMDD)'),
        blood_group: z.string().optional().describe('Blood group'),
        father_name: z.string().optional().describe("Father's name"),
        pan: z.string().optional().describe('PAN number'),
        aadhar: z.string().optional().describe('Aadhar number'),
        bank_account: z.string().optional().describe('Bank account number'),
        bank_ifsc: z.string().optional().describe('Bank IFSC code'),
        uan: z.string().optional().describe('Universal Account Number (PF)'),
        esi_number: z.string().optional().describe('ESI number'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildEmployeeXml(params);
            const response = await client.importMasters(xml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 2. tally_alter_employee ───────────────────────────────────
    server.tool('tally_alter_employee', 'Update an existing employee record.', {
        name: z.string().describe('Current employee name'),
        new_name: z.string().optional().describe('New name'),
        designation: z.string().optional().describe('New designation'),
        function: z.string().optional().describe('New function/department'),
        location: z.string().optional().describe('New location'),
        date_of_leaving: z.string().optional().describe('Date of leaving (YYYYMMDD)'),
        pan: z.string().optional().describe('Updated PAN'),
        bank_account: z.string().optional().describe('Updated bank account'),
        bank_ifsc: z.string().optional().describe('Updated IFSC'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildEmployeeXml({ ...params, action: 'alter' });
            const response = await client.importMasters(xml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 3. tally_list_employees ───────────────────────────────────
    server.tool('tally_list_employees', 'List all employees with basic details.', {
        employee_group: z.string().optional().describe('Filter by employee group'),
    }, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'Employee',
                fetchFields: ['Name', 'Parent', 'DateOfJoining', 'Designation', 'Function', 'Location'],
                ...(params.employee_group ? { filters: { GroupFilter: `$Parent = "${params.employee_group}"` } } : {}),
            });
            const response = await client.queryCollection(config, {
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
            });
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 4. tally_get_employee_detail ──────────────────────────────
    server.tool('tally_get_employee_detail', 'Get full details of a specific employee.', { employee_name: z.string().describe('Employee name') }, async (params) => {
        try {
            const response = await client.exportObject('Employee', params.employee_name, [], {
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
            });
            return result({ status: 'success', data: XmlParser.extractObjectData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 5. tally_create_employee_group ────────────────────────────
    server.tool('tally_create_employee_group', 'Create an employee group (e.g. Department, Division).', {
        name: z.string().describe('Employee group name'),
        parent: z.string().optional().describe('Parent group'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildEmployeeGroupXml(params);
            const response = await client.importMasters(xml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 6. tally_create_pay_head ──────────────────────────────────
    server.tool('tally_create_pay_head', 'Create a pay head (Earnings, Deductions, Employer contributions).', {
        name: z.string().describe('Pay head name (e.g. "Basic Pay", "HRA", "PF Deduction")'),
        pay_type: z.enum(['Earnings', 'Deductions', 'Employer Statutory Contributions']).describe('Pay head type'),
        income_type: z.string().optional().describe('Income type for tax (e.g. "Fixed", "Variable")'),
        calculation_type: z.enum(['As Computed Value', 'As User Defined Value', 'Flat Rate', 'On Current Earnings Total', 'On Specified Formula']).optional().describe('How the amount is calculated'),
        computation_formula: z.string().optional().describe('Formula (e.g. percentage on basic)'),
        under: z.string().optional().describe('Under group (e.g. "Current Liabilities" or "Indirect Expenses")'),
        affect_net_salary: z.boolean().optional().describe('Whether this affects net salary'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildPayHeadXml(params);
            const response = await client.importMasters(xml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 7. tally_list_pay_heads ───────────────────────────────────
    server.tool('tally_list_pay_heads', 'List all pay heads defined in the company.', {}, async () => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'PayHead',
                fetchFields: ['Name', 'Parent', 'PayType', 'CalculationType'],
            });
            const response = await client.queryCollection(config, {
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
            });
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 8. tally_create_salary_structure ──────────────────────────
    server.tool('tally_create_salary_structure', 'Set salary structure for an employee (assign pay heads with amounts/percentages).', {
        employee_name: z.string().describe('Employee name'),
        effective_date: z.string().describe('Effective date (YYYYMMDD)'),
        pay_components: z.array(z.object({
            pay_head: z.string().describe('Pay head name'),
            amount: z.number().optional().describe('Fixed amount per month'),
            percentage: z.number().optional().describe('Percentage (if computed)'),
        })).describe('Salary components'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildEmployeeXml({
                name: params.employee_name,
                action: 'alter',
                salary_details: params.pay_components.map(c => ({
                    pay_head: c.pay_head,
                    amount: c.amount,
                    percentage: c.percentage,
                    effective_from: params.effective_date,
                })),
            });
            const response = await client.importMasters(xml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 9. tally_process_payroll ──────────────────────────────────
    server.tool('tally_process_payroll', 'Process payroll for a month — creates payroll vouchers for all/specified employees.', {
        month: z.string().describe('Payroll month (YYYYMM, e.g. "202401")'),
        employee_names: z.array(z.string()).optional().describe('Specific employees (omit for all)'),
        narration: z.string().optional().describe('Narration'),
    }, async (params) => {
        try {
            const year = parseInt(params.month.substring(0, 4));
            const month = parseInt(params.month.substring(4, 6));
            const lastDay = new Date(year, month, 0).getDate();
            const date = `${params.month}${String(lastDay).padStart(2, '0')}`;
            const payrollEntries = (params.employee_names || []).map(emp => ({
                employee_name: emp,
            }));
            const voucherXml = XmlBuilder.buildVoucherXml({
                voucher_type: 'Payroll',
                date,
                narration: params.narration || `Payroll for ${params.month}`,
                payroll_entries: payrollEntries.length > 0 ? payrollEntries : undefined,
            });
            const response = await client.importVouchers(voucherXml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 10. tally_create_attendance_voucher ───────────────────────
    server.tool('tally_create_attendance_voucher', 'Create an attendance voucher for tracking employee attendance/leave.', {
        date: z.string().describe('Attendance date (YYYYMMDD)'),
        entries: z.array(z.object({
            employee_name: z.string().describe('Employee name'),
            attendance_type: z.string().describe('Attendance type (e.g. "Present", "Leave", "Half Day")'),
            value: z.number().describe('Number of days'),
        })).describe('Attendance entries'),
        narration: z.string().optional().describe('Narration'),
    }, async (params) => {
        try {
            const voucherXml = XmlBuilder.buildVoucherXml({
                voucher_type: 'Attendance',
                date: params.date,
                narration: params.narration,
                attendance_entries: params.entries.map(e => ({
                    employee_name: e.employee_name,
                    attendance_type: e.attendance_type,
                    value: e.value,
                })),
            });
            const response = await client.importVouchers(voucherXml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 11. tally_get_payslip ─────────────────────────────────────
    server.tool('tally_get_payslip', 'Get payslip details for an employee for a given month.', {
        employee_name: z.string().describe('Employee name'),
        month: z.string().describe('Month (YYYYMM)'),
    }, async (params) => {
        try {
            const year = parseInt(params.month.substring(0, 4));
            const month = parseInt(params.month.substring(4, 6));
            const lastDay = new Date(year, month, 0).getDate();
            const fromDate = `${params.month}01`;
            const toDate = `${params.month}${String(lastDay).padStart(2, '0')}`;
            const response = await client.exportReport('Payslip', {
                ...sv(fromDate, toDate),
                DSPEMPLOYEE: params.employee_name,
            });
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 12. tally_get_payroll_register ────────────────────────────
    server.tool('tally_get_payroll_register', 'Get payroll register for a period — all employees, all components.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('Payroll Register', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 13. tally_get_pay_sheet ───────────────────────────────────
    server.tool('tally_get_pay_sheet', 'Get pay sheet — compact summary of earnings/deductions for all employees.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('Pay Sheet', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 14. tally_get_attendance_report ───────────────────────────
    server.tool('tally_get_attendance_report', 'Get attendance report showing days present/absent/leave for employees.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('Attendance', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 15. tally_get_pf_report ───────────────────────────────────
    server.tool('tally_get_pf_report', 'Get Provident Fund (PF/EPF) computation report.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('PF Computation', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 16. tally_get_esi_report ──────────────────────────────────
    server.tool('tally_get_esi_report', 'Get ESI (Employee State Insurance) computation report.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('ESI Computation', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 17. tally_get_gratuity_report ─────────────────────────────
    server.tool('tally_get_gratuity_report', 'Get gratuity liability report for eligible employees.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('Gratuity', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 18. tally_get_payroll_statutory_report ────────────────────
    server.tool('tally_get_payroll_statutory_report', 'Get consolidated statutory report: PF, ESI, PT, LWF summary.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('Payroll Statutory Summary', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 19. tally_get_ctc_report ──────────────────────────────────
    server.tool('tally_get_ctc_report', 'Get Cost-to-Company (CTC) report for an employee or all employees.', {
        employee_name: z.string().optional().describe('Employee name (omit for all)'),
        ...dateRangeSchema,
    }, async (params) => {
        try {
            const response = await client.exportReport('CTC Report', {
                ...sv(params.from_date, params.to_date),
                ...(params.employee_name ? { DSPEMPLOYEE: params.employee_name } : {}),
            });
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 20. tally_get_employee_ledger ─────────────────────────────
    server.tool('tally_get_employee_ledger', 'Get ledger-view of an employee showing all payroll transactions.', {
        employee_name: z.string().describe('Employee name'),
        ...dateRangeSchema,
    }, async (params) => {
        try {
            const response = await client.exportReport('Employee Ledger', {
                ...sv(params.from_date, params.to_date),
                DSPEMPLOYEE: params.employee_name,
            });
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    return count;
}
//# sourceMappingURL=payroll.mjs.map