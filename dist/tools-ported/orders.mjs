// src/tools/orders.ts
// MODULE 3: Orders — 10 tools for full order cycle management
import { z } from 'zod';
import { XmlBuilder } from '../tally-ported/xml-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
import { validateDate } from '../tally-ported/validators.mjs';
const orderItemSchema = z.object({
    stock_item_name: z.string().describe('Stock item name'),
    qty: z.number().describe('Quantity'),
    rate: z.number().describe('Rate per unit'),
    unit: z.string().describe('Unit of measure'),
    amount: z.number().optional().describe('Total amount (auto-calculated if omitted)'),
});
export function registerOrderTools(server, client, state) {
    let count = 0;
    const getCompany = () => state.activeCompany || undefined;
    // ── 1. tally_create_sales_order ───────────────────────────────
    server.tool('tally_create_sales_order', 'Create a sales order with line items. Tracked until fulfilled via delivery/invoice.', {
        date: z.string().describe('Order date (YYYYMMDD)'),
        party_ledger: z.string().describe('Customer ledger'),
        items: z.array(orderItemSchema).describe('Order line items'),
        order_number: z.string().optional().describe('Sales order number'),
        due_date: z.string().optional().describe('Expected delivery date (YYYYMMDD)'),
        narration: z.string().optional().describe('Narration'),
    }, async (params) => {
        try {
            const dateCheck = validateDate(params.date);
            if (!dateCheck.valid)
                return result({ status: 'validation_error', message: dateCheck.error });
            const invEntries = params.items.map(item => ({
                stock_item_name: item.stock_item_name,
                is_deemed_positive: true,
                rate: item.rate,
                unit: item.unit,
                qty: item.qty,
                amount: item.amount || item.qty * item.rate,
            }));
            const voucherXml = XmlBuilder.buildVoucherXml({
                voucher_type: 'Sales Order',
                date: params.date,
                party_ledger: params.party_ledger,
                order_number: params.order_number,
                due_date: params.due_date,
                narration: params.narration,
                inventory_entries: invEntries,
            });
            const response = await client.importVouchers(voucherXml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 2. tally_create_purchase_order ────────────────────────────
    server.tool('tally_create_purchase_order', 'Create a purchase order with line items.', {
        date: z.string().describe('Order date (YYYYMMDD)'),
        party_ledger: z.string().describe('Supplier ledger'),
        items: z.array(orderItemSchema).describe('Order line items'),
        order_number: z.string().optional().describe('PO number'),
        due_date: z.string().optional().describe('Expected delivery date (YYYYMMDD)'),
        narration: z.string().optional().describe('Narration'),
    }, async (params) => {
        try {
            const dateCheck = validateDate(params.date);
            if (!dateCheck.valid)
                return result({ status: 'validation_error', message: dateCheck.error });
            const invEntries = params.items.map(item => ({
                stock_item_name: item.stock_item_name,
                is_deemed_positive: true,
                rate: item.rate,
                unit: item.unit,
                qty: item.qty,
                amount: item.amount || item.qty * item.rate,
            }));
            const voucherXml = XmlBuilder.buildVoucherXml({
                voucher_type: 'Purchase Order',
                date: params.date,
                party_ledger: params.party_ledger,
                order_number: params.order_number,
                due_date: params.due_date,
                narration: params.narration,
                inventory_entries: invEntries,
            });
            const response = await client.importVouchers(voucherXml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 3. tally_create_delivery_note ─────────────────────────────
    server.tool('tally_create_delivery_note', 'Create a delivery note (goods dispatched against a sales order).', {
        date: z.string().describe('Date (YYYYMMDD)'),
        party_ledger: z.string().describe('Customer ledger'),
        items: z.array(orderItemSchema).describe('Delivered items'),
        against_order_no: z.string().optional().describe('Sales order number'),
        narration: z.string().optional().describe('Narration'),
    }, async (params) => {
        try {
            const dateCheck = validateDate(params.date);
            if (!dateCheck.valid)
                return result({ status: 'validation_error', message: dateCheck.error });
            const invEntries = params.items.map(item => ({
                stock_item_name: item.stock_item_name,
                is_deemed_positive: false,
                rate: item.rate, unit: item.unit, qty: item.qty,
                amount: item.amount || item.qty * item.rate,
            }));
            const voucherXml = XmlBuilder.buildVoucherXml({
                voucher_type: 'Delivery Note',
                date: params.date,
                party_ledger: params.party_ledger,
                order_number: params.against_order_no,
                narration: params.narration,
                inventory_entries: invEntries,
            });
            const response = await client.importVouchers(voucherXml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 4. tally_create_receipt_note ──────────────────────────────
    server.tool('tally_create_receipt_note', 'Create a receipt note (goods received against a purchase order / GRN).', {
        date: z.string().describe('Date (YYYYMMDD)'),
        party_ledger: z.string().describe('Supplier ledger'),
        items: z.array(orderItemSchema).describe('Received items'),
        against_order_no: z.string().optional().describe('Purchase order number'),
        narration: z.string().optional().describe('Narration'),
    }, async (params) => {
        try {
            const dateCheck = validateDate(params.date);
            if (!dateCheck.valid)
                return result({ status: 'validation_error', message: dateCheck.error });
            const invEntries = params.items.map(item => ({
                stock_item_name: item.stock_item_name,
                is_deemed_positive: true,
                rate: item.rate, unit: item.unit, qty: item.qty,
                amount: item.amount || item.qty * item.rate,
            }));
            const voucherXml = XmlBuilder.buildVoucherXml({
                voucher_type: 'Receipt Note',
                date: params.date,
                party_ledger: params.party_ledger,
                order_number: params.against_order_no,
                narration: params.narration,
                inventory_entries: invEntries,
            });
            const response = await client.importVouchers(voucherXml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 5. tally_create_rejection_out ─────────────────────────────
    server.tool('tally_create_rejection_out', 'Create a rejection out voucher (return goods to supplier).', {
        date: z.string().describe('Date (YYYYMMDD)'),
        party_ledger: z.string().describe('Supplier ledger'),
        items: z.array(orderItemSchema).describe('Rejected items'),
        narration: z.string().optional().describe('Narration'),
    }, async (params) => {
        try {
            const dateCheck = validateDate(params.date);
            if (!dateCheck.valid)
                return result({ status: 'validation_error', message: dateCheck.error });
            const invEntries = params.items.map(item => ({
                stock_item_name: item.stock_item_name,
                is_deemed_positive: false,
                rate: item.rate, unit: item.unit, qty: item.qty,
                amount: item.amount || item.qty * item.rate,
            }));
            const voucherXml = XmlBuilder.buildVoucherXml({
                voucher_type: 'Rejection Out',
                date: params.date,
                party_ledger: params.party_ledger,
                narration: params.narration,
                inventory_entries: invEntries,
            });
            const response = await client.importVouchers(voucherXml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 6. tally_create_rejection_in ──────────────────────────────
    server.tool('tally_create_rejection_in', 'Create a rejection in voucher (customer returns goods).', {
        date: z.string().describe('Date (YYYYMMDD)'),
        party_ledger: z.string().describe('Customer ledger'),
        items: z.array(orderItemSchema).describe('Returned items'),
        narration: z.string().optional().describe('Narration'),
    }, async (params) => {
        try {
            const dateCheck = validateDate(params.date);
            if (!dateCheck.valid)
                return result({ status: 'validation_error', message: dateCheck.error });
            const invEntries = params.items.map(item => ({
                stock_item_name: item.stock_item_name,
                is_deemed_positive: true,
                rate: item.rate, unit: item.unit, qty: item.qty,
                amount: item.amount || item.qty * item.rate,
            }));
            const voucherXml = XmlBuilder.buildVoucherXml({
                voucher_type: 'Rejection In',
                date: params.date,
                party_ledger: params.party_ledger,
                narration: params.narration,
                inventory_entries: invEntries,
            });
            const response = await client.importVouchers(voucherXml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 7. tally_list_sales_orders ────────────────────────────────
    server.tool('tally_list_sales_orders', 'List sales orders within a date range, optionally filtered by party and status.', {
        from_date: z.string().describe('Start date (YYYYMMDD)'),
        to_date: z.string().describe('End date (YYYYMMDD)'),
        party_ledger: z.string().optional().describe('Filter by customer'),
        status: z.enum(['Pending', 'Completed', 'All']).optional().describe('Order status filter'),
    }, async (params) => {
        try {
            const config = TDLBuilder.buildVoucherQuery({ voucherType: 'Sales Order', partyLedger: params.party_ledger });
            config.nativeMethods = ['Date', 'VoucherNumber', 'PartyledgerName', 'Amount', 'Narration', 'EffectiveDate'];
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
    // ── 8. tally_list_purchase_orders ─────────────────────────────
    server.tool('tally_list_purchase_orders', 'List purchase orders within a date range.', {
        from_date: z.string().describe('Start date (YYYYMMDD)'),
        to_date: z.string().describe('End date (YYYYMMDD)'),
        party_ledger: z.string().optional().describe('Filter by supplier'),
        status: z.enum(['Pending', 'Completed', 'All']).optional().describe('Order status filter'),
    }, async (params) => {
        try {
            const config = TDLBuilder.buildVoucherQuery({ voucherType: 'Purchase Order', partyLedger: params.party_ledger });
            config.nativeMethods = ['Date', 'VoucherNumber', 'PartyledgerName', 'Amount', 'Narration', 'EffectiveDate'];
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
    // ── 9. tally_get_order_outstanding ────────────────────────────
    server.tool('tally_get_order_outstanding', 'Get outstanding (unfulfilled) orders — sales or purchase.', {
        order_type: z.enum(['Sales', 'Purchase']).describe('Sales or Purchase orders'),
        from_date: z.string().describe('Start date (YYYYMMDD)'),
        to_date: z.string().describe('End date (YYYYMMDD)'),
    }, async (params) => {
        try {
            const reportName = params.order_type === 'Sales' ? 'Sales Order Outstandings' : 'Purchase Order Outstandings';
            const response = await client.exportReport(reportName, {
                SVFROMDATE: params.from_date, SVTODATE: params.to_date,
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
            });
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 10. tally_get_sales_order_book ────────────────────────────
    server.tool('tally_get_sales_order_book', 'Get the sales order book showing all orders and their fulfillment status.', {
        from_date: z.string().describe('Start date (YYYYMMDD)'),
        to_date: z.string().describe('End date (YYYYMMDD)'),
    }, async (params) => {
        try {
            const response = await client.exportReport('Sales Order Book', {
                SVFROMDATE: params.from_date, SVTODATE: params.to_date,
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
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
//# sourceMappingURL=orders.mjs.map