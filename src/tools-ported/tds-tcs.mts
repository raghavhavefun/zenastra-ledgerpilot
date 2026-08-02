// src/tools/tds-tcs.ts
// MODULE 8: TDS/TCS — 12 tools for tax deducted/collected at source

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TallyClient } from '../tally-ported/client.mjs';
import { TallyState } from '../tally-ported/state.mjs';
import { XmlBuilder } from '../tally-ported/xml-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
import { validatePAN } from '../tally-ported/validators.mjs';

const dateRangeSchema = {
  from_date: z.string().describe('Start date (YYYYMMDD)'),
  to_date: z.string().describe('End date (YYYYMMDD)'),
};

export function registerTdsTcsTools(server: McpServer, client: TallyClient, state: TallyState): number {
  let count = 0;
  const sv = (from: string, to: string) => ({
    SVFROMDATE: from, SVTODATE: to,
    ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
  });

  // ── 1. tally_get_tds_computation ──────────────────────────────
  server.tool(
    'tally_get_tds_computation',
    'Get TDS computation report — deductions made, due amounts, rates applied.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('TDS Computation', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 2. tally_get_tds_outstanding ──────────────────────────────
  server.tool(
    'tally_get_tds_outstanding',
    'Get TDS outstanding report — deducted but not yet deposited.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('TDS Outstanding', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 3. tally_get_tds_payable_report ───────────────────────────
  server.tool(
    'tally_get_tds_payable_report',
    'Get TDS payable summary — section-wise and party-wise breakdown.',
    dateRangeSchema,
    async (params) => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Ledger',
          fetchFields: ['Name', 'ClosingBalance', 'Parent', 'TDSNatureOfPayment', 'TDSSectionNumber'],
          filters: { TDSFilter: '$IsTDSLedger = Yes OR $Parent = "TDS Payable"' },
        });
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 4. tally_get_tcs_computation ──────────────────────────────
  server.tool(
    'tally_get_tcs_computation',
    'Get TCS computation report — collection amounts, rates applied per party.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('TCS Computation', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 5. tally_get_tcs_outstanding ──────────────────────────────
  server.tool(
    'tally_get_tcs_outstanding',
    'Get TCS outstanding — collected but not deposited.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('TCS Outstanding', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 6. tally_get_form_26q ─────────────────────────────────────
  server.tool(
    'tally_get_form_26q',
    'Get Form 26Q data — quarterly TDS return for non-salary payments.',
    {
      quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).describe('Quarter'),
      financial_year: z.string().describe('Financial year (e.g. "2023-24")'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportReport('Form 26Q', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 7. tally_get_form_27q ─────────────────────────────────────
  server.tool(
    'tally_get_form_27q',
    'Get Form 27Q data — quarterly TDS return for payments to NRIs.',
    {
      quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).describe('Quarter'),
      financial_year: z.string().describe('Financial year (e.g. "2023-24")'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportReport('Form 27Q', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 8. tally_get_form_16 ─────────────────────────────────────
  server.tool(
    'tally_get_form_16',
    'Get Form 16/16A data for certificate generation.',
    {
      deductee_name: z.string().describe('Deductee name / employee name'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportReport('Form 16', {
          ...sv(params.from_date, params.to_date),
          DSPLEDGER: params.deductee_name,
        });
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 9. tally_verify_pan_tds ───────────────────────────────────
  server.tool(
    'tally_verify_pan_tds',
    'Validate PAN format and check if the party exists in Tally with valid PAN.',
    {
      pan: z.string().describe('10-character PAN to verify'),
    },
    async (params) => {
      try {
        const validation = validatePAN(params.pan);
        if (!validation.valid) return result({ status: 'validation_error', message: validation.error });

        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Ledger',
          fetchFields: ['Name', 'IncomeTaxNumber', 'Parent'],
          filters: { PANFilter: `$IncomeTaxNumber = "${params.pan}"` },
        });
        const response = await client.queryCollection(config, {
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        const matches = XmlParser.extractCollectionData(response.data);
        return result({ status: 'success', format_valid: true, tally_matches: matches });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 10. tally_get_tds_challan ─────────────────────────────────
  server.tool(
    'tally_get_tds_challan',
    'Get TDS challan details for a period (for deposit tracking).',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('TDS Challan', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 11. tally_get_lower_deduction_certificates ────────────────
  server.tool(
    'tally_get_lower_deduction_certificates',
    'List lower/nil deduction certificates recorded in Tally.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Lower Deduction Certificates', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 12. tally_get_tds_nature_summary ──────────────────────────
  server.tool(
    'tally_get_tds_nature_summary',
    'Get summary of TDS by nature of payment (section-wise: 194A, 194C, etc.).',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('TDS Nature Summary', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  return count;
}
