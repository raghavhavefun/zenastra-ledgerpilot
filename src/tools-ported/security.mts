// src/tools/security.ts
// MODULE 13: Security — 8 tools for user management and audit

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

export function registerSecurityTools(server: McpServer, client: TallyClient, state: TallyState): number {
  let count = 0;
  const getCompany = () => state.activeCompany || undefined;
  const sv = (from: string, to: string) => ({
    SVFROMDATE: from, SVTODATE: to,
    ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
  });

  // ── 1. tally_create_user ──────────────────────────────────────
  server.tool(
    'tally_create_user',
    'Create a Tally user with specific security level / access rights.',
    {
      name: z.string().describe('Username'),
      security_level: z.enum(['Owner', 'Data Entry', 'Operator']).optional().describe('Security level'),
      password: z.string().optional().describe('User password'),
      allow_remote_access: z.boolean().optional().describe('Allow remote access'),
    },
    async (params) => {
      try {
        const xml = XmlBuilder.buildUserXml(params);
        const response = await client.importMasters(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 2. tally_alter_user ───────────────────────────────────────
  server.tool(
    'tally_alter_user',
    'Update an existing Tally user (change security level, password, etc.).',
    {
      name: z.string().describe('Current username'),
      new_name: z.string().optional().describe('New username'),
      security_level: z.enum(['Owner', 'Data Entry', 'Operator']).optional().describe('New security level'),
      password: z.string().optional().describe('New password'),
      allow_remote_access: z.boolean().optional().describe('Allow remote access'),
    },
    async (params) => {
      try {
        const xml = XmlBuilder.buildUserXml({ ...params, action: 'alter' });
        const response = await client.importMasters(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 3. tally_delete_user ──────────────────────────────────────
  server.tool(
    'tally_delete_user',
    'Delete a Tally user.',
    { name: z.string().describe('Username to delete') },
    async (params) => {
      try {
        const xml = XmlBuilder.buildDeleteMasterXml('User', params.name);
        const response = await client.importMasters(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 4. tally_list_users ───────────────────────────────────────
  server.tool(
    'tally_list_users',
    'List all Tally users and their security levels.',
    {},
    async () => {
      try {
        const config = TDLBuilder.buildCustomCollection({
          collectionType: 'User',
          fetchFields: ['Name', 'SecurityLevel'],
        });
        const response = await client.queryCollection(config, {
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 5. tally_get_audit_log ────────────────────────────────────
  server.tool(
    'tally_get_audit_log',
    'Get audit trail / activity log — who changed what and when.',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Audit Listing', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 6. tally_get_altered_vouchers_log ─────────────────────────
  server.tool(
    'tally_get_altered_vouchers_log',
    'Get list of vouchers that were altered/modified (for audit purposes).',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Altered Vouchers', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 7. tally_get_deleted_vouchers_log ─────────────────────────
  server.tool(
    'tally_get_deleted_vouchers_log',
    'Get list of deleted/cancelled vouchers (for audit trail).',
    dateRangeSchema,
    async (params) => {
      try {
        const response = await client.exportReport('Cancelled/Deleted Vouchers', sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 8. tally_get_exception_reports ────────────────────────────
  server.tool(
    'tally_get_exception_reports',
    'Get data exception reports — negative stock, zero-value vouchers, unusual entries.',
    {
      exception_type: z.enum([
        'Negative Stock', 'Negative Ledger', 'Optional Vouchers',
        'Zero Value', 'Pending Vouchers', 'All'
      ]).optional().describe('Type of exception to check'),
      ...dateRangeSchema,
    },
    async (params) => {
      try {
        const reportName = params.exception_type === 'All' || !params.exception_type
          ? 'Exception Reports'
          : `Exception - ${params.exception_type}`;
        const response = await client.exportReport(reportName, sv(params.from_date, params.to_date));
        return result({ status: 'success', data: response.data });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  return count;
}
