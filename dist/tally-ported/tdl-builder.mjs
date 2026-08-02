// src/tally/tdl-builder.ts
// Programmatic TDL inline snippet builder for TallyPrime MCP Server
import { XmlBuilder } from './xml-builder.mjs';
export class TDLBuilder {
    /**
     * Build a COLLECTION TDL snippet in XML format
     */
    static buildCollection(config) {
        let tdl = `<COLLECTION NAME="${XmlBuilder.esc(config.name)}" ISINITIALIZE="Yes">`;
        tdl += `\n            <TYPE>${XmlBuilder.esc(config.type)}</TYPE>`;
        if (config.childOf) {
            tdl += `\n            <CHILDOF>${XmlBuilder.esc(config.childOf)}</CHILDOF>`;
        }
        else if (config.voucherType) {
            tdl += `\n            <CHILDOF>${XmlBuilder.esc(config.voucherType)}</CHILDOF>`;
        }
        if (config.belongsTo) {
            tdl += `\n            <BELONGSTO>${XmlBuilder.esc(config.belongsTo)}</BELONGSTO>`;
        }
        // Native methods
        if (config.nativeMethods) {
            for (const method of config.nativeMethods) {
                tdl += `\n            <NATIVEMETHOD>${XmlBuilder.esc(method)}</NATIVEMETHOD>`;
            }
        }
        // Fetch objects
        if (config.fetchObjects) {
            for (const obj of config.fetchObjects) {
                tdl += `\n            <FETCHOBJECT>${XmlBuilder.esc(obj)}</FETCHOBJECT>`;
            }
        }
        // Filters
        if (config.filters) {
            for (const filter of config.filters) {
                tdl += `\n            <FILTER>${XmlBuilder.esc(filter)}</FILTER>`;
            }
        }
        // Computed fields
        if (config.computeFields) {
            for (const comp of config.computeFields) {
                tdl += `\n            <COMPUTE>${XmlBuilder.esc(comp.name)}: ${comp.formula}</COMPUTE>`;
            }
        }
        // Sort
        if (config.sortBy) {
            tdl += `\n            <SORTBY>${config.sortBy}</SORTBY>`;
        }
        tdl += `\n          </COLLECTION>`;
        // Filter formulae as SYSTEM elements
        if (config.filterFormulae) {
            for (const ff of config.filterFormulae) {
                tdl += `\n          <SYSTEM TYPE="Formulae" NAME="${XmlBuilder.esc(ff.name)}">`;
                tdl += `\n            ${ff.formula}`;
                tdl += `\n          </SYSTEM>`;
            }
        }
        return tdl;
    }
    /**
     * Build a FUNCTION TDL snippet in XML format
     */
    static buildFunction(config) {
        let tdl = `<FUNCTION NAME="${XmlBuilder.esc(config.name)}"`;
        if (config.params && config.params.length > 0) {
            tdl += ` PARAMS="${config.params.join(',')}"`;
        }
        tdl += `>`;
        tdl += `\n            <RETURNS>${XmlBuilder.esc(config.returns)}</RETURNS>`;
        tdl += `\n            <LOCALFORMULA>${XmlBuilder.esc(config.returns)}: ${config.formula}</LOCALFORMULA>`;
        tdl += `\n          </FUNCTION>`;
        return tdl;
    }
    /**
     * Build complete inline TDL XML envelope for a Collection query
     */
    static buildCollectionRequest(config, staticVars = {}) {
        const tdlMessage = this.buildCollection(config);
        return XmlBuilder.buildInlineTdlCollectionRequest(config.name, tdlMessage, staticVars);
    }
    /**
     * Build complete inline TDL XML envelope for Function evaluation
     */
    static buildFunctionRequest(config, params = []) {
        const tdlMessage = this.buildFunction(config);
        return XmlBuilder.buildFunctionRequest(config.name, tdlMessage, params);
    }
    // ── Preset Collection Builders ────────────────────────────────
    /**
     * Build a ledger list query with optional filters
     */
    static buildLedgerListQuery(options = {}) {
        const config = {
            name: 'MCPLedgerQuery',
            type: 'Ledger',
            nativeMethods: options.fields || ['Name', 'Parent', 'ClosingBalance', 'OpeningBalance'],
            filters: [],
            filterFormulae: [],
        };
        if (options.parentGroup) {
            config.childOf = options.parentGroup;
        }
        if (options.minBalance !== undefined) {
            config.filters.push('MCPMinBalance');
            config.filterFormulae.push({
                name: 'MCPMinBalance',
                formula: `$$NumValue:$ClosingBalance >= ${options.minBalance}`,
            });
        }
        if (options.maxBalance !== undefined) {
            config.filters.push('MCPMaxBalance');
            config.filterFormulae.push({
                name: 'MCPMaxBalance',
                formula: `$$NumValue:$ClosingBalance <= ${options.maxBalance}`,
            });
        }
        if (options.hasGstin) {
            config.filters.push('MCPHasGSTIN');
            config.filterFormulae.push({
                name: 'MCPHasGSTIN',
                formula: `$$Length:$GSTIN > 0`,
            });
        }
        return config;
    }
    /**
     * Build a voucher query with filters
     */
    static buildVoucherQuery(options = {}) {
        const config = {
            name: 'MCPVoucherQuery',
            type: 'Voucher',
            nativeMethods: options.fields || [
                'Date', 'VoucherNumber', 'VoucherTypeName', 'PartyledgerName',
                'Amount', 'Narration',
            ],
            filters: [],
            filterFormulae: [],
        };
        if (options.voucherType) {
            config.filters.push('MCPVchType');
            config.filterFormulae.push({
                name: 'MCPVchType',
                formula: `$VoucherTypeName = "${options.voucherType}"`,
            });
        }
        if (options.partyLedger) {
            config.filters.push('MCPParty');
            config.filterFormulae.push({
                name: 'MCPParty',
                formula: `$PartyLedgerName = "${options.partyLedger}"`,
            });
        }
        if (options.minAmount !== undefined) {
            config.filters.push('MCPMinAmt');
            config.filterFormulae.push({
                name: 'MCPMinAmt',
                formula: `$$NumValue:$Amount >= ${options.minAmount}`,
            });
        }
        if (options.maxAmount !== undefined) {
            config.filters.push('MCPMaxAmt');
            config.filterFormulae.push({
                name: 'MCPMaxAmt',
                formula: `$$NumValue:$Amount <= ${options.maxAmount}`,
            });
        }
        return config;
    }
    /**
     * Build a stock item query
     */
    static buildStockItemQuery(options = {}) {
        const config = {
            name: 'MCPStockQuery',
            type: 'StockItem',
            nativeMethods: options.fields || [
                'Name', 'Parent', 'BaseUnits', 'ClosingBalance', 'OpeningBalance',
            ],
            filters: [],
            filterFormulae: [],
        };
        if (options.parentGroup) {
            config.childOf = options.parentGroup;
        }
        if (options.belowReorder) {
            config.filters.push('MCPBelowReorder');
            config.filterFormulae.push({
                name: 'MCPBelowReorder',
                formula: '$ClosingBalance < $ReorderLevel',
            });
        }
        if (options.hasBatches) {
            config.filters.push('MCPHasBatch');
            config.filterFormulae.push({
                name: 'MCPHasBatch',
                formula: '$IsBatchWiseOn = Yes',
            });
        }
        return config;
    }
    /**
     * Build an ageing analysis collection
     */
    static buildAgeingAnalysis(type, buckets = [30, 60, 90]) {
        const group = type === 'Debtors' ? '$$GroupSundryDebtors' : '$$GroupSundryCreditors';
        const computeFields = [
            { name: 'ClosingBal', formula: '$ClosingBalance' },
        ];
        // Build bucket compute fields
        let prev = 0;
        for (let i = 0; i < buckets.length; i++) {
            const current = buckets[i];
            const bucketName = `Bucket${prev}to${current}`;
            if (i === 0) {
                computeFields.push({
                    name: bucketName,
                    formula: `if $$DaysDiff:$BillDate:$$MachineDate <= ${current} then $ClosingBalance else 0`,
                });
            }
            else {
                computeFields.push({
                    name: bucketName,
                    formula: `if ($$DaysDiff:$BillDate:$$MachineDate > ${prev} AND $$DaysDiff:$BillDate:$$MachineDate <= ${current}) then $ClosingBalance else 0`,
                });
            }
            prev = current;
        }
        // Beyond last bucket
        computeFields.push({
            name: `BucketOver${prev}`,
            formula: `if $$DaysDiff:$BillDate:$$MachineDate > ${prev} then $ClosingBalance else 0`,
        });
        return {
            name: `MCPAgeing${type}`,
            type: 'Ledger',
            childOf: group,
            nativeMethods: ['Name', 'ClosingBalance'],
            computeFields,
            sortBy: '$ClosingBalance:Descending',
        };
    }
    /**
     * Build overdue ledgers collection
     */
    static buildOverdueQuery(type, overdueDays = 30) {
        const group = type === 'Debtors' ? '$$GroupSundryDebtors' : '$$GroupSundryCreditors';
        return {
            name: `MCPOverdue${type}`,
            type: 'Ledger',
            childOf: group,
            nativeMethods: ['Name', 'ClosingBalance', 'CreditDays'],
            filters: ['MCPIsOverdue'],
            filterFormulae: [{
                    name: 'MCPIsOverdue',
                    formula: `$$DaysDiff:$BillDate:$$MachineDate > ${overdueDays}`,
                }],
            computeFields: [
                { name: 'OverdueDays', formula: '$$DaysDiff:$BillDate:$$MachineDate' },
                { name: 'OutstandingAmt', formula: '$ClosingBalance' },
            ],
            sortBy: '$ClosingBalance:Descending',
        };
    }
    /**
     * Build a generic custom collection from raw parameters.
     * Accepts both canonical (object_type/fields) and alias (collectionType/fetchFields) forms.
     */
    static buildCustomCollection(params) {
        const objectType = params.object_type || params.collectionType || 'Ledger';
        const fields = params.fields || params.fetchFields || ['Name'];
        const config = {
            name: 'MCPCustomQuery',
            type: objectType,
            nativeMethods: fields,
            computeFields: params.compute_fields,
            sortBy: params.sort_by,
            childOf: params.child_of,
        };
        // Support single filter_expression
        if (params.filter_expression) {
            config.filters = ['MCPCustomFilter'];
            config.filterFormulae = [{
                    name: 'MCPCustomFilter',
                    formula: params.filter_expression,
                }];
        }
        // Support named filters record
        if (params.filters) {
            config.filters = config.filters || [];
            config.filterFormulae = config.filterFormulae || [];
            for (const [name, formula] of Object.entries(params.filters)) {
                config.filters.push(name);
                config.filterFormulae.push({ name, formula });
            }
        }
        return config;
    }
}
//# sourceMappingURL=tdl-builder.mjs.map