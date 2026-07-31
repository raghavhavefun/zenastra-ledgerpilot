import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoucher } from '../dist/tally.mjs';

test('createVoucher rejects empty entries before contacting Tally', async () => {
  await assert.rejects(
    createVoucher({ voucherType: 'Journal', date: '2026-08-01', entries: [] }, 'Demo Company'),
    /At least one ledger entry is required/
  );
});

test('createVoucher rejects invalid dates before contacting Tally', async () => {
  await assert.rejects(
    createVoucher({ voucherType: 'Journal', date: 'not-a-date', entries: [{ ledger: 'Cash', amount: 1, isDeemedPositive: true }] }, 'Demo Company'),
    /Voucher date must be YYYY-MM-DD/
  );
});

test('createVoucher rejects non-positive amounts before contacting Tally', async () => {
  await assert.rejects(
    createVoucher({ voucherType: 'Journal', date: '2026-08-01', entries: [{ ledger: 'Cash', amount: 0, isDeemedPositive: true }] }, 'Demo Company'),
    /Voucher entries must contain valid non-zero amounts/
  );
});

