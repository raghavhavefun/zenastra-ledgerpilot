import crypto from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createVoucher, getCompanyContext, queryCollection } from './tally.mjs';
const drafts = new Map();
const auditLog = [];
const stateDir = process.env.LEDGERPILOT_STATE_DIR || path.join(process.env.HOME || '.', '.zenastra-ledgerpilot');
const stateFile = path.join(stateDir, 'state.json');
let stateLoaded = false;
async function loadState() { if (stateLoaded)
    return; stateLoaded = true; try {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    for (const d of state.drafts || [])
        drafts.set(d.id, d);
    auditLog.push(...(state.audit || []));
}
catch { } }
async function saveState() { await mkdir(stateDir, { recursive: true }); await writeFile(stateFile, JSON.stringify({ drafts: [...drafts.values()], audit: auditLog }, null, 2), 'utf8'); }
function audit(action, draft) { auditLog.push({ id: crypto.randomUUID(), action, draftId: draft?.id, company: draft?.company, at: new Date().toISOString() }); }
export async function auditEntries() { await loadState(); return auditLog; }
export async function companyProfile() {
    const context = await getCompanyContext();
    const [ledgers, groups, voucherTypes, stockItems, units, godowns] = await Promise.all([
        queryCollection('Ledger', ['Name', 'Parent', 'IsBillWise'], new Map()),
        queryCollection('Group', ['Name', 'Parent'], new Map()),
        queryCollection('VoucherType', ['Name', 'Parent', 'AffectsStock'], new Map()),
        queryCollection('StockItem', ['Name', 'Parent', 'Unit'], new Map()),
        queryCollection('Unit', ['Name', 'FormalName'], new Map()),
        queryCollection('Godown', ['Name', 'Parent'], new Map())
    ]);
    return { context, structure: { ledgers, groups, voucherTypes, stockItems, units, godowns } };
}
function validateInput(input, profile) {
    if (!input.voucherType || !input.date || !Array.isArray(input.entries) || input.entries.length < 2)
        throw new Error('Voucher needs voucherType, date, and at least two entries');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
        throw new Error('date must be YYYY-MM-DD');
    const ledgerNames = new Set(profile.structure.ledgers.map((x) => x.Name));
    const voucherNames = new Set(profile.structure.voucherTypes.map((x) => x.Name));
    if (!voucherNames.has(input.voucherType))
        throw new Error(`Voucher type '${input.voucherType}' was not found in this company`);
    const missing = input.entries.filter(x => !ledgerNames.has(x.ledger)).map(x => x.ledger);
    if (missing.length)
        throw new Error(`Ledger(s) not found in this company: ${missing.join(', ')}`);
    if (input.partyLedger && !ledgerNames.has(input.partyLedger))
        throw new Error(`Party ledger '${input.partyLedger}' was not found`);
    if (input.entries.some(x => !Number.isFinite(x.amount) || x.amount <= 0))
        throw new Error('All amounts must be positive numbers');
    const debit = input.entries.filter(x => x.isDeemedPositive).reduce((s, x) => s + x.amount, 0);
    const credit = input.entries.filter(x => !x.isDeemedPositive).reduce((s, x) => s + x.amount, 0);
    if (Math.abs(debit - credit) > 0.01)
        throw new Error(`Voucher is not balanced: debit ${debit}, credit ${credit}`);
    return { debit, credit };
}
export async function createDraft(input) {
    await loadState();
    if (input.idempotencyKey) {
        const existing = [...drafts.values()].find(d => d.idempotencyKey === input.idempotencyKey);
        if (existing)
            return { draft: existing, validation: { valid: true, reused: true }, companyProfile: { company: existing.company } };
    }
    const profile = await companyProfile();
    const company = input.company || profile.context.company;
    if (company !== profile.context.company && !profile.context.availableCompanies.includes(company))
        throw new Error(`Company '${company}' is not available`);
    const totals = validateInput(input, profile);
    const id = `draft_${crypto.randomUUID()}`;
    const draft = { ...input, id, company, status: 'draft', createdAt: new Date().toISOString() };
    drafts.set(id, draft);
    audit('draft-created', draft);
    await saveState();
    return { draft, validation: { valid: true, ...totals }, companyProfile: profile.context };
}
export async function getDraft(id) { await loadState(); const draft = drafts.get(id); if (!draft)
    throw new Error(`Draft '${id}' not found`); return draft; }
export async function approveDraft(id) { const draft = await getDraft(id); if (draft.status !== 'draft')
    throw new Error(`Draft is already ${draft.status}`); draft.status = 'approved'; draft.approvedAt = new Date().toISOString(); audit('draft-approved', draft); await saveState(); return draft; }
export async function postDraft(id) {
    const draft = await getDraft(id);
    if (draft.status !== 'approved')
        throw new Error('Draft must be approved before posting');
    const context = await getCompanyContext();
    if (context.company !== draft.company)
        throw new Error(`Tally company changed from '${draft.company}' to '${context.company}'; posting refused`);
    const result = await createVoucher(draft, draft.company);
    draft.status = 'posted';
    draft.postedAt = new Date().toISOString();
    draft.postedResult = result;
    audit('draft-posted', draft);
    await saveState();
    return { draft, result };
}
export async function discardDraft(id) { const draft = await getDraft(id); if (draft.status === 'posted')
    throw new Error('Posted drafts cannot be discarded; cancel/reverse in Tally'); drafts.delete(id); audit('draft-discarded', draft); await saveState(); return { id, discarded: true }; }
export async function previewDraft(id) { const draft = await getDraft(id); return { ...draft, instructions: 'Review company, voucher type, ledgers, amounts, date and narration before approval.' }; }
export function draftInputSchema() {
    return {
        company: undefined, voucherType: undefined, date: undefined, voucherNumber: undefined, partyLedger: undefined, narration: undefined,
        entries: undefined
    };
}
export function listDrafts() { return [...drafts.values()].map(({ id, company, voucherType, date, status, createdAt }) => ({ id, company, voucherType, date, status, createdAt })); }
export const voucherInputDescription = 'Company-aware accounting voucher. Resolve voucher type and ledgers from company-profile/list-master. The system validates company structure and debit=credit before saving a draft.';
export { validateInput };
//# sourceMappingURL=write.mjs.map