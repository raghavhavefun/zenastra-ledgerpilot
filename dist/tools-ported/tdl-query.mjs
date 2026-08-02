// src/tools/tdl-query.ts
// MODULE 16: TDL Query Engine — 12 tools — The Intelligence Layer
import { z } from 'zod';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
export function registerTdlQueryTools(server, client, state) {
    let count = 0;
    const sv = (from, to) => ({
        ...(from ? { SVFROMDATE: from } : {}),
        ...(to ? { SVTODATE: to } : {}),
        ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
    });
    // ── 1. tally_query_collection ─────────────────────────────────
    server.tool('tally_query_collection', 'Run a custom TDL collection query against TallyPrime. This is the most flexible query tool — specify object type, fields to fetch, and filter conditions.', {
        collection_type: z.string().describe('Tally object type (e.g. "Ledger", "Voucher", "StockItem", "Group", "Bill", "Batch", "Employee", "CostCentre")'),
        fetch_fields: z.array(z.string()).describe('Field names to fetch (e.g. ["Name", "Parent", "ClosingBalance"])'),
        filters: z.record(z.string(), z.string()).optional().describe('Named TDL filter expressions (e.g. {"GroupFilter": "$Parent = \\"Sundry Debtors\\""})'),
        from_date: z.string().optional().describe('Start date for date-sensitive queries (YYYYMMDD)'),
        to_date: z.string().optional().describe('End date (YYYYMMDD)'),
    }, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: params.collection_type,
                fetchFields: params.fetch_fields,
                ...(params.filters ? { filters: params.filters } : {}),
            });
            const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 2. tally_execute_tdl_inline ───────────────────────────────
    server.tool('tally_execute_tdl_inline', 'Execute raw inline TDL code in TallyPrime. POWER TOOL — for advanced queries not covered by other tools. The TDL snippet is injected inside the XML request.', {
        tdl_snippet: z.string().describe('Raw TDL code (collection/function definitions). Will be wrapped in XML envelope automatically.'),
        collection_name: z.string().optional().describe('Name of the collection to fetch results from (if the TDL defines a collection)'),
        from_date: z.string().optional().describe('Start date (YYYYMMDD)'),
        to_date: z.string().optional().describe('End date (YYYYMMDD)'),
    }, async (params) => {
        try {
            const response = await client.queryRawTdlCollection(params.collection_name || 'MyCollection', params.tdl_snippet, sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 3. tally_evaluate_function ────────────────────────────────
    server.tool('tally_evaluate_function', 'Evaluate a TDL function in TallyPrime and get the result. Use for computed values, aggregations, conditionals.', {
        function_name: z.string().describe('TDL function name to evaluate'),
        function_body: z.string().describe('TDL function body (e.g. "$$Total:StockItemClosingBalance")'),
        from_date: z.string().optional().describe('Start date'),
        to_date: z.string().optional().describe('End date'),
    }, async (params) => {
        try {
            const config = {
                name: params.function_name,
                formula: params.function_body,
                returns: 'String',
            };
            const response = await client.evaluateFunction(config);
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 4. tally_export_object ────────────────────────────────────
    server.tool('tally_export_object', 'Export a complete Tally object by type and name — returns full XML representation with all fields.', {
        object_type: z.enum(['Ledger', 'StockItem', 'Group', 'StockGroup', 'Voucher', 'Company', 'Employee', 'CostCentre', 'Godown', 'Budget', 'VoucherType', 'Unit', 'Currency']).describe('Object type'),
        object_name: z.string().describe('Object name'),
    }, async (params) => {
        try {
            const response = await client.exportObject(params.object_type, params.object_name, [], {
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
            });
            return result({ status: 'success', data: XmlParser.extractObjectData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 5. tally_export_report ────────────────────────────────────
    server.tool('tally_export_report', 'Export any named Tally report as XML. Use when a specific report module tool is not available.', {
        report_name: z.string().describe('Tally report name (e.g. "Trial Balance", "Balance Sheet", "Daybook", "Stock Summary")'),
        from_date: z.string().describe('Start date (YYYYMMDD)'),
        to_date: z.string().describe('End date (YYYYMMDD)'),
        extra_params: z.record(z.string(), z.string()).optional().describe('Additional static variables (e.g. {"DSPLEDGER": "Cash"})'),
    }, async (params) => {
        try {
            const staticVars = {
                ...sv(params.from_date, params.to_date),
                ...(params.extra_params || {}),
            };
            const response = await client.exportReport(params.report_name, staticVars);
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 6. tally_execute_action ───────────────────────────────────
    server.tool('tally_execute_action', 'Execute a TDL action in TallyPrime (e.g. alter company settings, run macros).', {
        action_name: z.string().describe('TDL action name'),
        action_body: z.string().describe('TDL action XML/code'),
    }, async (params) => {
        try {
            const xmlPayload = params.action_body;
            const response = await client.postXml(xmlPayload);
            return result({ status: 'success', data: response });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 7. tally_search_masters ───────────────────────────────────
    server.tool('tally_search_masters', 'Fuzzy search across all master types: ledgers, stock items, groups, cost centres. Returns matching names.', {
        query: z.string().describe('Search text (partial name match)'),
        master_types: z.array(z.enum(['Ledger', 'StockItem', 'Group', 'StockGroup', 'CostCentre', 'Godown', 'Employee'])).optional().describe('Master types to search (default: all)'),
    }, async (params) => {
        try {
            const types = params.master_types || ['Ledger', 'StockItem', 'Group', 'CostCentre', 'Employee'];
            const results = {};
            for (const type of types) {
                const config = TDLBuilder.buildCustomCollection({
                    collectionType: type,
                    fetchFields: ['Name', 'Parent'],
                    filters: { SearchFilter: `$Name CONTAINS "${params.query}"` },
                });
                const response = await client.queryCollection(config, {
                    ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
                });
                results[type] = XmlParser.extractCollectionData(response.data);
            }
            return result({ status: 'success', query: params.query, matches: results });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 8. tally_get_master_names ─────────────────────────────────
    server.tool('tally_get_master_names', 'Get a quick list of all names for a given master type. Uses cached data when available.', {
        master_type: z.enum(['Ledger', 'StockItem', 'Group', 'VoucherType', 'CostCentre', 'Godown', 'Unit', 'Employee']).describe('Master type'),
    }, async (params) => {
        try {
            const cacheMap = {
                Ledger: [...state.ledgerNames],
                StockItem: [...state.stockItemNames],
                Group: [...state.groupNames],
                VoucherType: [...state.voucherTypes],
                CostCentre: [...state.costCentreNames],
                Godown: [...state.godownNames],
                Unit: [...state.unitNames],
                Employee: [...state.employeeNames],
            };
            const cached = cacheMap[params.master_type];
            if (cached && cached.length > 0) {
                return result({ status: 'success', source: 'cache', count: cached.length, names: cached });
            }
            // Fallback to live query
            const config = TDLBuilder.buildCustomCollection({
                collectionType: params.master_type,
                fetchFields: ['Name'],
            });
            const response = await client.queryCollection(config, {
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
            });
            const names = XmlParser.extractNameList(response.data, params.master_type.toUpperCase());
            return result({ status: 'success', source: 'live', count: names.length, names });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 9. tally_import_raw_xml ───────────────────────────────────
    server.tool('tally_import_raw_xml', 'Import raw XML into TallyPrime. POWER TOOL — for advanced use when building custom XML payloads.', {
        xml_payload: z.string().describe('Complete XML request to send to TallyPrime'),
        import_type: z.enum(['masters', 'vouchers']).describe('Type of import'),
    }, async (params) => {
        try {
            const response = params.import_type === 'masters'
                ? await client.importMasters(params.xml_payload, state.activeCompany || undefined)
                : await client.importVouchers(params.xml_payload, state.activeCompany || undefined);
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 10. tally_send_raw_xml ────────────────────────────────────
    server.tool('tally_send_raw_xml', 'Send any raw XML request to TallyPrime and get the raw response. Ultimate flexibility.', {
        xml_request: z.string().describe('Complete XML request body'),
    }, async (params) => {
        try {
            const response = await client.postXml(params.xml_request);
            return result({ status: 'success', data: response });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 11. tally_get_collection_types ────────────────────────────
    server.tool('tally_get_collection_types', 'Get a reference of available Tally collection types and common fetch fields for building queries.', {}, async () => {
        const reference = {
            Ledger: {
                common_fields: ['Name', 'Parent', 'ClosingBalance', 'OpeningBalance', 'CreditPeriod', 'Address', 'PartyGSTIN', 'GSTRegistrationType', 'IncomeTaxNumber', 'StateName', 'IsBillwiseOn'],
                description: 'Account ledgers (parties, expenses, incomes, assets, liabilities)',
            },
            Group: {
                common_fields: ['Name', 'Parent', 'IsRevenue', 'IsSubledger', 'GroupClosingBalance'],
                description: 'Account groups (hierarchical classification of ledgers)',
            },
            Voucher: {
                common_fields: ['Date', 'VoucherNumber', 'VoucherTypeName', 'PartyledgerName', 'Amount', 'Narration', 'IsOptional', 'IsCancelled', 'BankDate', 'PartyGSTIN'],
                description: 'Transactions/vouchers (sales, purchases, receipts, payments, journals etc.)',
            },
            StockItem: {
                common_fields: ['Name', 'Parent', 'BaseUnits', 'ClosingBalance', 'ClosingRate', 'ClosingValue', 'OpeningBalance', 'OpeningRate', 'OpeningValue', 'HSNCode', 'GSTRate', 'ReorderLevel'],
                description: 'Inventory items',
            },
            StockGroup: {
                common_fields: ['Name', 'Parent'],
                description: 'Hierarchical grouping of stock items',
            },
            StockCategory: {
                common_fields: ['Name', 'Parent'],
                description: 'Category-based classification of stock items',
            },
            CostCentre: {
                common_fields: ['Name', 'Parent', 'Category'],
                description: 'Cost centres / profit centres for cost allocation',
            },
            Godown: {
                common_fields: ['Name', 'Parent', 'Address'],
                description: 'Warehouses / storage locations',
            },
            Employee: {
                common_fields: ['Name', 'Parent', 'DateOfJoining', 'Designation', 'Function', 'Location'],
                description: 'Employees for payroll',
            },
            Unit: {
                common_fields: ['Name', 'FormalName', 'IsSimpleUnit', 'DecimalPlaces'],
                description: 'Units of measure',
            },
            Currency: {
                common_fields: ['Name', 'OriginalName', 'FormalName', 'InMillions', 'DecimalPlaces', 'DecimalSymbol'],
                description: 'Currencies',
            },
            Bill: {
                common_fields: ['Name', 'Parent', 'ClosingBalance', 'OpeningBalance', 'Date', 'CreditPeriod'],
                description: 'Individual bills under party ledgers (for bill-wise tracking)',
            },
            Batch: {
                common_fields: ['Name', 'StockItemName', 'ClosingBalance', 'GodownName', 'MfgDate', 'ExpiryDate'],
                description: 'Stock batches for batch-wise tracking',
            },
            Budget: {
                common_fields: ['Name'],
                description: 'Budget definitions',
            },
            VoucherType: {
                common_fields: ['Name', 'Parent', 'NumberingMethod', 'IsTaxInvoice'],
                description: 'Voucher type definitions',
            },
            PayHead: {
                common_fields: ['Name', 'Parent', 'PayType', 'CalculationType'],
                description: 'Payroll pay head definitions',
            },
        };
        return result({ status: 'success', reference });
    });
    count++;
    // ── 12. tally_get_tdl_syntax_help ─────────────────────────────
    server.tool('tally_get_tdl_syntax_help', 'Get TDL syntax reference for building custom queries and functions. Includes collection syntax, filter patterns, function patterns.', {
        topic: z.enum(['collections', 'filters', 'functions', 'methods', 'overview']).optional().describe('Specific topic (default: overview)'),
    }, async (params) => {
        const topic = params.topic || 'overview';
        const help = {
            overview: {
                description: 'TDL (Tally Definition Language) is used to query and manipulate TallyPrime data.',
                key_concepts: [
                    'Collections: Named sets of objects (like SQL tables)',
                    'Fields/Methods: Properties of objects (like columns)',
                    'Filters: Boolean expressions to filter collections',
                    'Functions: Computed values using TDL expressions',
                    'Inline TDL: TDL snippets embedded in XML requests',
                ],
                tips: [
                    'Use tally_query_collection for most queries — it handles TDL generation',
                    'Use tally_execute_tdl_inline only when you need complex custom TDL',
                    'Use tally_get_collection_types to know available fields',
                    'Field values are accessed with $ prefix: $Name, $Amount',
                    'Built-in functions use $$ prefix: $$IsEmpty, $$Total, $$Date',
                ],
            },
            collections: {
                syntax: '[Collection: <name>]\nType: <ObjectType>\nChildOf: <optional parent>\nBelongsTo: Yes/No\nFetch: <field1>, <field2>\nFilter: <FilterName>\nSort: <SortDefinition>',
                example: '[Collection: MyLedgers]\nType: Ledger\nFetch: Name, Parent, ClosingBalance\nFilter: DebtorFilter\n\n[System: Formula]\nDebtorFilter: $Parent = "Sundry Debtors"',
            },
            filters: {
                operators: ['= (equals)', '!= (not equals)', '> < >= <= (comparison)', 'CONTAINS (substring match)', 'AND, OR, NOT (logical)', 'STARTING WITH, ENDING WITH'],
                syntax: '$FieldName OPERATOR "value"',
                examples: [
                    '$Parent = "Sundry Debtors"',
                    '$ClosingBalance > 10000',
                    '$Name CONTAINS "Sales"',
                    '$Parent = "Bank Accounts" OR $Parent = "Cash-in-Hand"',
                    '$$IsEmpty:$PartyGSTIN = No',
                    '$Date >= $$Date:"20240101"',
                ],
                built_in_functions: [
                    '$$IsEmpty:<field> — check if empty',
                    '$$Date:"YYYYMMDD" — date literal',
                    '$$Total:<collection>:<field> — aggregate',
                    '$$String:<expr> — convert to string',
                    '$$Number:<expr> — convert to number',
                ],
            },
            functions: {
                syntax: '[Function: <name>]\nParameter: <param1>: String\n<expr1>\n<expr2>',
                examples: [
                    '$$Total:Ledger:ClosingBalance — sum all closing balances',
                    '$$NumItems:Voucher — count vouchers',
                ],
            },
            methods: {
                ledger: ['Name', 'Parent', 'OpeningBalance', 'ClosingBalance', 'CreditPeriod', 'Address', 'PartyGSTIN', 'IncomeTaxNumber', 'StateName', 'CountryName'],
                voucher: ['Date', 'VoucherNumber', 'VoucherTypeName', 'PartyledgerName', 'Amount', 'Narration', 'IsOptional', 'IsCancelled', 'EffectiveDate', 'BankDate'],
                stockItem: ['Name', 'Parent', 'BaseUnits', 'ClosingBalance', 'ClosingRate', 'ClosingValue', 'ReorderLevel', 'HSNCode', 'GSTRate'],
            },
        };
        return result({ status: 'success', topic, help: help[topic] || help.overview });
    });
    count++;
    return count;
}
//# sourceMappingURL=tdl-query.mjs.map