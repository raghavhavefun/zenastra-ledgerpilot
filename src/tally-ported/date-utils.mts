// src/utils/date-utils.ts
// Date helper utilities for TallyPrime MCP Server

/**
 * Convert a Date object or ISO string to Tally YYYYMMDD format
 */
export function toTallyDate(date: Date | string): string {
  if (typeof date === 'string') {
    // If already in YYYYMMDD format
    if (/^\d{8}$/.test(date)) return date;
    // Try parsing ISO or other formats
    date = new Date(date);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Convert Tally YYYYMMDD to a readable format
 */
export function fromTallyDate(tallyDate: string): string {
  if (!tallyDate || tallyDate.length !== 8) return tallyDate;
  return `${tallyDate.substring(0, 4)}-${tallyDate.substring(4, 6)}-${tallyDate.substring(6, 8)}`;
}

/**
 * Get current date in Tally format
 */
export function todayTally(): string {
  return toTallyDate(new Date());
}

/**
 * Get current financial year dates (April to March for India)
 */
export function getCurrentFinancialYear(): { from: string; to: string } {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    from: `${year}0401`,
    to: `${year + 1}0331`,
  };
}

/**
 * Get month range in Tally format
 */
export function getMonthRange(month: number, year: number): { from: string; to: string } {
  const m = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}${m}01`,
    to: `${year}${m}${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Get quarter range
 */
export function getQuarterRange(quarter: number, financialYear: number): { from: string; to: string } {
  switch (quarter) {
    case 1: return { from: `${financialYear}0401`, to: `${financialYear}0630` };
    case 2: return { from: `${financialYear}0701`, to: `${financialYear}0930` };
    case 3: return { from: `${financialYear}1001`, to: `${financialYear}1231` };
    case 4: return { from: `${financialYear + 1}0101`, to: `${financialYear + 1}0331` };
    default: throw new Error(`Invalid quarter: ${quarter}`);
  }
}
