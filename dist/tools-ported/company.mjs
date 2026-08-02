// src/tools/company.ts
// MODULE 14: Company — 8 tools for company management and configuration
import { z } from 'zod';
import { XmlBuilder } from '../tally-ported/xml-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
export function registerCompanyTools(server, client, state) {
    let count = 0;
    const getCompany = () => state.activeCompany || undefined;
    // ── 1. tally_list_companies ───────────────────────────────────
    server.tool('tally_list_companies', 'List all companies loaded in TallyPrime.', {}, async () => {
        try {
            const companies = await client.getCompanyList();
            return result({ status: 'success', companies });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 2. tally_get_company_info ─────────────────────────────────
    server.tool('tally_get_company_info', 'Get comprehensive info about a company — name, address, FY, GST, features enabled.', {
        company_name: z.string().optional().describe('Company name (defaults to active company)'),
    }, async (params) => {
        try {
            const companyName = params.company_name || state.activeCompany;
            if (!companyName)
                return result({ status: 'error', message: 'No company specified or active' });
            const response = await client.exportObject('Company', companyName, [], {
                SVCURRENTCOMPANY: companyName,
            });
            return result({ status: 'success', data: XmlParser.extractObjectData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 3. tally_set_active_company ───────────────────────────────
    server.tool('tally_set_active_company', 'Set the active company for all subsequent operations.', {
        company_name: z.string().describe('Company name to set as active'),
    }, async (params) => {
        try {
            state.activeCompany = params.company_name;
            await state.refresh();
            return result({ status: 'success', active_company: params.company_name, message: 'Active company updated and caches refreshed.' });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 4. tally_alter_company ────────────────────────────────────
    server.tool('tally_alter_company', 'Update company configuration — address, statutory info, features.', {
        name: z.string().describe('Company name'),
        address: z.string().optional().describe('Updated address'),
        state_name: z.string().optional().describe('State name'),
        pincode: z.string().optional().describe('PIN code'),
        phone: z.string().optional().describe('Phone number'),
        email: z.string().optional().describe('Email address'),
        website: z.string().optional().describe('Website URL'),
        gstin: z.string().optional().describe('GSTIN'),
        pan: z.string().optional().describe('PAN'),
        enable_gst: z.boolean().optional().describe('Enable GST features'),
        enable_tds: z.boolean().optional().describe('Enable TDS features'),
        enable_payroll: z.boolean().optional().describe('Enable Payroll features'),
        enable_inventory: z.boolean().optional().describe('Enable Inventory features'),
    }, async (params) => {
        try {
            const xml = XmlBuilder.buildCompanyXml({ ...params, action: 'alter' });
            const response = await client.importMasters(xml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 5. tally_test_connection ──────────────────────────────────
    server.tool('tally_test_connection', 'Test if TallyPrime is running and reachable. Returns version and active company info.', {}, async () => {
        try {
            const isConnected = await client.testConnection();
            if (!isConnected) {
                return result({ status: 'error', message: 'Cannot connect to TallyPrime. Ensure it is running with XML server enabled.' });
            }
            const companies = await client.getCompanyList();
            return result({
                status: 'success',
                connected: true,
                active_company: state.activeCompany,
                companies,
                cache_stats: state.getCacheStats(),
            });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 6. tally_refresh_cache ────────────────────────────────────
    server.tool('tally_refresh_cache', 'Force-refresh the master data cache (ledgers, stock items, groups, etc.).', {}, async () => {
        try {
            await state.refresh();
            return result({
                status: 'success',
                message: 'Cache refreshed.',
                cache_stats: state.getCacheStats(),
            });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 7. tally_get_license_info ─────────────────────────────────
    server.tool('tally_get_license_info', 'Get TallyPrime license information: edition, serial number, features.', {}, async () => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'Company',
                fetchFields: ['Name', 'LicenseNumber', 'LicenseInfo', 'TallyVersion'],
            });
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
    // ── 8. tally_get_feature_status ───────────────────────────────
    server.tool('tally_get_feature_status', 'Check which features are enabled in the active company (F11/F12 settings).', {}, async () => {
        try {
            const companyName = state.activeCompany;
            if (!companyName)
                return result({ status: 'error', message: 'No active company' });
            const response = await client.exportObject('Company', companyName, [], {
                SVCURRENTCOMPANY: companyName,
            });
            return result({ status: 'success', data: XmlParser.extractObjectData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    return count;
}
//# sourceMappingURL=company.mjs.map