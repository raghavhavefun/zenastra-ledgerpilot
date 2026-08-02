// src/tools/gst.ts
// MODULE 7: GST — 18 tools for comprehensive GST compliance

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TallyClient } from '../tally-ported/client.mjs';
import { TallyState } from '../tally-ported/state.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
import { validateGSTIN } from '../tally-ported/validators.mjs';

const dateRangeSchema = {
  from_date: z.string().describe('Start date (YYYYMMDD)'),
  to_date: z.string().describe('End date (YYYYMMDD)'),
};

export function registerGstTools(server: McpServer, client: TallyClient, state: TallyState): number {
  let count = 0;
  const sv = (from: string, to: string) => ({
    SVFROMDATE: from, SVTODATE: to,
    ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
  });

  // ── 1. tally_get_gstr1 ───────────────────────────────────────
  server.tool(
    'tally_get_gstr1',
    'Get complete GSTR-1 return data (all outward supplies) for a period.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('GSTR-1', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 2. tally_get_gstr1_b2b ───────────────────────────────────
  server.tool(
    'tally_get_gstr1_b2b',
    'Get GSTR-1 B2B section: invoices to registered dealers.',
    dateRangeSchema,
    async (params) => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Voucher',
          fetchFields: ['Date', 'VoucherNumber', 'PartyledgerName', 'Amount', 'PartyGSTIN', 'VoucherTypeName'],
          filters: {
            TypeFilter: '$VoucherTypeName = "Sales"',
            GSTINFilter: '$$IsEmpty:$PartyGSTIN = No',
          },
        });
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 3. tally_get_gstr1_b2c ───────────────────────────────────
  server.tool(
    'tally_get_gstr1_b2c',
    'Get GSTR-1 B2C section: sales to unregistered consumers.',
    dateRangeSchema,
    async (params) => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Voucher',
          fetchFields: ['Date', 'VoucherNumber', 'PartyledgerName', 'Amount', 'PlaceOfSupply', 'VoucherTypeName'],
          filters: {
            TypeFilter: '$VoucherTypeName = "Sales"',
            GSTINFilter: '$$IsEmpty:$PartyGSTIN = Yes',
          },
        });
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 4. tally_get_gstr1_cdnr ──────────────────────────────────
  server.tool(
    'tally_get_gstr1_cdnr',
    'Get GSTR-1 CDNR section: credit/debit notes to registered parties.',
    dateRangeSchema,
    async (params) => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Voucher',
          fetchFields: ['Date', 'VoucherNumber', 'PartyledgerName', 'Amount', 'PartyGSTIN', 'VoucherTypeName'],
          filters: {
            TypeFilter: '$VoucherTypeName CONTAINS "Credit Note" OR $VoucherTypeName CONTAINS "Debit Note"',
          },
        });
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 5. tally_get_gstr2a ──────────────────────────────────────
  server.tool(
    'tally_get_gstr2a',
    'Get GSTR-2A data (auto-populated inward supplies from Tally).',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('GSTR-2', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 6. tally_get_gstr2b ──────────────────────────────────────
  server.tool(
    'tally_get_gstr2b',
    'Get GSTR-2B data (ITC available as per auto-drafted statement).',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('GSTR-2B', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 7. tally_get_gstr3b ──────────────────────────────────────
  server.tool(
    'tally_get_gstr3b',
    'Get GSTR-3B summary return data for a tax period.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('GSTR-3B', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 8. tally_get_hsn_summary ──────────────────────────────────
  server.tool(
    'tally_get_hsn_summary',
    'Get HSN/SAC code wise summary of outward and inward supplies.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('HSN/SAC Summary', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 9. tally_get_gst_tax_liability ────────────────────────────
  server.tool(
    'tally_get_gst_tax_liability',
    'Get GST tax liability: CGST, SGST, IGST, Cess breakdown.',
    dateRangeSchema,
    async (params) => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Ledger',
          fetchFields: ['Name', 'ClosingBalance', 'Parent'],
          filters: {
            GSTFilter: '$Parent = "Duties & Taxes" AND ($Name CONTAINS "CGST" OR $Name CONTAINS "SGST" OR $Name CONTAINS "IGST" OR $Name CONTAINS "Cess")',
          },
        });
        const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 10. tally_get_gst_itc ────────────────────────────────────
  server.tool(
    'tally_get_gst_itc',
    'Get Input Tax Credit (ITC) details — eligible, ineligible, reversed.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Input Credit', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 11. tally_get_gst_reconciliation ──────────────────────────
  server.tool(
    'tally_get_gst_reconciliation',
    'Get GST reconciliation: books vs returns, mismatch identification.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('GST Reconciliation', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 12. tally_generate_einvoice ───────────────────────────────
  server.tool(
    'tally_generate_einvoice',
    'Generate e-Invoice JSON for a specific sales voucher (for IRN generation).',
    {
      voucher_number: z.string().describe('Voucher number'),
      voucher_date: z.string().describe('Voucher date (YYYYMMDD)'),
    },
    async (params) => {
      try {
        const response = await client.exportReport('e-Invoice', {
          SVFROMDATE: params.voucher_date, SVTODATE: params.voucher_date,
          DSPVCHNO: params.voucher_number,
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 13. tally_generate_eway_bill ──────────────────────────────
  server.tool(
    'tally_generate_eway_bill',
    'Generate e-Way Bill JSON data for a voucher.',
    {
      voucher_number: z.string().describe('Voucher number'),
      voucher_date: z.string().describe('Voucher date (YYYYMMDD)'),
      transporter_id: z.string().optional().describe('Transporter GSTIN'),
      vehicle_number: z.string().optional().describe('Vehicle number'),
      distance_km: z.number().optional().describe('Distance in km'),
    },
    async (params) => {
      try {
        const response = await client.exportReport('e-Way Bill', {
          SVFROMDATE: params.voucher_date, SVTODATE: params.voucher_date,
          DSPVCHNO: params.voucher_number,
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 14. tally_get_gst_ims ────────────────────────────────────
  server.tool(
    'tally_get_gst_ims',
    'Get GST Invoice Management System (IMS) data.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('GST IMS', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 15. tally_get_gst_notices ─────────────────────────────────
  server.tool(
    'tally_get_gst_notices',
    'Get list of GST notices or exceptions flagged by Tally.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('GST Notices', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 16. tally_verify_gstin ────────────────────────────────────
  server.tool(
    'tally_verify_gstin',
    'Validate a GSTIN format and look up the party in Tally master data.',
    {
      gstin: z.string().describe('15-character GSTIN to verify'),
    },
    async (params) => {
      try {
        const validation = validateGSTIN(params.gstin);
        if (!validation.valid) return result({ status: 'validation_error', message: validation.error });

        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'Ledger',
          fetchFields: ['Name', 'PartyGSTIN', 'GSTRegistrationType', 'Parent', 'StateName'],
          filters: { GSTINFilter: `$PartyGSTIN = "${params.gstin}"` },
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

  // ── 17. tally_get_gst_return_status ───────────────────────────
  server.tool(
    'tally_get_gst_return_status',
    'Get status of GST return preparation and filing readiness.',
    {
      return_type: z.enum(['GSTR-1', 'GSTR-3B', 'GSTR-9']).describe('GST return type'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const response = await client.exportReport(`${params.return_type} Status`, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 18. tally_get_gst_exceptions ──────────────────────────────
  server.tool(
    'tally_get_gst_exceptions',
    'Get GST-related exceptions: mismatches in GSTIN, HSN, tax rates, place of supply etc.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('GST Exceptions', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  return count;
}
