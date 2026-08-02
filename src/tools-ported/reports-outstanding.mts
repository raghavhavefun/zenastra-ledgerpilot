// src/tools/reports-outstanding.ts
// MODULE 6: Outstanding Reports — 8 tools

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TallyClient } from '../tally-ported/client.mjs';
import { TallyState } from '../tally-ported/state.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';

const dateRangeSchema = {
  from_date: z.string().describe('Start date (YYYYMMDD)'),
  to_date: z.string().describe('End date (YYYYMMDD)'),
};

export function registerOutstandingReportTools(server: McpServer, client: TallyClient, state: TallyState): number {
  let count = 0;
  const sv = (from: string, to: string) => ({
    SVFROMDATE: from, SVTODATE: to,
    ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
  });

  // ── 1. tally_get_receivables ──────────────────────────────────
  server.tool(
    'tally_get_receivables',
    'Get total receivables summary from Sundry Debtors with party breakup.',
    dateRangeSchema,
    async (params) => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Ledger',
          fetchFields: ['Name', 'ClosingBalance', 'OpeningBalance', 'Parent'],
          filters: { GroupFilter: '$Parent = "Sundry Debtors"' },
        });
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 2. tally_get_payables ─────────────────────────────────────
  server.tool(
    'tally_get_payables',
    'Get total payables summary from Sundry Creditors with party breakup.',
    dateRangeSchema,
    async (params) => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Ledger',
          fetchFields: ['Name', 'ClosingBalance', 'OpeningBalance', 'Parent'],
          filters: { GroupFilter: '$Parent = "Sundry Creditors"' },
        });
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 3. tally_get_bills_outstanding ────────────────────────────
  server.tool(
    'tally_get_bills_outstanding',
    'Get bill-wise outstanding for a specific party ledger.',
    {
      party_ledger: z.string().describe('Party ledger name'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Bill',
          fetchFields: ['Name', 'ClosingBalance', 'OpeningBalance', 'Parent', 'Date', 'CreditPeriod'],
          filters: { PartyFilter: `$Parent = "${params.party_ledger}"` },
        });
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 4. tally_get_overdue_receivables ──────────────────────────
  server.tool(
    'tally_get_overdue_receivables',
    'Get overdue receivables — bills past due date from Sundry Debtors.',
    dateRangeSchema,
    async (params) => {
      try {
        const config = TDLBuilder.buildOverdueQuery('Debtors');
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 5. tally_get_overdue_payables ─────────────────────────────
  server.tool(
    'tally_get_overdue_payables',
    'Get overdue payables — bills past due date from Sundry Creditors.',
    dateRangeSchema,
    async (params) => {
      try {
        const config = TDLBuilder.buildOverdueQuery('Creditors');
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 6. tally_get_party_outstanding ────────────────────────────
  server.tool(
    'tally_get_party_outstanding',
    'Get consolidated outstanding for a specific party (debtor or creditor).',
    {
      party_ledger: z.string().describe('Party ledger name'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportObject('Ledger', params.party_ledger, [], sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractObjectData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 7. tally_get_ageing_analysis ──────────────────────────────
  server.tool(
    'tally_get_ageing_analysis',
    'Get ageing analysis (0-30, 31-60, 61-90, 90+ days) for receivables or payables.',
    {
      group: z.enum(['Sundry Debtors', 'Sundry Creditors']).describe('Group to age'),
      ...dateRangeSchema,
      intervals: z.array(z.number()).optional().describe('Custom ageing intervals in days (e.g. [30, 60, 90])'),
    },
    async (params) => {
      try {
        const type = params.group === 'Sundry Debtors' ? 'Debtors' as const : 'Creditors' as const;
        const config = TDLBuilder.buildAgeingAnalysis(type, params.intervals || [30, 60, 90]);
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 8. tally_get_interest_calculation ─────────────────────────
  server.tool(
    'tally_get_interest_calculation',
    'Get simple interest calculation on outstanding balances.',
    {
      party_ledger: z.string().describe('Party ledger name'),
      rate: z.number().describe('Annual interest rate percentage'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportReport('Interest Calculation', {
          ...sv(params.from_date, params.to_date),
          DSPLEDGER: params.party_ledger,
        });
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  return count;
}
