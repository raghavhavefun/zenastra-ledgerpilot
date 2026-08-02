// src/utils/validators.ts
// Input validation for TallyPrime MCP Server
export function validateDate(date) {
    if (!date)
        return { valid: false, error: 'Date is required' };
    if (!/^\d{8}$/.test(date)) {
        return { valid: false, error: `Date must be in YYYYMMDD format, got: ${date}` };
    }
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(4, 6));
    const day = parseInt(date.substring(6, 8));
    if (month < 1 || month > 12)
        return { valid: false, error: `Invalid month: ${month}` };
    if (day < 1 || day > 31)
        return { valid: false, error: `Invalid day: ${day}` };
    if (year < 1900 || year > 2100)
        return { valid: false, error: `Invalid year: ${year}` };
    // Check actual calendar validity
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
        return { valid: false, error: `Invalid calendar date: ${date}` };
    }
    return { valid: true };
}
export function validateLedgersExist(names, state) {
    return names.filter(name => !state.ledgerExists(name));
}
export function validateStockItemsExist(names, state) {
    return names.filter(name => !state.stockItemExists(name));
}
export function validateJournalBalance(entries) {
    let dr = 0;
    let cr = 0;
    for (const entry of entries) {
        if (entry.is_debit) {
            dr += Math.abs(entry.amount);
        }
        else {
            cr += Math.abs(entry.amount);
        }
    }
    dr = Math.round(dr * 100) / 100;
    cr = Math.round(cr * 100) / 100;
    return { balanced: dr === cr, dr, cr };
}
export function validateGSTIN(gstin) {
    if (!gstin)
        return { valid: false, error: 'GSTIN is required' };
    if (gstin.length !== 15) {
        return { valid: false, error: `GSTIN must be 15 characters, got ${gstin.length}` };
    }
    const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    if (!gstinPattern.test(gstin)) {
        return { valid: false, error: `GSTIN format invalid: ${gstin}` };
    }
    return { valid: true };
}
export function validatePAN(pan) {
    if (!pan)
        return { valid: false, error: 'PAN is required' };
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        return { valid: false, error: `PAN format invalid: ${pan}. Must be 10 characters matching AAAAA9999A.` };
    }
    return { valid: true };
}
export function sanitizeAmount(amount) {
    if (typeof amount === 'number') {
        if (isNaN(amount))
            throw new Error('Amount is NaN');
        return amount;
    }
    if (typeof amount === 'string') {
        const cleaned = amount.replace(/,/g, '').trim();
        const parsed = parseFloat(cleaned);
        if (isNaN(parsed))
            throw new Error(`Cannot parse amount: ${amount}`);
        return parsed;
    }
    throw new Error(`Invalid amount type: ${typeof amount}`);
}
//# sourceMappingURL=validators.mjs.map