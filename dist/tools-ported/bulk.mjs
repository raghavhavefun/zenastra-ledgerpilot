// src/tools/bulk.ts
// MODULE 15: Bulk Operations — 12 tools for batch processing
import { z } from 'zod';
import { XmlBuilder } from '../tally-ported/xml-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
export function registerBulkTools(server, client, state) {
    let count = 0;
    const getCompany = () => state.activeCompany || undefined;
    // ── 1. tally_bulk_create_ledgers ──────────────────────────────
    server.tool('tally_bulk_create_ledgers', 'Create multiple ledgers in one shot. Efficient for initial setup.', {
        ledgers: z.array(z.object({
            name: z.string().describe('Ledger name'),
            parent: z.string().describe('Parent group'),
            opening_balance: z.number().optional().describe('Opening balance'),
            gstin: z.string().optional().describe('Party GSTIN'),
            address: z.string().optional().describe('Address'),
            credit_period: z.number().optional().describe('Credit period in days'),
        })).describe('Array of ledger definitions'),
    }, async (params) => {
        try {
            const xmlParts = params.ledgers.map(l => XmlBuilder.buildLedgerXml(l));
            const combined = xmlParts.join('\n');
            const response = await client.importMasters(combined, getCompany());
            return result({ status: 'success', count: params.ledgers.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 2. tally_bulk_create_stock_items ──────────────────────────
    server.tool('tally_bulk_create_stock_items', 'Create multiple stock items in one batch.', {
        items: z.array(z.object({
            name: z.string().describe('Stock item name'),
            parent: z.string().optional().describe('Stock group'),
            category: z.string().optional().describe('Stock category'),
            unit: z.string().describe('Primary unit'),
            opening_qty: z.number().optional().describe('Opening quantity'),
            opening_rate: z.number().optional().describe('Opening rate'),
            opening_value: z.number().optional().describe('Opening value'),
            hsn_code: z.string().optional().describe('HSN/SAC code'),
            gst_rate: z.number().optional().describe('GST rate %'),
        })).describe('Array of stock items'),
    }, async (params) => {
        try {
            const xmlParts = params.items.map(i => XmlBuilder.buildStockItemXml(i));
            const combined = xmlParts.join('\n');
            const response = await client.importMasters(combined, getCompany());
            return result({ status: 'success', count: params.items.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 3. tally_bulk_create_groups ───────────────────────────────
    server.tool('tally_bulk_create_groups', 'Create multiple account groups in one batch.', {
        groups: z.array(z.object({
            name: z.string().describe('Group name'),
            parent: z.string().describe('Parent group'),
            is_subledger: z.boolean().optional().describe('Behaves as sub-ledger'),
            is_revenue: z.boolean().optional().describe('Revenue nature'),
        })).describe('Array of groups'),
    }, async (params) => {
        try {
            const xmlParts = params.groups.map(g => XmlBuilder.buildGroupXml(g));
            const combined = xmlParts.join('\n');
            const response = await client.importMasters(combined, getCompany());
            return result({ status: 'success', count: params.groups.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 4. tally_bulk_create_vouchers ─────────────────────────────
    server.tool('tally_bulk_create_vouchers', 'Import multiple vouchers in one batch (same or different types).', {
        vouchers: z.array(z.object({
            voucher_type: z.string().describe('Voucher type name'),
            date: z.string().describe('Voucher date (YYYYMMDD)'),
            party_ledger: z.string().optional().describe('Party ledger'),
            narration: z.string().optional().describe('Narration'),
            ledger_entries: z.array(z.object({
                ledger_name: z.string().describe('Ledger name'),
                amount: z.number().describe('Amount (positive=debit, negative=credit)'),
            })).optional().describe('Ledger entries'),
            inventory_entries: z.array(z.object({
                stock_item_name: z.string().describe('Stock item'),
                qty: z.number().describe('Quantity'),
                rate: z.number().describe('Rate'),
                unit: z.string().describe('Unit'),
                amount: z.number().describe('Amount'),
                is_deemed_positive: z.boolean().optional().describe('Inward (true) or Outward (false)'),
            })).optional().describe('Inventory entries'),
        })).describe('Array of vouchers'),
    }, async (params) => {
        try {
            const xmlParts = params.vouchers.map(v => XmlBuilder.buildVoucherXml(v));
            const combined = xmlParts.join('\n');
            const response = await client.importVouchers(combined, getCompany());
            return result({ status: 'success', count: params.vouchers.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 5. tally_bulk_create_cost_centres ─────────────────────────
    server.tool('tally_bulk_create_cost_centres', 'Create multiple cost centres in one batch.', {
        cost_centres: z.array(z.object({
            name: z.string().describe('Cost centre name'),
            parent: z.string().optional().describe('Parent cost centre'),
            category: z.string().optional().describe('Cost category'),
        })).describe('Array of cost centres'),
    }, async (params) => {
        try {
            const xmlParts = params.cost_centres.map(cc => XmlBuilder.buildCostCentreXml(cc));
            const combined = xmlParts.join('\n');
            const response = await client.importMasters(combined, getCompany());
            return result({ status: 'success', count: params.cost_centres.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 6. tally_bulk_create_employees ────────────────────────────
    server.tool('tally_bulk_create_employees', 'Create multiple employees in one batch.', {
        employees: z.array(z.object({
            name: z.string().describe('Employee name'),
            employee_group: z.string().optional().describe('Employee group'),
            date_of_joining: z.string().optional().describe('Date of joining (YYYYMMDD)'),
            designation: z.string().optional().describe('Designation'),
            function: z.string().optional().describe('Function/Department'),
            pan: z.string().optional().describe('PAN'),
        })).describe('Array of employees'),
    }, async (params) => {
        try {
            const xmlParts = params.employees.map(e => XmlBuilder.buildEmployeeXml(e));
            const combined = xmlParts.join('\n');
            const response = await client.importMasters(combined, getCompany());
            return result({ status: 'success', count: params.employees.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 7. tally_bulk_create_godowns ──────────────────────────────
    server.tool('tally_bulk_create_godowns', 'Create multiple godowns/warehouses in one batch.', {
        godowns: z.array(z.object({
            name: z.string().describe('Godown name'),
            parent: z.string().optional().describe('Parent godown'),
            address: z.string().optional().describe('Address'),
        })).describe('Array of godowns'),
    }, async (params) => {
        try {
            const xmlParts = params.godowns.map(g => XmlBuilder.buildGodownXml(g));
            const combined = xmlParts.join('\n');
            const response = await client.importMasters(combined, getCompany());
            return result({ status: 'success', count: params.godowns.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 8. tally_bulk_alter_ledgers ───────────────────────────────
    server.tool('tally_bulk_alter_ledgers', 'Update multiple ledgers in a single batch (change group, balances, etc.).', {
        ledgers: z.array(z.object({
            name: z.string().describe('Current ledger name'),
            new_name: z.string().optional().describe('New name'),
            parent: z.string().optional().describe('New parent group'),
            opening_balance: z.number().optional().describe('New opening balance'),
            gstin: z.string().optional().describe('Updated GSTIN'),
        })).describe('Array of ledger updates'),
    }, async (params) => {
        try {
            const xmlParts = params.ledgers.map(l => XmlBuilder.buildLedgerXml({ ...l, action: 'alter' }));
            const combined = xmlParts.join('\n');
            const response = await client.importMasters(combined, getCompany());
            return result({ status: 'success', count: params.ledgers.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 9. tally_bulk_delete_masters ──────────────────────────────
    server.tool('tally_bulk_delete_masters', 'Delete multiple masters of the same type in one batch.', {
        master_type: z.enum(['Ledger', 'StockItem', 'Group', 'StockGroup', 'CostCentre', 'Godown', 'Employee', 'Unit']).describe('Master type'),
        names: z.array(z.string()).describe('Array of master names to delete'),
    }, async (params) => {
        try {
            const xmlParts = params.names.map(name => XmlBuilder.buildDeleteMasterXml(params.master_type, name));
            const combined = xmlParts.join('\n');
            const response = await client.importMasters(combined, getCompany());
            return result({ status: 'success', count: params.names.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 10. tally_bulk_create_units ───────────────────────────────
    server.tool('tally_bulk_create_units', 'Create multiple units of measure in one batch.', {
        units: z.array(z.object({
            name: z.string().describe('Unit symbol (e.g. "pcs", "kg")'),
            formal_name: z.string().optional().describe('Formal name'),
            is_simple: z.boolean().optional().describe('Simple unit (true) or compound (false)'),
            decimal_places: z.number().optional().describe('Decimal places'),
        })).describe('Array of units'),
    }, async (params) => {
        try {
            const xmlParts = params.units.map(u => XmlBuilder.buildUnitXml(u));
            const combined = xmlParts.join('\n');
            const response = await client.importMasters(combined, getCompany());
            return result({ status: 'success', count: params.units.length, ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 11. tally_export_masters_csv_format ───────────────────────
    server.tool('tally_export_masters_csv_format', 'Export master data in a flat, JSON-table format (like CSV) for analysis.', {
        master_type: z.enum(['Ledger', 'StockItem', 'Group', 'StockGroup', 'CostCentre', 'Godown', 'Employee', 'VoucherType', 'Unit']).describe('Type of masters to export'),
        fields: z.array(z.string()).optional().describe('Specific fields to include'),
    }, async (params) => {
        try {
            const defaultFields = {
                Ledger: ['Name', 'Parent', 'ClosingBalance', 'OpeningBalance'],
                StockItem: ['Name', 'Parent', 'BaseUnits', 'ClosingBalance', 'ClosingRate', 'ClosingValue'],
                Group: ['Name', 'Parent', 'IsRevenue', 'IsSubledger'],
                StockGroup: ['Name', 'Parent'],
                CostCentre: ['Name', 'Parent', 'Category'],
                Godown: ['Name', 'Parent', 'Address'],
                Employee: ['Name', 'Parent', 'DateOfJoining', 'Designation'],
                VoucherType: ['Name', 'Parent', 'NumberingMethod'],
                Unit: ['Name', 'FormalName', 'IsSimpleUnit', 'DecimalPlaces'],
            };
            const fields = params.fields || defaultFields[params.master_type] || ['Name'];
            const config = TDLBuilder.buildCustomCollection({
                collectionType: params.master_type,
                fetchFields: fields,
            });
            const response = await client.queryCollection(config, {
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
            });
            return result({ status: 'success', master_type: params.master_type, data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 12. tally_export_vouchers_flat ────────────────────────────
    server.tool('tally_export_vouchers_flat', 'Export vouchers in a flat JSON format for analysis or migration.', {
        voucher_type: z.string().optional().describe('Filter by voucher type (e.g. "Sales", "Purchase")'),
        from_date: z.string().describe('Start date (YYYYMMDD)'),
        to_date: z.string().describe('End date (YYYYMMDD)'),
        party_ledger: z.string().optional().describe('Filter by party'),
    }, async (params) => {
        try {
            const filters = {};
            if (params.voucher_type)
                filters.TypeFilter = `$VoucherTypeName = "${params.voucher_type}"`;
            if (params.party_ledger)
                filters.PartyFilter = `$PartyledgerName = "${params.party_ledger}"`;
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'Voucher',
                fetchFields: [
                    'Date', 'VoucherNumber', 'VoucherTypeName', 'PartyledgerName',
                    'Amount', 'Narration', 'IsOptional', 'IsCancelled',
                ],
                ...(Object.keys(filters).length > 0 ? { filters } : {}),
            });
            const response = await client.queryCollection(config, {
                SVFROMDATE: params.from_date, SVTODATE: params.to_date,
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
            });
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    return count;
}
//# sourceMappingURL=bulk.mjs.map