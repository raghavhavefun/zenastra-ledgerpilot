// src/tools/masters.ts
// MODULE 1: Masters — 28 tools for all master entity CRUD operations
import { z } from 'zod';
import { XmlBuilder } from '../tally-ported/xml-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
import { validateDate, validateGSTIN } from '../tally-ported/validators.mjs';
export function registerMasterTools(server, client, state) {
    let count = 0;
    // ── 1. tally_create_ledger ────────────────────────────────────
    server.tool('tally_create_ledger', 'Create a new ledger (account) in TallyPrime. Supports GST registration, address, contact, credit terms.', {
        name: z.string().describe('Ledger name — must be unique'),
        parent: z.string().describe('Parent group — e.g. Sundry Debtors, Sundry Creditors, Sales Accounts, Purchase Accounts, Bank Accounts, Cash-in-Hand, etc.'),
        opening_balance: z.string().optional().describe('Opening balance — e.g. "15000 Dr" or "-5000" for credit'),
        gstin: z.string().optional().describe('GST registration number (15 chars)'),
        gst_registration_type: z.enum(['Regular', 'Composition', 'Unregistered', 'Consumer', 'Overseas', 'SEZ']).optional().describe('GST registration type'),
        address: z.string().optional().describe('Full address'),
        state: z.string().optional().describe('State name for GST — e.g. Maharashtra, Karnataka'),
        pincode: z.string().optional().describe('PIN code'),
        mobile: z.string().optional().describe('Mobile number'),
        email: z.string().optional().describe('Email address'),
        pan: z.string().optional().describe('PAN number'),
        is_bill_by_bill: z.boolean().optional().describe('Enable bill-by-bill tracking'),
        credit_limit: z.number().optional().describe('Credit limit amount'),
        credit_days: z.number().optional().describe('Credit period in days'),
    }, async (params) => {
        try {
            if (params.gstin) {
                const gstCheck = validateGSTIN(params.gstin);
                if (!gstCheck.valid)
                    return result({ status: 'validation_error', message: gstCheck.error });
            }
            const xml = XmlBuilder.buildLedgerXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            const importResult = XmlParser.extractImportResult(response.data);
            await state.refreshAfterMasterChange('ledger');
            return result({ status: 'success', ...importResult, ledger_name: params.name });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 2. tally_alter_ledger ─────────────────────────────────────
    server.tool('tally_alter_ledger', 'Modify an existing ledger — rename, change group, update GST, address, contact, credit terms.', {
        name: z.string().describe('Current ledger name'),
        new_name: z.string().optional().describe('New ledger name'),
        parent: z.string().optional().describe('New parent group'),
        gstin: z.string().optional().describe('Updated GSTIN'),
        address: z.string().optional().describe('Updated address'),
        mobile: z.string().optional().describe('Updated mobile'),
        email: z.string().optional().describe('Updated email'),
        credit_limit: z.number().optional().describe('Updated credit limit'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildLedgerXml({ ...params, parent: params.parent || '', action: 'Alter' });
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            const importResult = XmlParser.extractImportResult(response.data);
            await state.refreshAfterMasterChange('ledger');
            return result({ status: 'success', ...importResult });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 3. tally_delete_ledger ────────────────────────────────────
    server.tool('tally_delete_ledger', 'Delete a ledger from TallyPrime. Only works if ledger has no transactions.', {
        name: z.string().describe('Ledger name to delete'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildDeleteMasterXml('LEDGER', params.name);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            const importResult = XmlParser.extractImportResult(response.data);
            await state.refreshAfterMasterChange('ledger');
            return result({ status: 'success', ...importResult });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 4. tally_get_ledger ───────────────────────────────────────
    server.tool('tally_get_ledger', 'Get complete details of a single ledger — balance, GST, address, bills, contact info.', {
        name: z.string().describe('Ledger name'),
    }, async (params) => {
        try {
            const response = await client.exportObject('Ledger', params.name, [
                'Name', 'Parent', 'ClosingBalance', 'OpeningBalance',
                'GSTRegistrationDetails', 'Address', 'PINCode', 'Email',
                'LedgerMobile', 'IncomeTaxNumber', 'CreditLimit', 'CreditDays',
                'IsBillWiseOn', 'BillAllocations', 'LedgerContact',
            ]);
            return result({ status: 'success', data: XmlParser.extractObjectData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 5. tally_list_ledgers ─────────────────────────────────────
    server.tool('tally_list_ledgers', 'List all ledgers, optionally filtered by parent group. Returns name, parent, closing balance.', {
        parent_group: z.string().optional().describe('Filter by parent group — e.g. Sundry Debtors, Bank Accounts'),
    }, async (params) => {
        try {
            const config = TDLBuilder.buildLedgerListQuery({ parentGroup: params.parent_group });
            config.nativeMethods = ['Name', 'Parent', 'ClosingBalance', 'OpeningBalance'];
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
    // ── 6. tally_create_group ─────────────────────────────────────
    server.tool('tally_create_group', 'Create a new account group under a parent group in Tally.', {
        name: z.string().describe('Group name'),
        parent: z.string().describe('Parent group — e.g. Current Assets, Current Liabilities, Primary'),
        is_subledger: z.boolean().optional().describe('Whether group acts as a sub-ledger'),
        affects_gross_profit: z.boolean().optional().describe('Whether group affects gross profit (for P&L)'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildGroupXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            const importResult = XmlParser.extractImportResult(response.data);
            await state.refreshAfterMasterChange('group');
            return result({ status: 'success', ...importResult });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 7. tally_alter_group ──────────────────────────────────────
    server.tool('tally_alter_group', 'Modify an existing group — rename or change parent.', {
        name: z.string().describe('Current group name'),
        new_name: z.string().optional().describe('New group name'),
        parent: z.string().optional().describe('New parent group'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildGroupXml({ ...params, parent: params.parent || '', action: 'Alter' });
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('group');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 8. tally_delete_group ─────────────────────────────────────
    server.tool('tally_delete_group', 'Delete an account group. Must have no sub-groups or ledgers.', {
        name: z.string().describe('Group name to delete'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildDeleteMasterXml('GROUP', params.name);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('group');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 9. tally_list_groups ──────────────────────────────────────
    server.tool('tally_list_groups', 'List all account groups in the company.', {}, async () => {
        try {
            const config = {
                name: 'MCPListGroups',
                type: 'Group',
                nativeMethods: ['Name', 'Parent', 'IsSubledger', 'AffectsGrossProfit'],
            };
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
    // ── 10. tally_create_stock_item ───────────────────────────────
    server.tool('tally_create_stock_item', 'Create a new stock/inventory item with unit, GST, HSN, opening stock, MRP, batch & expiry settings.', {
        name: z.string().describe('Stock item name'),
        unit: z.string().describe('Base unit — e.g. Nos, Kg, Ltrs, Pcs'),
        under: z.string().optional().describe('Stock group — default: Primary'),
        gst_rate: z.number().optional().describe('GST rate (%) — e.g. 5, 12, 18, 28'),
        hsn_code: z.string().optional().describe('HSN/SAC code for GST'),
        opening_qty: z.number().optional().describe('Opening quantity'),
        opening_rate: z.number().optional().describe('Opening rate per unit'),
        opening_godown: z.string().optional().describe('Godown for opening stock'),
        mrp: z.number().optional().describe('Maximum retail price'),
        is_batch_wise: z.boolean().optional().describe('Enable batch tracking'),
        is_expiry_applicable: z.boolean().optional().describe('Enable expiry date tracking'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildStockItemXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('stockitem');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 11. tally_alter_stock_item ────────────────────────────────
    server.tool('tally_alter_stock_item', 'Modify an existing stock item — rename, change GST/HSN, unit, MRP.', {
        name: z.string().describe('Current stock item name'),
        new_name: z.string().optional().describe('New item name'),
        gst_rate: z.number().optional().describe('Updated GST rate'),
        hsn_code: z.string().optional().describe('Updated HSN code'),
        unit: z.string().optional().describe('Updated base unit'),
        mrp: z.number().optional().describe('Updated MRP'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildStockItemXml({ ...params, unit: params.unit || '', action: 'Alter' });
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('stockitem');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 12. tally_delete_stock_item ───────────────────────────────
    server.tool('tally_delete_stock_item', 'Delete a stock item. Must have no transactions.', {
        name: z.string().describe('Stock item name to delete'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildDeleteMasterXml('STOCKITEM', params.name);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('stockitem');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 13. tally_list_stock_items ────────────────────────────────
    server.tool('tally_list_stock_items', 'List all stock items with GST, HSN, MRP, closing balance details.', {}, async () => {
        try {
            const config = TDLBuilder.buildStockItemQuery();
            config.nativeMethods = ['Name', 'Parent', 'BaseUnits', 'ClosingBalance', 'OpeningBalance', 'HSNCode'];
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
    // ── 14. tally_create_stock_group ──────────────────────────────
    server.tool('tally_create_stock_group', 'Create a new stock group to organize inventory items.', {
        name: z.string().describe('Stock group name'),
        under: z.string().optional().describe('Parent stock group'),
        should_quantities_add: z.boolean().optional().describe('Whether quantities should add up for this group'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildStockGroupXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 15. tally_create_stock_category ───────────────────────────
    server.tool('tally_create_stock_category', 'Create a new stock category for inventory classification.', {
        name: z.string().describe('Stock category name'),
        under: z.string().optional().describe('Parent category'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildStockCategoryXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 16. tally_create_unit ─────────────────────────────────────
    server.tool('tally_create_unit', 'Create a simple unit of measure — Nos, Kg, Ltrs, Pcs, etc.', {
        name: z.string().describe('Unit symbol/short name — e.g. Nos, Kg, Ltrs'),
        symbol: z.string().describe('Display symbol'),
        formal_name: z.string().optional().describe('Full formal name — e.g. Numbers, Kilograms'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildUnitXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('unit');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 17. tally_create_compound_unit ────────────────────────────
    server.tool('tally_create_compound_unit', 'Create a compound unit — e.g. Box of 12 = 12 Nos.', {
        name: z.string().describe('Compound unit name — e.g. Box'),
        first_unit: z.string().describe('First (whole) unit — e.g. Box'),
        conversion: z.number().describe('Conversion factor — e.g. 12'),
        second_unit: z.string().describe('Second (base) unit — e.g. Nos'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildCompoundUnitXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('unit');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 18. tally_list_units ──────────────────────────────────────
    server.tool('tally_list_units', 'List all units of measure configured in the company.', {}, async () => {
        try {
            const config = {
                name: 'MCPListUnits',
                type: 'Unit',
                nativeMethods: ['Name', 'OriginalName', 'IssimpleUnit', 'Conversion'],
            };
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
    // ── 19. tally_create_price_level ──────────────────────────────
    server.tool('tally_create_price_level', 'Create a price level for multi-price-list management.', {
        name: z.string().describe('Price level name — e.g. Retail, Wholesale, Distributor'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildPriceLevelXml(params.name);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 20. tally_set_price_list ──────────────────────────────────
    server.tool('tally_set_price_list', 'Set a price for a stock item under a specific price level.', {
        price_level: z.string().describe('Price level name'),
        item_name: z.string().describe('Stock item name'),
        rate: z.number().describe('Price rate per unit'),
        from_date: z.string().describe('Effective from date (YYYYMMDD)'),
        applicable_for_sales: z.boolean().optional().describe('Applicable for sales'),
        applicable_for_purchase: z.boolean().optional().describe('Applicable for purchases'),
    }, async (params) => {
        try {
            const dateCheck = validateDate(params.from_date);
            if (!dateCheck.valid)
                return result({ status: 'validation_error', message: dateCheck.error });
            const xml = `<STOCKITEM NAME="${XmlBuilder.esc(params.item_name)}" Action="Alter">
    <NAME>${XmlBuilder.esc(params.item_name)}</NAME>
    <PRICELEVEL.LIST>
      <NAME>${XmlBuilder.esc(params.price_level)}</NAME>
      <PRICELEVELRATE>${params.rate}</PRICELEVELRATE>
      <APPLICABLEFROM>${params.from_date}</APPLICABLEFROM>
    </PRICELEVEL.LIST>
  </STOCKITEM>`;
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 21. tally_create_godown ───────────────────────────────────
    server.tool('tally_create_godown', 'Create a new godown (warehouse/storage location).', {
        name: z.string().describe('Godown/warehouse name'),
        under: z.string().optional().describe('Parent godown'),
        address: z.string().optional().describe('Godown address'),
        allow_storage: z.boolean().optional().describe('Allow material storage in this godown'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildGodownXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('godown');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 22. tally_list_godowns ────────────────────────────────────
    server.tool('tally_list_godowns', 'List all godowns/warehouses configured in the company.', {}, async () => {
        try {
            const config = {
                name: 'MCPListGodowns',
                type: 'Godown',
                nativeMethods: ['Name', 'Parent', 'Address'],
            };
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
    // ── 23. tally_create_cost_centre ──────────────────────────────
    server.tool('tally_create_cost_centre', 'Create a new cost centre for expense tracking and allocation.', {
        name: z.string().describe('Cost centre name'),
        under: z.string().optional().describe('Parent cost centre'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildCostCentreXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('costcentre');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 24. tally_create_cost_category ────────────────────────────
    server.tool('tally_create_cost_category', 'Create a cost category for grouping cost centres.', {
        name: z.string().describe('Cost category name'),
        allocate_revenue: z.boolean().optional().describe('Allocate revenue items'),
        allocate_non_revenue: z.boolean().optional().describe('Allocate non-revenue items'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildCostCategoryXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 25. tally_list_cost_centres ───────────────────────────────
    server.tool('tally_list_cost_centres', 'List all cost centres in the company.', {}, async () => {
        try {
            const config = {
                name: 'MCPListCostCentres',
                type: 'CostCentre',
                nativeMethods: ['Name', 'Parent', 'Category'],
            };
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
    // ── 26. tally_create_voucher_type ─────────────────────────────
    server.tool('tally_create_voucher_type', 'Create a custom voucher type based on a standard type (Sales, Purchase, Receipt, Payment, Journal, etc.).', {
        name: z.string().describe('Custom voucher type name'),
        base_type: z.string().describe('Base voucher type — Sales, Purchase, Receipt, Payment, Journal, Contra, Credit Note, Debit Note, etc.'),
        is_active: z.boolean().optional().describe('Whether the voucher type is active'),
        default_narration: z.string().optional().describe('Default narration text'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildVoucherTypeXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            await state.refreshAfterMasterChange('vouchertype');
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 27. tally_list_voucher_types ──────────────────────────────
    server.tool('tally_list_voucher_types', 'List all voucher types (standard + custom) in the company.', {}, async () => {
        try {
            const config = {
                name: 'MCPListVoucherTypes',
                type: 'VoucherType',
                nativeMethods: ['Name', 'Parent', 'NumberingMethod', 'IsTaxInvoice'],
            };
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
    // ── 28. tally_create_currency ─────────────────────────────────
    server.tool('tally_create_currency', 'Create a new currency for multi-currency accounting.', {
        name: z.string().describe('Currency code — e.g. USD, EUR, GBP'),
        symbol: z.string().describe('Currency symbol — e.g. $, €, £'),
        formal_name: z.string().optional().describe('Full name — e.g. US Dollar'),
        standard_rate: z.number().optional().describe('Standard exchange rate'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildCurrencyXml(params);
            const response = await client.importMasters(xml, state.activeCompany || undefined);
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    return count;
}
//# sourceMappingURL=masters.mjs.map