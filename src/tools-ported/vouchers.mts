// src/tools/vouchers.ts
// MODULE 2: Vouchers — 16 tools for all transaction/voucher operations

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TallyClient } from '../tally-ported/client.mjs';
import { TallyState } from '../tally-ported/state.mjs';
import { XmlBuilder } from '../tally-ported/xml-builder.mjs';
import { XmlParser } from '../tally-ported/xml-parser.mjs';
import { TDLBuilder } from '../tally-ported/tdl-builder.mjs';
import { result, handleError } from '../tally-ported/helpers.mjs';
import { validateDate } from '../tally-ported/validators.mjs';

const ledgerEntrySchema = z.object({
  ledger_name: z.string().describe('Ledger name'),
  amount: z.number().describe('Amount — negative for Dr in Sales, positive for Cr. Follow Tally sign conventions.'),
  is_deemed_positive: z.boolean().describe('Yes=Debit side, No=Credit side'),
  bill_allocations: z.array(z.object({
    name: z.string().describe('Bill/reference number'),
    type: z.enum(['New Ref', 'Against Ref', 'Advance', 'On Account']).describe('Bill type'),
    amount: z.number().describe('Bill amount'),
  })).optional().describe('Bill-wise allocations for this entry'),
  cost_centre_allocations: z.array(z.object({
    name: z.string().describe('Cost centre name'),
    amount: z.number().describe('Allocated amount'),
  })).optional().describe('Cost centre allocations'),
});

const inventoryEntrySchema = z.object({
  stock_item_name: z.string().describe('Stock item name'),
  qty: z.number().describe('Quantity'),
  rate: z.number().describe('Rate per unit'),
  unit: z.string().describe('Unit of measure — e.g. Nos, Kg'),
  amount: z.number().describe('Total amount (qty × rate)'),
  is_deemed_positive: z.boolean().describe('Yes for purchase/receipt, No for sale/issue'),
  discount: z.number().optional().describe('Discount percentage'),
  godown: z.string().optional().describe('Godown name'),
  batch_name: z.string().optional().describe('Batch name'),
  expiry_date: z.string().optional().describe('Expiry date (YYYYMMDD)'),
});

export function registerVoucherTools(server: McpServer, client: TallyClient, state: TallyState): number {
  let count = 0;
  const getCompany = () => state.activeCompany || undefined;

  // ── 1. tally_create_sales_invoice ─────────────────────────────
  server.tool(
    'tally_create_sales_invoice',
    'Create a sales invoice. Handles party ledger, sales ledger, GST, inventory items, bill refs, cost centres. Follow Tally amount sign conventions: Party Dr (negative amount, ISDEEMEDPOSITIVE=Yes), Sales Cr (positive amount, ISDEEMEDPOSITIVE=No).',
    {
      date: z.string().describe('Invoice date (YYYYMMDD)'),
      party_ledger: z.string().describe('Customer/party ledger name (Sundry Debtors)'),
      sales_ledger: z.string().describe('Sales ledger name (Sales Accounts)'),
      items: z.array(inventoryEntrySchema).optional().describe('Inventory line items for stock invoices'),
      ledger_entries: z.array(ledgerEntrySchema).optional().describe('Additional ledger entries (GST, discount, etc.)'),
      is_inventory_invoice: z.boolean().optional().describe('Whether this is an inventory (stock) invoice'),
      voucher_number: z.string().optional().describe('Manual voucher number'),
      narration: z.string().optional().describe('Narration/description'),
      place_of_supply: z.string().optional().describe('Place of supply for GST'),
      ref_number: z.string().optional().describe('Reference number'),
      cost_centre: z.string().optional().describe('Cost centre'),
      against_bills: z.array(z.object({
        name: z.string(), type: z.string(), amount: z.number(),
      })).optional().describe('Bill references'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Sales',
          date: params.date,
          party_ledger: params.party_ledger,
          is_invoice: true,
          is_inventory_on: params.is_inventory_invoice,
          voucher_number: params.voucher_number,
          narration: params.narration,
          place_of_supply: params.place_of_supply,
          ref_number: params.ref_number,
          ledger_entries: params.ledger_entries,
          inventory_entries: params.items,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 2. tally_create_purchase_invoice ──────────────────────────
  server.tool(
    'tally_create_purchase_invoice',
    'Create a purchase invoice. Party Cr (negative amount, ISDEEMEDPOSITIVE=No), Purchase Dr (positive amount, ISDEEMEDPOSITIVE=Yes).',
    {
      date: z.string().describe('Invoice date (YYYYMMDD)'),
      party_ledger: z.string().describe('Supplier/party ledger (Sundry Creditors)'),
      purchase_ledger: z.string().describe('Purchase ledger name'),
      items: z.array(inventoryEntrySchema).optional().describe('Inventory items'),
      ledger_entries: z.array(ledgerEntrySchema).optional().describe('Additional ledger entries'),
      is_inventory_invoice: z.boolean().optional().describe('Whether this is a stock invoice'),
      voucher_number: z.string().optional().describe('Voucher number'),
      narration: z.string().optional().describe('Narration'),
      ref_number: z.string().optional().describe('Supplier invoice reference'),
      cost_centre: z.string().optional().describe('Cost centre'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Purchase',
          date: params.date,
          party_ledger: params.party_ledger,
          is_invoice: true,
          is_inventory_on: params.is_inventory_invoice,
          voucher_number: params.voucher_number,
          narration: params.narration,
          ref_number: params.ref_number,
          ledger_entries: params.ledger_entries,
          inventory_entries: params.items,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 3. tally_create_receipt ───────────────────────────────────
  server.tool(
    'tally_create_receipt',
    'Create a receipt voucher (money received). Cash/Bank Dr, Party Cr.',
    {
      date: z.string().describe('Receipt date (YYYYMMDD)'),
      bank_or_cash_ledger: z.string().describe('Bank or Cash ledger receiving money'),
      party_ledger: z.string().describe('Party paying money'),
      amount: z.number().describe('Receipt amount'),
      narration: z.string().optional().describe('Narration'),
      against_bills: z.array(z.object({
        name: z.string(), type: z.string(), amount: z.number(),
      })).optional().describe('Bill references to settle'),
      ref_number: z.string().optional().describe('Reference number'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const billAllocs = params.against_bills?.map(b => ({
          name: b.name, type: b.type, amount: b.amount,
        }));

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Receipt',
          date: params.date,
          narration: params.narration,
          ref_number: params.ref_number,
          ledger_entries: [
            { ledger_name: params.bank_or_cash_ledger, is_deemed_positive: true, amount: -params.amount },
            { ledger_name: params.party_ledger, is_deemed_positive: false, amount: params.amount, bill_allocations: billAllocs },
          ],
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 4. tally_create_payment ───────────────────────────────────
  server.tool(
    'tally_create_payment',
    'Create a payment voucher (money paid out). Party Dr, Cash/Bank Cr.',
    {
      date: z.string().describe('Payment date (YYYYMMDD)'),
      bank_or_cash_ledger: z.string().describe('Bank or Cash ledger paying money'),
      party_ledger: z.string().describe('Party receiving payment'),
      amount: z.number().describe('Payment amount'),
      narration: z.string().optional().describe('Narration'),
      cheque_number: z.string().optional().describe('Cheque/instrument number'),
      cheque_date: z.string().optional().describe('Cheque date (YYYYMMDD)'),
      against_bills: z.array(z.object({
        name: z.string(), type: z.string(), amount: z.number(),
      })).optional().describe('Bills to settle'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const billAllocs = params.against_bills?.map(b => ({
          name: b.name, type: b.type, amount: b.amount,
        }));

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Payment',
          date: params.date,
          narration: params.narration,
          cheque_number: params.cheque_number,
          cheque_date: params.cheque_date,
          ledger_entries: [
            { ledger_name: params.party_ledger, is_deemed_positive: false, amount: -params.amount, bill_allocations: billAllocs },
            { ledger_name: params.bank_or_cash_ledger, is_deemed_positive: true, amount: params.amount },
          ],
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 5. tally_create_journal ───────────────────────────────────
  server.tool(
    'tally_create_journal',
    'Create a journal voucher with multiple debit/credit entries. Entries must balance.',
    {
      date: z.string().describe('Journal date (YYYYMMDD)'),
      entries: z.array(z.object({
        ledger_name: z.string().describe('Ledger name'),
        amount: z.number().describe('Amount (positive)'),
        is_debit: z.boolean().describe('true=Debit, false=Credit'),
      })).describe('Journal entries — must balance (total Dr = total Cr)'),
      narration: z.string().optional().describe('Narration'),
      cost_centre: z.string().optional().describe('Cost centre'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const ledgerEntries = params.entries.map(e => ({
          ledger_name: e.ledger_name,
          is_deemed_positive: e.is_debit,
          amount: e.is_debit ? -Math.abs(e.amount) : Math.abs(e.amount),
        }));

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Journal',
          date: params.date,
          narration: params.narration,
          ledger_entries: ledgerEntries,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 6. tally_create_contra ────────────────────────────────────
  server.tool(
    'tally_create_contra',
    'Create a contra voucher — transfer between cash and bank accounts.',
    {
      date: z.string().describe('Contra date (YYYYMMDD)'),
      from_ledger: z.string().describe('Source ledger (Dr)'),
      to_ledger: z.string().describe('Destination ledger (Cr)'),
      amount: z.number().describe('Transfer amount'),
      narration: z.string().optional().describe('Narration'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Contra',
          date: params.date,
          narration: params.narration,
          ledger_entries: [
            { ledger_name: params.to_ledger, is_deemed_positive: true, amount: -params.amount },
            { ledger_name: params.from_ledger, is_deemed_positive: false, amount: params.amount },
          ],
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 7. tally_create_credit_note ───────────────────────────────
  server.tool(
    'tally_create_credit_note',
    'Create a credit note (sales return). Reverses a sales invoice.',
    {
      date: z.string().describe('Credit note date (YYYYMMDD)'),
      party_ledger: z.string().describe('Customer ledger'),
      sales_ledger: z.string().describe('Sales ledger'),
      items: z.array(inventoryEntrySchema).optional().describe('Returned items'),
      narration: z.string().optional().describe('Narration'),
      original_invoice_no: z.string().optional().describe('Original invoice number being reversed'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Credit Note',
          date: params.date,
          party_ledger: params.party_ledger,
          narration: params.narration,
          original_invoice_no: params.original_invoice_no,
          is_invoice: true,
          inventory_entries: params.items,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 8. tally_create_debit_note ────────────────────────────────
  server.tool(
    'tally_create_debit_note',
    'Create a debit note (purchase return). Reverses a purchase invoice.',
    {
      date: z.string().describe('Debit note date (YYYYMMDD)'),
      party_ledger: z.string().describe('Supplier ledger'),
      purchase_ledger: z.string().describe('Purchase ledger'),
      items: z.array(inventoryEntrySchema).optional().describe('Returned items'),
      narration: z.string().optional().describe('Narration'),
      original_invoice_no: z.string().optional().describe('Original purchase invoice number'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Debit Note',
          date: params.date,
          party_ledger: params.party_ledger,
          narration: params.narration,
          original_invoice_no: params.original_invoice_no,
          is_invoice: true,
          inventory_entries: params.items,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 9. tally_create_stock_journal ─────────────────────────────
  server.tool(
    'tally_create_stock_journal',
    'Create a stock journal for inter-godown transfer or stock adjustment.',
    {
      date: z.string().describe('Date (YYYYMMDD)'),
      source_godown: z.string().describe('Source godown'),
      destination_godown: z.string().describe('Destination godown'),
      items: z.array(z.object({
        stock_item_name: z.string().describe('Stock item'),
        qty: z.number().describe('Quantity'),
        rate: z.number().describe('Rate per unit'),
        unit: z.string().describe('Unit'),
      })).describe('Items to transfer'),
      narration: z.string().optional().describe('Narration'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const sourceEntries = params.items.map(item => ({
          stock_item_name: item.stock_item_name,
          is_deemed_positive: false,
          rate: item.rate,
          unit: item.unit,
          qty: item.qty,
          amount: item.qty * item.rate,
          godown: params.source_godown,
        }));

        const destEntries = params.items.map(item => ({
          stock_item_name: item.stock_item_name,
          is_deemed_positive: true,
          rate: item.rate,
          unit: item.unit,
          qty: item.qty,
          amount: item.qty * item.rate,
          godown: params.destination_godown,
        }));

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Stock Journal',
          date: params.date,
          narration: params.narration,
          inventory_entries: [...sourceEntries, ...destEntries],
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 10. tally_create_physical_stock ───────────────────────────
  server.tool(
    'tally_create_physical_stock',
    'Create a physical stock voucher for stock verification/adjustment.',
    {
      date: z.string().describe('Date (YYYYMMDD)'),
      items: z.array(z.object({
        stock_item_name: z.string().describe('Stock item'),
        qty: z.number().describe('Physical count quantity'),
        rate: z.number().describe('Rate'),
        unit: z.string().describe('Unit'),
        godown: z.string().optional().describe('Godown'),
      })).describe('Physical stock entries'),
      narration: z.string().optional().describe('Narration'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const invEntries = params.items.map(item => ({
          stock_item_name: item.stock_item_name,
          is_deemed_positive: true,
          rate: item.rate,
          unit: item.unit,
          qty: item.qty,
          amount: item.qty * item.rate,
          godown: item.godown,
        }));

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Physical Stock',
          date: params.date,
          narration: params.narration,
          inventory_entries: invEntries,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 11. tally_create_reversing_journal ────────────────────────
  server.tool(
    'tally_create_reversing_journal',
    'Create a reversing journal that auto-reverses on a specified date.',
    {
      date: z.string().describe('Journal date (YYYYMMDD)'),
      entries: z.array(z.object({
        ledger_name: z.string(), amount: z.number(), is_debit: z.boolean(),
      })).describe('Journal entries'),
      reversal_date: z.string().describe('Auto-reversal date (YYYYMMDD)'),
      narration: z.string().optional().describe('Narration'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const ledgerEntries = params.entries.map(e => ({
          ledger_name: e.ledger_name,
          is_deemed_positive: e.is_debit,
          amount: e.is_debit ? -Math.abs(e.amount) : Math.abs(e.amount),
        }));

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Reversing Journal',
          date: params.date,
          narration: params.narration,
          reversal_date: params.reversal_date,
          ledger_entries: ledgerEntries,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 12. tally_create_memorandum_voucher ───────────────────────
  server.tool(
    'tally_create_memorandum_voucher',
    'Create a memorandum/optional voucher that does not affect books.',
    {
      date: z.string().describe('Date (YYYYMMDD)'),
      voucher_type: z.string().describe('Base voucher type — e.g. Sales, Purchase, Journal'),
      entries: z.array(z.object({
        ledger_name: z.string(), amount: z.number(), is_debit: z.boolean(),
      })).describe('Entries'),
      narration: z.string().optional().describe('Narration'),
    },
    async (params) => {
      try {
        const dateCheck = validateDate(params.date);
        if (!dateCheck.valid) return result({ status: 'validation_error', message: dateCheck.error });

        const ledgerEntries = params.entries.map(e => ({
          ledger_name: e.ledger_name,
          is_deemed_positive: e.is_debit,
          amount: e.is_debit ? -Math.abs(e.amount) : Math.abs(e.amount),
        }));

        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: 'Memorandum',
          date: params.date,
          narration: params.narration,
          ledger_entries: ledgerEntries,
        });

        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 13. tally_alter_voucher ───────────────────────────────────
  server.tool(
    'tally_alter_voucher',
    'Modify an existing voucher — update narration and other details.',
    {
      voucher_number: z.string().describe('Voucher number to alter'),
      voucher_type: z.string().describe('Voucher type'),
      date: z.string().describe('Voucher date (YYYYMMDD)'),
      narration: z.string().optional().describe('Updated narration'),
    },
    async (params) => {
      try {
        const voucherXml = XmlBuilder.buildVoucherXml({
          voucher_type: params.voucher_type,
          date: params.date,
          voucher_number: params.voucher_number,
          action: 'Alter',
          narration: params.narration,
        });
        const response = await client.importVouchers(voucherXml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 14. tally_cancel_voucher ──────────────────────────────────
  server.tool(
    'tally_cancel_voucher',
    'Cancel a voucher (marks it cancelled but keeps it in the system).',
    {
      voucher_number: z.string().describe('Voucher number'),
      voucher_type: z.string().describe('Voucher type'),
      date: z.string().describe('Voucher date (YYYYMMDD)'),
    },
    async (params) => {
      try {
        const xml = `<VOUCHER VCHTYPE="${XmlBuilder.esc(params.voucher_type)}" Action="Cancel">
    <DATE>${params.date}</DATE>
    <VOUCHERNUMBER>${XmlBuilder.esc(params.voucher_number)}</VOUCHERNUMBER>
    <VOUCHERTYPENAME>${XmlBuilder.esc(params.voucher_type)}</VOUCHERTYPENAME>
  </VOUCHER>`;
        const response = await client.importVouchers(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 15. tally_delete_voucher ──────────────────────────────────
  server.tool(
    'tally_delete_voucher',
    'Permanently delete a voucher from TallyPrime.',
    {
      voucher_number: z.string().describe('Voucher number'),
      voucher_type: z.string().describe('Voucher type'),
      date: z.string().describe('Voucher date (YYYYMMDD)'),
    },
    async (params) => {
      try {
        const xml = `<VOUCHER VCHTYPE="${XmlBuilder.esc(params.voucher_type)}" Action="Delete">
    <DATE>${params.date}</DATE>
    <VOUCHERNUMBER>${XmlBuilder.esc(params.voucher_number)}</VOUCHERNUMBER>
    <VOUCHERTYPENAME>${XmlBuilder.esc(params.voucher_type)}</VOUCHERTYPENAME>
  </VOUCHER>`;
        const response = await client.importVouchers(xml, getCompany());
        return result({ status: 'success', ...XmlParser.extractImportResult(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  // ── 16. tally_list_vouchers ───────────────────────────────────
  server.tool(
    'tally_list_vouchers',
    'List vouchers filtered by date range, type, and/or party ledger.',
    {
      from_date: z.string().describe('Start date (YYYYMMDD)'),
      to_date: z.string().describe('End date (YYYYMMDD)'),
      voucher_type: z.string().optional().describe('Filter by voucher type — Sales, Purchase, Receipt, Payment, etc.'),
      party_ledger: z.string().optional().describe('Filter by party ledger'),
    },
    async (params) => {
      try {
        const config = TDLBuilder.buildVoucherQuery({
          voucherType: params.voucher_type,
          partyLedger: params.party_ledger,
        });
        const response = await client.queryCollection(config, {
          SVFROMDATE: params.from_date,
          SVTODATE: params.to_date,
          ...(state.activeCompany ? { SVCURRENTCOMPANY: state.activeCompany } : {}),
        });
        return result({ status: 'success', data: XmlParser.extractCollectionData(response.data) });
      } catch (err) { return handleError(err); }
    }
  );
  count++;

  return count;
}
