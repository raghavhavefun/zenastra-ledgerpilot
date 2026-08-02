// src/tools/reports-financial.ts
// MODULE 4: Financial Reports — 15 tools

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

export function registerFinancialReportTools(server: McpServer, client: TallyClient, state: TallyState): number {
  let count = 0;
  const sv = (from: string, to: string): Record<string, string> => ({
    SVFROMDATE: from, SVTODATE: to,
    ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
  });

  // ── 1. tally_get_trial_balance ────────────────────────────────
  server.tool(
    'tally_get_trial_balance',
    'Fetch the trial balance for a date range. Returns all ledger/group balances with debit/credit totals.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Trial Balance', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 2. tally_get_profit_and_loss ──────────────────────────────
  server.tool(
    'tally_get_profit_and_loss',
    'Fetch the Profit & Loss statement for a date range.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Profit and Loss A/c', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 3. tally_get_balance_sheet ────────────────────────────────
  server.tool(
    'tally_get_balance_sheet',
    'Fetch the Balance Sheet as of a given date.',
    { as_of_date: z.string().describe('Balance sheet date (YYYYMMDD)') },
    async (params) => {
      try {
        const response = await client.exportReport('Balance Sheet', sv('20000101', params.as_of_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 4. tally_get_cash_flow ────────────────────────────────────
  server.tool(
    'tally_get_cash_flow',
    'Fetch the cash flow statement for a date range.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Cash Flow', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 5. tally_get_funds_flow ───────────────────────────────────
  server.tool(
    'tally_get_funds_flow',
    'Fetch the funds flow (working capital changes) statement for a date range.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Funds Flow', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 6. tally_get_ledger_vouchers ──────────────────────────────
  server.tool(
    'tally_get_ledger_vouchers',
    'Fetch all vouchers posted to a specific ledger within a date range (ledger statement).',
    {
      ledger_name: z.string().describe('Ledger name'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const config = TDLBuilder.buildVoucherQuery({ partyLedger: params.ledger_name });
        config.nativeMethods = ['Date', 'VoucherNumber', 'VoucherTypeName', 'PartyledgerName', 'Amount', 'Narration'];
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 7. tally_get_group_summary ────────────────────────────────
  server.tool(
    'tally_get_group_summary',
    'Fetch summary of all ledgers under a specific group with balances.',
    {
      group_name: z.string().describe('Account group name (e.g. "Sundry Debtors")'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Ledger',
          fetchFields: ['Name', 'Parent', 'ClosingBalance', 'OpeningBalance'],
          filters: { GroupFilter: `$Parent = "${params.group_name}"` },
        });
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 8. tally_get_daybook ──────────────────────────────────────
  server.tool(
    'tally_get_daybook',
    'Fetch the daybook (all vouchers for a single day or date range).',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Daybook', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 9. tally_get_cash_book ────────────────────────────────────
  server.tool(
    'tally_get_cash_book',
    'Fetch the cash book (all cash transactions) for a date range.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Cash Book', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 10. tally_get_bank_book ───────────────────────────────────
  server.tool(
    'tally_get_bank_book',
    'Fetch the bank book (all bank account transactions) for a date range.',
    {
      bank_ledger: z.string().optional().describe('Specific bank ledger name (omit for all bank accounts)'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const vars = sv(params.from_date, params.to_date);
        if (params.bank_ledger) vars['DSPLEDGER'] = params.bank_ledger;
        const response = await client.exportReport('Bank Book', vars);
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 11. tally_get_ratio_analysis ──────────────────────────────
  server.tool(
    'tally_get_ratio_analysis',
    'Fetch key financial ratios (current ratio, debt-equity, ROI etc.) from Tally.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Ratio Analysis', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 12. tally_get_budget_variance ─────────────────────────────
  server.tool(
    'tally_get_budget_variance',
    'Get budget vs actual variance for a specified budget and date range.',
    {
      budget_name: z.string().describe('Budget name as defined in Tally'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const vars = sv(params.from_date, params.to_date);
        vars['DSPBUDGETNAME'] = params.budget_name;
        const response = await client.exportReport('Budget Variance', vars);
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 13. tally_get_cost_centre_report ──────────────────────────
  server.tool(
    'tally_get_cost_centre_report',
    'Get a cost-centre-wise break-up of income/expenses.',
    {
      cost_centre: z.string().optional().describe('Specific cost centre (omit for all)'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const vars = sv(params.from_date, params.to_date);
        if (params.cost_centre) vars['DSPCOSTCENTRE'] = params.cost_centre;
        const response = await client.exportReport('Cost Centre', vars);
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 14. tally_get_profit_centre_report ────────────────────────
  server.tool(
    'tally_get_profit_centre_report',
    'Get profit-centre-wise profitability statement.',
    {
      profit_centre: z.string().optional().describe('Specific profit centre (omit for all)'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const vars = sv(params.from_date, params.to_date);
        if (params.profit_centre) vars['DSPCOSTCENTRE'] = params.profit_centre;
        const response = await client.exportReport('Profit Centre', vars);
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 15. tally_get_statistics ──────────────────────────────────
  server.tool(
    'tally_get_statistics',
    'Get company-level statistics: voucher counts by type, master counts, accounts info.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Statistics', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  return count;
}
