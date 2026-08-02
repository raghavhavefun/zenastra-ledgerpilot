// src/tools/manufacturing.ts
// MODULE 10: Manufacturing — 14 tools for BOM, job costing, work orders

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TallyClient } from '../tally-ported/client.mjs';
import { TallyState } from '../tally-ported/state.mjs';
import { XmlBuilder } from '../tally-ported/xml-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';

const dateRangeSchema = {
  from_date: z.string().describe('Start date (YYYYMMDD)'),
  to_date: z.string().describe('End date (YYYYMMDD)'),
};

export function registerManufacturingTools(server: McpServer, client: TallyClient, state: TallyState): number {
  let count = 0;
  const getCompany = () => state.activeCompany || undefined;
  const sv = (from: string, to: string) => ({
    SVFROMDATE: from, SVTODATE: to,
    ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
  });

  // ── 1. tally_create_bom ──────────────────────────────────────
  server.tool(
    'tally_create_bom',
    'Create a Bill of Materials (BOM) for a stock item — list of components with quantities.',
    {
      stock_item_name: z.string().describe('Finished good / parent item name'),
      components: z.array(z.object({
        item_name: z.string().describe('Component stock item name'),
        qty: z.number().describe('Quantity required'),
        unit: z.string().describe('Unit of measure'),
        godown: z.string().optional().describe('Source godown'),
      })).describe('BOM component list'),
      output_qty: z.number().optional().describe('Output quantity (default: 1)'),
      output_unit: z.string().optional().describe('Output unit'),
    },
    async (params) => {
      try {
        const xml = XmlBuilder.buildBomXml({
          stock_item_name: params.stock_item_name,
          components: params.components,
          output_qty: params.output_qty || 1,
          output_unit: params.output_unit,
        });
        const response = await client.importMasters(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 2. tally_alter_bom ───────────────────────────────────────
  server.tool(
    'tally_alter_bom',
    'Update an existing BOM for a stock item.',
    {
      stock_item_name: z.string().describe('Parent stock item name'),
      components: z.array(z.object({
        item_name: z.string().describe('Component item name'),
        qty: z.number().describe('Updated quantity'),
        unit: z.string().describe('Unit'),
        godown: z.string().optional().describe('Source godown'),
      })).describe('Updated BOM components'),
      output_qty: z.number().optional().describe('Output quantity'),
      output_unit: z.string().optional().describe('Output unit'),
    },
    async (params) => {
      try {
        const xml = XmlBuilder.buildBomXml({
          stock_item_name: params.stock_item_name,
          components: params.components,
          output_qty: params.output_qty || 1,
          output_unit: params.output_unit,
          action: 'alter',
        });
        const response = await client.importMasters(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 3. tally_get_bom ─────────────────────────────────────────
  server.tool(
    'tally_get_bom',
    'Get the BOM components for a stock item.',
    { stock_item_name: z.string().describe('Stock item name') },
    async (params) => {
      try {
        const response = await client.exportObject('StockItem', params.stock_item_name, [], {
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        return result({ status: 'success', data: XmlParser.extractObjectData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 4. tally_create_manufacturing_journal ─────────────────────
  server.tool(
    'tally_create_manufacturing_journal',
    'Create a manufacturing journal — consume raw materials and produce finished goods.',
    {
      date: z.string().describe('Date (YYYYMMDD)'),
      finished_item: z.string().describe('Finished stock item'),
      finished_qty: z.number().describe('Quantity produced'),
      finished_unit: z.string().describe('Unit of finished item'),
      finished_rate: z.number().describe('Rate/value per unit of finished item'),
      finished_godown: z.string().optional().describe('Destination godown'),
      consumed_items: z.array(z.object({
        item_name: z.string().describe('Raw material stock item'),
        qty: z.number().describe('Quantity consumed'),
        unit: z.string().describe('Unit'),
        rate: z.number().describe('Rate per unit'),
        godown: z.string().optional().describe('Source godown'),
      })).describe('Consumed raw materials'),
      narration: z.string().optional().describe('Narration'),
    },
    async (params) => {
      try {
        const invEntries = [
          // Finished goods (inward)
          {
            stock_item_name: params.finished_item,
            is_deemed_positive: true,
            qty: params.finished_qty,
            unit: params.finished_unit,
            rate: params.finished_rate,
            amount: params.finished_qty * params.finished_rate,
            godown: params.finished_godown,
          },
          // Raw materials (outward)
          ...params.consumed_items.map(item => ({
            stock_item_name: item.item_name,
            is_deemed_positive: false,
            qty: item.qty,
            unit: item.unit,
            rate: item.rate,
            amount: item.qty * item.rate,
            godown: item.godown,
          })),
        ];

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Stock Journal',
          date: params.date,
          narration: params.narration || `Manufacturing: ${params.finished_item}`,
          inventory_entries: invEntries,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 5. tally_get_production_report ────────────────────────────
  server.tool(
    'tally_get_production_report',
    'Get production report showing items manufactured in a period.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Production', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 6. tally_get_consumption_report ───────────────────────────
  server.tool(
    'tally_get_consumption_report',
    'Get raw material consumption report for a period.',
    {
      stock_item_name: z.string().optional().describe('Specific item (omit for all)'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportReport('Consumption', {
          ...sv(params.from_date, params.to_date),
          ...(params.stock_item_name ? { DSPSTOCKITEM: params.stock_item_name } : {}),
        });
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 7. tally_get_job_costing ──────────────────────────────────
  server.tool(
    'tally_get_job_costing',
    'Get job costing report — cost centre wise allocation of manufacturing costs.',
    {
      cost_centre: z.string().optional().describe('Specific cost centre / job (omit for all)'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportReport('Job Costing', {
          ...sv(params.from_date, params.to_date),
          ...(params.cost_centre ? { DSPCOSTCENTRE: params.cost_centre } : {}),
        });
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 8. tally_get_work_order_status ────────────────────────────
  server.tool(
    'tally_get_work_order_status',
    'Get work order / production order status — pending vs completed.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Work Order Status', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 9. tally_get_bom_requirements ─────────────────────────────
  server.tool(
    'tally_get_bom_requirements',
    'Calculate raw material requirements based on BOM for a given production quantity.',
    {
      stock_item_name: z.string().describe('Finished stock item with BOM'),
      production_qty: z.number().describe('Planned production quantity'),
    },
    async (params) => {
      try {
        // Fetch BOM from the stock item
        const response = await client.exportObject('StockItem', params.stock_item_name, [], {
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        const itemData = XmlParser.extractObjectData(response.data);
        return result({
          status: 'success',
          stock_item: params.stock_item_name,
          production_qty: params.production_qty,
          bom_data: itemData,
        });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 10. tally_stock_transfer_between_godowns ──────────────────
  server.tool(
    'tally_stock_transfer_between_godowns',
    'Transfer stock between godowns via a stock journal.',
    {
      date: z.string().describe('Date (YYYYMMDD)'),
      stock_item_name: z.string().describe('Stock item to transfer'),
      qty: z.number().describe('Transfer quantity'),
      unit: z.string().describe('Unit of measure'),
      rate: z.number().describe('Rate per unit'),
      from_godown: z.string().describe('Source godown'),
      to_godown: z.string().describe('Destination godown'),
      narration: z.string().optional().describe('Narration'),
    },
    async (params) => {
      try {
        const amount = params.qty * params.rate;
        const invEntries = [
          {
            stock_item_name: params.stock_item_name,
            is_deemed_positive: false,
            qty: params.qty, unit: params.unit, rate: params.rate, amount,
            godown: params.from_godown,
          },
          {
            stock_item_name: params.stock_item_name,
            is_deemed_positive: true,
            qty: params.qty, unit: params.unit, rate: params.rate, amount,
            godown: params.to_godown,
          },
        ];

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Stock Journal',
          date: params.date,
          narration: params.narration || `Transfer: ${params.from_godown} → ${params.to_godown}`,
          inventory_entries: invEntries,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 11. tally_get_wastage_report ──────────────────────────────
  server.tool(
    'tally_get_wastage_report',
    'Get wastage / scrap report from manufacturing processes.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Wastage', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 12. tally_get_yield_analysis ──────────────────────────────
  server.tool(
    'tally_get_yield_analysis',
    'Get yield analysis — actual vs expected output from manufacturing.',
    {
      stock_item_name: z.string().optional().describe('Finished item (omit for all)'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportReport('Yield Analysis', {
          ...sv(params.from_date, params.to_date),
          ...(params.stock_item_name ? { DSPSTOCKITEM: params.stock_item_name } : {}),
        });
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 13. tally_list_boms ──────────────────────────────────────
  server.tool(
    'tally_list_boms',
    'List all stock items that have BOMs defined.',
    {},
    async () => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'StockItem',
          fetchFields: ['Name', 'Parent', 'BaseUnits', 'IsBomItem'],
          filters: { BomFilter: '$IsBomItem = Yes' },
        });
        const response = await client.queryCollection(config, {
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 14. tally_get_process_costing ─────────────────────────────
  server.tool(
    'tally_get_process_costing',
    'Get process costing report — cost accumulation through manufacturing stages.',
    {
      process: z.string().optional().describe('Process / cost centre name'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportReport('Process Costing', {
          ...sv(params.from_date, params.to_date),
          ...(params.process ? { DSPCOSTCENTRE: params.process } : {}),
        });
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  return count;
}
