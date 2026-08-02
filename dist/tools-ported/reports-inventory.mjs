// src/tools/reports-inventory.ts
// MODULE 5: Inventory Reports — 10 tools
import { z } from 'zod';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
const dateRangeSchema = {
    from_date: z.string().describe('Start date (YYYYMMDD)'),
    to_date: z.string().describe('End date (YYYYMMDD)'),
};
export function registerInventoryReportTools(server, client, state) {
    let count = 0;
    const sv = (from, to) => ({
        SVFROMDATE: from, SVTODATE: to,
        ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
    });
    // ── 1. tally_get_stock_summary ────────────────────────────────
    server.tool('tally_get_stock_summary', 'Get overall stock summary: all items with closing quantity and value.', dateRangeSchema, async (params) => {
        try {
            const config = TDLBuilder.buildStockItemQuery();
            const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 2. tally_get_stock_item_detail ────────────────────────────
    server.tool('tally_get_stock_item_detail', 'Get full details of a specific stock item including batches, godowns, opening/closing balances.', {
        stock_item_name: z.string().describe('Stock item name'),
        ...dateRangeSchema,
    }, async (params) => {
        try {
            const response = await client.exportObject('StockItem', params.stock_item_name, [], sv(params.from_date, params.to_date));
            return result({ status: 'success', data: XmlParser.extractObjectData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 3. tally_get_godown_summary ───────────────────────────────
    server.tool('tally_get_godown_summary', 'Get godown-wise stock summary showing quantity and value per godown.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('Godown', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 4. tally_get_stock_movement ───────────────────────────────
    server.tool('tally_get_stock_movement', 'Get stock movement (inward/outward) for a stock item over a period.', {
        stock_item_name: z.string().describe('Stock item name'),
        ...dateRangeSchema,
    }, async (params) => {
        try {
            const response = await client.exportReport('Movement Analysis', {
                ...sv(params.from_date, params.to_date),
                DSPSTOCKITEM: params.stock_item_name,
            });
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 5. tally_get_batch_report ─────────────────────────────────
    server.tool('tally_get_batch_report', 'Get batch-wise stock report showing quantity per batch for an item.', {
        stock_item_name: z.string().optional().describe('Stock item name (omit for all items)'),
        ...dateRangeSchema,
    }, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'Batch',
                fetchFields: ['Name', 'StockItemName', 'ClosingBalance', 'GodownName', 'MfgDate', 'ExpiryDate'],
                ...(params.stock_item_name ? { filters: { ItemFilter: `$StockItemName = "${params.stock_item_name}"` } } : {}),
            });
            const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 6. tally_get_expiry_report ────────────────────────────────
    server.tool('tally_get_expiry_report', 'Get stock items nearing or past expiry date.', {
        as_of_date: z.string().describe('Date to check expiry against (YYYYMMDD)'),
        days_to_expiry: z.number().optional().describe('Days until expiry threshold (default 30)'),
    }, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'Batch',
                fetchFields: ['Name', 'StockItemName', 'ClosingBalance', 'ExpiryDate', 'MfgDate', 'GodownName'],
                filters: { ExpiryFilter: '$ExpiryDate > 1' },
            });
            const response = await client.queryCollection(config, sv('20000101', params.as_of_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 7. tally_get_reorder_report ───────────────────────────────
    server.tool('tally_get_reorder_report', 'Get stock items at or below their reorder level.', dateRangeSchema, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'StockItem',
                fetchFields: ['Name', 'Parent', 'ClosingBalance', 'ClosingRate', 'ClosingValue', 'ReorderLevel', 'BaseUnits'],
                filters: { ReorderFilter: '$ReorderLevel > 0' },
            });
            const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 8. tally_get_stock_valuation ──────────────────────────────
    server.tool('tally_get_stock_valuation', 'Get stock valuation report — closing value by different valuation methods.', dateRangeSchema, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'StockItem',
                fetchFields: ['Name', 'Parent', 'BaseUnits', 'ClosingBalance', 'ClosingRate', 'ClosingValue', 'ValuationMethod'],
            });
            const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 9. tally_get_movement_analysis ────────────────────────────
    server.tool('tally_get_movement_analysis', 'Get movement analysis for inventory — inward/outward quantities & values.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('Movement Analysis', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 10. tally_get_category_summary ────────────────────────────
    server.tool('tally_get_category_summary', 'Get stock category-wise summary with totals.', dateRangeSchema, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'StockCategory',
                fetchFields: ['Name', 'Parent'],
            });
            const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    return count;
}
//# sourceMappingURL=reports-inventory.mjs.map