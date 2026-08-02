// src/tally/state.ts
// Master cache for TallyPrime entities — auto-refresh with TTL
import { TDLBuilder } from './tdl-builder.mjs';
import { XmlParser } from './xml-parser.mjs';
import logger from './logger.mjs';
export class TallyState {
    ledgerNames = new Set();
    stockItemNames = new Set();
    voucherTypes = new Set();
    groupNames = new Set();
    godownNames = new Set();
    costCentreNames = new Set();
    unitNames = new Set();
    employeeNames = new Set();
    batchNames = new Map();
    activeCompany = null;
    lastRefreshed = null;
    client;
    cacheTtlMs;
    company;
    constructor(client, cacheTtlMs = 300000, company) {
        this.client = client;
        this.cacheTtlMs = cacheTtlMs;
        this.company = company;
    }
    getStaticVars() {
        const vars = {};
        // Prefer configured company, fall back to auto-detected active company
        const company = this.company || this.activeCompany;
        if (company) {
            vars['SVCURRENTCOMPANY'] = company;
        }
        return vars;
    }
    async refresh() {
        logger.info('Refreshing all master caches...');
        try {
            // Step 1: Get active company first — all subsequent queries need SVCURRENTCOMPANY
            await this.refreshActiveCompany();
            // Step 2: Refresh caches sequentially to avoid overloading Tally's
            // single-threaded XML server. Even though client.ts has a queue,
            // sequential here avoids building up a long backlog at startup.
            await this.refreshLedgers();
            await this.refreshStockItems();
            await this.refreshGroups();
            await this.refreshVoucherTypes();
            await this.refreshGodowns();
            await this.refreshCostCentres();
            await this.refreshUnits();
            await this.refreshEmployees();
            this.lastRefreshed = new Date();
            logger.info('Master cache refreshed', {
                ledgers: this.ledgerNames.size,
                stockItems: this.stockItemNames.size,
                groups: this.groupNames.size,
                voucherTypes: this.voucherTypes.size,
                godowns: this.godownNames.size,
                costCentres: this.costCentreNames.size,
                units: this.unitNames.size,
                employees: this.employeeNames.size,
            });
        }
        catch (err) {
            logger.error('Failed to refresh master cache', { error: String(err) });
        }
    }
    async refreshLedgers() {
        try {
            const config = TDLBuilder.buildLedgerListQuery();
            config.name = 'MCPCacheLedgers';
            config.nativeMethods = ['Name'];
            const result = await this.client.queryCollection(config, this.getStaticVars());
            if (result.success) {
                const names = XmlParser.extractNameList(result.data, 'LEDGER');
                this.ledgerNames = new Set(names);
            }
        }
        catch (err) {
            logger.warn('Failed to refresh ledger cache', { error: String(err) });
        }
    }
    async refreshStockItems() {
        try {
            const config = TDLBuilder.buildStockItemQuery();
            config.name = 'MCPCacheStockItems';
            config.nativeMethods = ['Name'];
            const result = await this.client.queryCollection(config, this.getStaticVars());
            if (result.success) {
                const names = XmlParser.extractNameList(result.data, 'STOCKITEM');
                this.stockItemNames = new Set(names);
            }
        }
        catch (err) {
            logger.warn('Failed to refresh stock item cache', { error: String(err) });
        }
    }
    async refreshGroups() {
        try {
            const config = {
                name: 'MCPCacheGroups',
                type: 'Group',
                nativeMethods: ['Name'],
            };
            const result = await this.client.queryCollection(config, this.getStaticVars());
            if (result.success) {
                const names = XmlParser.extractNameList(result.data, 'GROUP');
                this.groupNames = new Set(names);
            }
        }
        catch (err) {
            logger.warn('Failed to refresh group cache', { error: String(err) });
        }
    }
    async refreshVoucherTypes() {
        try {
            const config = {
                name: 'MCPCacheVoucherTypes',
                type: 'VoucherType',
                nativeMethods: ['Name'],
            };
            const result = await this.client.queryCollection(config, this.getStaticVars());
            if (result.success) {
                const names = XmlParser.extractNameList(result.data, 'VOUCHERTYPE');
                this.voucherTypes = new Set(names);
            }
        }
        catch (err) {
            logger.warn('Failed to refresh voucher type cache', { error: String(err) });
        }
    }
    async refreshGodowns() {
        try {
            const config = {
                name: 'MCPCacheGodowns',
                type: 'Godown',
                nativeMethods: ['Name'],
            };
            const result = await this.client.queryCollection(config, this.getStaticVars());
            if (result.success) {
                const names = XmlParser.extractNameList(result.data, 'GODOWN');
                this.godownNames = new Set(names);
            }
        }
        catch (err) {
            logger.warn('Failed to refresh godown cache', { error: String(err) });
        }
    }
    async refreshCostCentres() {
        try {
            const config = {
                name: 'MCPCacheCostCentres',
                type: 'CostCentre',
                nativeMethods: ['Name'],
            };
            const result = await this.client.queryCollection(config, this.getStaticVars());
            if (result.success) {
                const names = XmlParser.extractNameList(result.data, 'COSTCENTRE');
                this.costCentreNames = new Set(names);
            }
        }
        catch (err) {
            logger.warn('Failed to refresh cost centre cache', { error: String(err) });
        }
    }
    async refreshUnits() {
        try {
            const config = {
                name: 'MCPCacheUnits',
                type: 'Unit',
                nativeMethods: ['Name'],
            };
            const result = await this.client.queryCollection(config, this.getStaticVars());
            if (result.success) {
                const names = XmlParser.extractNameList(result.data, 'UNIT');
                this.unitNames = new Set(names);
            }
        }
        catch (err) {
            logger.warn('Failed to refresh unit cache', { error: String(err) });
        }
    }
    async refreshEmployees() {
        try {
            // Only request Name — payroll fields (AadharNumber, UniversalAccountNumber,
            // ESINumber) cause TDL errors when Payroll module is not enabled in TallyPrime.
            const config = {
                name: 'MCPCacheEmployees',
                type: 'Employee',
                nativeMethods: ['Name'],
            };
            const result = await this.client.queryCollection(config, this.getStaticVars());
            if (result.success) {
                const names = XmlParser.extractNameList(result.data, 'EMPLOYEE');
                this.employeeNames = new Set(names);
            }
        }
        catch (err) {
            logger.warn('Failed to refresh employee cache', { error: String(err) });
        }
    }
    async refreshActiveCompany() {
        try {
            const companies = await this.client.getCompanyList();
            if (companies.length > 0) {
                this.activeCompany = this.company || companies[0];
            }
        }
        catch (err) {
            logger.warn('Failed to get active company', { error: String(err) });
        }
    }
    async refreshAfterMasterChange(entityType) {
        switch (entityType.toLowerCase()) {
            case 'ledger':
                await this.refreshLedgers();
                break;
            case 'stockitem':
            case 'stock_item':
                await this.refreshStockItems();
                break;
            case 'group':
                await this.refreshGroups();
                break;
            case 'vouchertype':
            case 'voucher_type':
                await this.refreshVoucherTypes();
                break;
            case 'godown':
                await this.refreshGodowns();
                break;
            case 'costcentre':
            case 'cost_centre':
                await this.refreshCostCentres();
                break;
            case 'unit':
                await this.refreshUnits();
                break;
            case 'employee':
                await this.refreshEmployees();
                break;
            default: break;
        }
    }
    ledgerExists(name) {
        return this.ledgerNames.has(name);
    }
    stockItemExists(name) {
        return this.stockItemNames.has(name);
    }
    godownExists(name) {
        return this.godownNames.has(name);
    }
    employeeExists(name) {
        return this.employeeNames.has(name);
    }
    async ensureFresh() {
        if (!this.lastRefreshed) {
            await this.refresh();
            return;
        }
        const elapsed = Date.now() - this.lastRefreshed.getTime();
        if (elapsed > this.cacheTtlMs) {
            await this.refresh();
        }
    }
    getCacheStats() {
        return {
            ledgers: this.ledgerNames.size,
            stockItems: this.stockItemNames.size,
            groups: this.groupNames.size,
            voucherTypes: this.voucherTypes.size,
            godowns: this.godownNames.size,
            costCentres: this.costCentreNames.size,
            units: this.unitNames.size,
            employees: this.employeeNames.size,
        };
    }
}
//# sourceMappingURL=state.mjs.map