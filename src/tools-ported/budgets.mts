// src/tools/budgets.ts
// MODULE 12: Budgets — 8 tools for budget management

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

export function registerBudgetTools(server: McpServer, client: TallyClient, state: TallyState): number {
  let count = 0;
  const getCompany = () => state.activeCompany || undefined;
  const sv = (from: string, to: string): Record<string, string> => ({
    SVFROMDATE: from, SVTODATE: to,
    ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
  });

  // ── 1. tally_create_budget ────────────────────────────────────
  server.tool(
    'tally_create_budget',
    'Create a budget with allocations for ledgers/groups by period.',
    {
      name: z.string().describe('Budget name'),
      budget_for: z.enum(['Group', 'Ledger']).describe('Budget level'),
      ...dateRangeSchema,
      allocations: z.array(z.object({
        name: z.string().describe('Ledger or group name'),
        amount: z.number().describe('Budget amount for the period'),
        period_from: z.string().optional().describe('Period start (YYYYMMDD)'),
        period_to: z.string().optional().describe('Period end (YYYYMMDD)'),
      })).describe('Budget allocations'),
    },
    async (params) => {
      try {
        const xml = XmlBuilder.buildBudgetXml({
          name: params.name,
          budget_for: params.budget_for,
          from_date: params.from_date,
          to_date: params.to_date,
          allocations: params.allocations,
        });
        const response = await client.importMasters(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 2. tally_alter_budget ─────────────────────────────────────
  server.tool(
    'tally_alter_budget',
    'Update an existing budget allocations.',
    {
      name: z.string().describe('Budget name'),
      allocations: z.array(z.object({
        name: z.string().describe('Ledger or group name'),
        amount: z.number().describe('Updated budget amount'),
        period_from: z.string().optional().describe('Period start'),
        period_to: z.string().optional().describe('Period end'),
      })).describe('Updated allocations'),
    },
    async (params) => {
      try {
        const xml = XmlBuilder.buildBudgetXml({
          name: params.name,
          allocations: params.allocations,
          action: 'alter',
        });
        const response = await client.importMasters(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 3. tally_delete_budget ────────────────────────────────────
  server.tool(
    'tally_delete_budget',
    'Delete a budget.',
    { name: z.string().describe('Budget name to delete') },
    async (params) => {
      try {
        const xml = XmlBuilder.buildDeleteMasterXml('Budget', params.name);
        const response = await client.importMasters(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 4. tally_list_budgets ─────────────────────────────────────
  server.tool(
    'tally_list_budgets',
    'List all budgets defined in the company.',
    {},
    async () => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Budget',
          fetchFields: ['Name'],
        });
        const response = await client.queryCollection(config, {
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 5. tally_get_budget_detail ────────────────────────────────
  server.tool(
    'tally_get_budget_detail',
    'Get details of a specific budget including all allocations.',
    { budget_name: z.string().describe('Budget name') },
    async (params) => {
      try {
        const response = await client.exportObject('Budget', params.budget_name, [], {
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        return result({ status: 'success', data: XmlParser.extractObjectData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 6. tally_get_budget_vs_actual ─────────────────────────────
  server.tool(
    'tally_get_budget_vs_actual',
    'Get budget vs actual comparison report.',
    {
      budget_name: z.string().describe('Budget name'),
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

  // ── 7. tally_get_budget_utilization ───────────────────────────
  server.tool(
    'tally_get_budget_utilization',
    'Get budget utilization percentage — how much of the budget has been consumed.',
    {
      budget_name: z.string().describe('Budget name'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const vars = sv(params.from_date, params.to_date);
        vars['DSPBUDGETNAME'] = params.budget_name;
        const response = await client.exportReport('Budget Utilization', vars);
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 8. tally_get_scenario_report ──────────────────────────────
  server.tool(
    'tally_get_scenario_report',
    'Get scenario-based report (actual, budget, what-if) for financial planning.',
    {
      scenario: z.string().optional().describe('Scenario name (as defined in Tally)'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const vars = sv(params.from_date, params.to_date);
        if (params.scenario) vars['DSPSCENARIO'] = params.scenario;
        const response = await client.exportReport('Scenario', vars);
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  return count;
}
