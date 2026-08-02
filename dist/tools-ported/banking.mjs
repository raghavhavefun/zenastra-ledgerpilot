// src/tools/banking.ts
// MODULE 11: Banking — 10 tools for bank reconciliation and cheque management
import { z } from 'zod';
import { XmlBuilder } from '../tally-ported/xml-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
const dateRangeSchema = {
    from_date: z.string().describe('Start date (YYYYMMDD)'),
    to_date: z.string().describe('End date (YYYYMMDD)'),
};
export function registerBankingTools(server, client, state) {
    let count = 0;
    const getCompany = () => state.activeCompany || undefined;
    const sv = (from, to) => ({
        SVFROMDATE: from, SVTODATE: to,
        ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
    });
    // ── 1. tally_get_bank_reconciliation ──────────────────────────
    server.tool('tally_get_bank_reconciliation', 'Get bank reconciliation statement for a bank account.', {
        bank_ledger: z.string().describe('Bank account ledger name'),
        ...dateRangeSchema,
    }, async (params) => {
        try {
            const response = await client.exportReport('Bank Reconciliation', {
                ...sv(params.from_date, params.to_date),
                DSPLEDGER: params.bank_ledger,
            });
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 2. tally_reconcile_bank_transaction ───────────────────────
    server.tool('tally_reconcile_bank_transaction', 'Mark a bank transaction as reconciled with bank date.', {
        voucher_number: z.string().describe('Voucher number to reconcile'),
        bank_date: z.string().describe('Bank clearing/value date (YYYYMMDD)'),
        voucher_date: z.string().describe('Voucher date for lookup (YYYYMMDD)'),
        voucher_type: z.string().optional().describe('Voucher type — Payment, Receipt, Contra, etc. (default: Payment)'),
    }, async (params) => {
        try {
            const voucherXml = XmlBuilder.buildVoucherXml({
                voucher_type: params.voucher_type || 'Payment',
                voucher_number: params.voucher_number,
                date: params.voucher_date,
                action: 'alter',
                bank_date: params.bank_date,
            });
            const response = await client.importVouchers(voucherXml, getCompany());
            return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 3. tally_get_unreconciled_transactions ────────────────────
    server.tool('tally_get_unreconciled_transactions', 'Get all unreconciled bank transactions for a bank account.', {
        bank_ledger: z.string().describe('Bank account ledger name'),
        ...dateRangeSchema,
    }, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'Voucher',
                fetchFields: ['Date', 'VoucherNumber', 'VoucherTypeName', 'Amount', 'Narration', 'PartyledgerName', 'BankDate'],
                filters: {
                    BankFilter: `$LedgerName = "${params.bank_ledger}"`,
                    UnreconciledFilter: '$$IsEmpty:$BankDate = Yes',
                },
            });
            const response = await client.queryCollection(config, sv(params.from_date, params.to_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 4. tally_get_cheque_register ──────────────────────────────
    server.tool('tally_get_cheque_register', 'Get cheque register — all cheques issued and received.', {
        bank_ledger: z.string().optional().describe('Bank account (omit for all)'),
        ...dateRangeSchema,
    }, async (params) => {
        try {
            const response = await client.exportReport('Cheque Register', {
                ...sv(params.from_date, params.to_date),
                ...(params.bank_ledger ? { DSPLEDGER: params.bank_ledger } : {}),
            });
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 5. tally_get_post_dated_cheques ───────────────────────────
    server.tool('tally_get_post_dated_cheques', 'Get list of post-dated cheques (PDC) pending clearing.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('Post-Dated Summary', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 6. tally_get_deposit_slips ────────────────────────────────
    server.tool('tally_get_deposit_slips', 'Get deposit slip summary for bank deposits.', {
        bank_ledger: z.string().describe('Bank account ledger'),
        ...dateRangeSchema,
    }, async (params) => {
        try {
            const response = await client.exportReport('Deposit Slips', {
                ...sv(params.from_date, params.to_date),
                DSPLEDGER: params.bank_ledger,
            });
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 7. tally_get_bank_balance ─────────────────────────────────
    server.tool('tally_get_bank_balance', 'Get current balance of a bank account (book balance).', {
        bank_ledger: z.string().describe('Bank account ledger name'),
        as_of_date: z.string().describe('Date (YYYYMMDD)'),
    }, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'Ledger',
                fetchFields: ['Name', 'ClosingBalance', 'OpeningBalance', 'Parent'],
                filters: { NameFilter: `$Name = "${params.bank_ledger}"` },
            });
            const response = await client.queryCollection(config, sv('20000101', params.as_of_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 8. tally_list_bank_accounts ───────────────────────────────
    server.tool('tally_list_bank_accounts', 'List all bank account ledgers with balances.', {
        as_of_date: z.string().optional().describe('Balance as of date (YYYYMMDD)'),
    }, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'Ledger',
                fetchFields: ['Name', 'ClosingBalance', 'Parent', 'BankAccountNumber', 'IFSCCode'],
                filters: { BankFilter: '$Parent = "Bank Accounts" OR $Parent = "Bank OD A/c"' },
            });
            const response = await client.queryCollection(config, {
                ...(params.as_of_date ? { SVTODATE: params.as_of_date } : {}),
                ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
            });
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 9. tally_get_payment_performance ──────────────────────────
    server.tool('tally_get_payment_performance', 'Get payment performance analysis — on-time vs delayed payments.', dateRangeSchema, async (params) => {
        try {
            const response = await client.exportReport('Payment Performance', sv(params.from_date, params.to_date));
            return result({ status: 'success', data: response.data });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    // ── 10. tally_get_cash_position ───────────────────────────────
    server.tool('tally_get_cash_position', 'Get current cash position — cash in hand + all bank balances.', {
        as_of_date: z.string().describe('Position as of date (YYYYMMDD)'),
    }, async (params) => {
        try {
            const config = TDLBuilder.buildCustomCollection({
                collectionType: 'Ledger',
                fetchFields: ['Name', 'ClosingBalance', 'Parent'],
                filters: { CashBankFilter: '$Parent = "Cash-in-Hand" OR $Parent = "Bank Accounts" OR $Parent = "Bank OD A/c"' },
            });
            const response = await client.queryCollection(config, sv('20000101', params.as_of_date));
            return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
        }
        catch (err) {
            return handleError(err);
        }
    });
    count++;
    return count;
}
//# sourceMappingURL=banking.mjs.map