// src/tally/xml-parser.ts
// XML parser + error detection for TallyPrime responses
import { XMLParser } from 'fast-xml-parser';
/**
 * Tags that Tally always returns as collections (should always be arrays).
 * Combined with auto-detection of any tag ending with ".LIST".
 */
const FORCE_ARRAY_TAGS = new Set([
    'LEDGER', 'STOCKITEM', 'GROUP', 'VOUCHER', 'EMPLOYEE',
    'GODOWN', 'COSTCENTRE', 'COSTCATEGORY', 'UNIT', 'VOUCHERTYPE',
    'CURRENCY', 'BUDGET', 'STOCKGROUP', 'STOCKCATEGORY', 'PRICELEVEL',
    'PAYHEAD', 'EMPLOYEEGROUP', 'COMPANY',
    'COLLECTION', 'OBJECT', 'ROW',
]);
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    // Keep values as strings — prevents Tally dates like "20240101" being
    // parsed as numbers, and avoids precision loss on large amounts.
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name) => {
        // Auto-detect any .LIST suffix (Tally convention for sub-collections)
        if (name.endsWith('.LIST'))
            return true;
        return FORCE_ARRAY_TAGS.has(name);
    },
});
export class XmlParser {
    /**
     * Parse a Tally XML response and detect errors
     */
    static parse(xmlString) {
        if (!xmlString || xmlString.trim().length === 0) {
            return {
                success: false,
                data: null,
                errors: ['Empty response from TallyPrime'],
                rawXml: xmlString,
            };
        }
        try {
            const parsed = parser.parse(xmlString);
            const errors = this.detectErrors(parsed, xmlString);
            return {
                success: errors.length === 0,
                data: parsed,
                errors,
                rawXml: xmlString,
            };
        }
        catch (err) {
            return {
                success: false,
                data: null,
                errors: [`XML parse error: ${String(err)}`],
                rawXml: xmlString,
            };
        }
    }
    /**
     * Detect all error indicators in a Tally XML response.
     * Per official Tally docs, errors can appear as:
     * - <EXCEPTION> wrapper (critical server errors)
     * - <LINEERROR> tags (TDL parse/processing errors)
     * - <STATUS>0</STATUS> in HEADER (request failure)
     * - <RESPONSE><ERRORS>N</ERRORS></RESPONSE> for imports
     * - <IMPORTRESULT> with zero created/altered/deleted
     * - <ERROR> tags (generic errors)
     */
    static detectErrors(parsed, rawXml) {
        const errors = [];
        // Check for EXCEPTION wrapper (Tally sends these for critical errors)
        if (rawXml.trimStart().startsWith('<EXCEPTION>')) {
            const match = rawXml.match(/<EXCEPTION>([\s\S]*?)<\/EXCEPTION>/i);
            if (match) {
                const msg = match[1].replace(/<[^>]+>/g, ' ').trim();
                if (msg)
                    errors.push(`EXCEPTION: ${msg}`);
            }
            else {
                errors.push('EXCEPTION: Unknown Tally exception');
            }
        }
        // Check for LINEERROR in raw XML
        const lineErrorMatch = rawXml.match(/<LINEERROR>(.*?)<\/LINEERROR>/gi);
        if (lineErrorMatch) {
            for (const match of lineErrorMatch) {
                const msg = match.replace(/<\/?LINEERROR>/gi, '').trim();
                if (msg)
                    errors.push(`LINEERROR: ${msg}`);
            }
        }
        // Check for STATUS=0 in header (official failure indicator)
        const header = parsed?.ENVELOPE?.HEADER;
        if (header && String(header.STATUS) === '0') {
            const bodyData = parsed?.ENVELOPE?.BODY?.DATA;
            const desc = typeof bodyData === 'string' ? bodyData : '';
            if (desc) {
                errors.push(`Tally returned STATUS 0: ${desc}`);
            }
            else if (errors.length === 0) {
                errors.push('Tally returned failure STATUS 0');
            }
        }
        // Check for <RESPONSE> tag (official import response format per docs)
        const response = parsed?.RESPONSE || parsed?.ENVELOPE?.BODY?.DATA?.RESPONSE;
        if (response && Number(response.ERRORS || 0) > 0) {
            errors.push(`Import had ${response.ERRORS} error(s)`);
        }
        // Check for error in IMPORTRESULT (legacy / alternate format)
        const importResult = parsed?.ENVELOPE?.BODY?.DATA?.IMPORTRESULT || parsed?.IMPORTRESULT;
        if (importResult) {
            const created = Number(importResult.CREATED || 0);
            const altered = Number(importResult.ALTERED || 0);
            const deleted = Number(importResult.DELETED || 0);
            if (created === 0 && altered === 0 && deleted === 0) {
                if (importResult.LASTVCHACTION && String(importResult.LASTVCHACTION) !== '') {
                    errors.push(`Import failed: ${importResult.LASTVCHACTION}`);
                }
            }
        }
        // Check for generic <ERROR> tags
        if (rawXml.includes('<ERROR>')) {
            const errorMatch = rawXml.match(/<ERROR>(.*?)<\/ERROR>/gi);
            if (errorMatch) {
                for (const match of errorMatch) {
                    const msg = match.replace(/<\/?ERROR>/gi, '').trim();
                    if (msg)
                        errors.push(`ERROR: ${msg}`);
                }
            }
        }
        return errors;
    }
    /**
     * Extract the import result (created/altered counts).
     * Handles both IMPORTRESULT and RESPONSE formats per official docs.
     */
    static extractImportResult(parsed) {
        const result = parsed?.ENVELOPE?.BODY?.DATA?.IMPORTRESULT
            || parsed?.IMPORTRESULT;
        const response = parsed?.RESPONSE
            || parsed?.ENVELOPE?.BODY?.DATA?.RESPONSE;
        const source = result || response;
        if (!source) {
            return { created: 0, altered: 0, deleted: 0, errors: 0 };
        }
        return {
            created: Number(source.CREATED || 0),
            altered: Number(source.ALTERED || 0),
            deleted: Number(source.DELETED || 0),
            errors: Number(source.ERRORS || 0),
            lastvchid: source.LASTVCHID ? String(source.LASTVCHID) : undefined,
            lastaction: String(source.LASTVCHACTION || source.LASTACTION || ''),
        };
    }
    /**
     * Extract collection data from parsed envelope
     */
    static extractCollectionData(parsed) {
        const envelope = parsed?.ENVELOPE || parsed;
        const body = envelope?.BODY;
        const data = body?.DATA;
        if (!data)
            return [];
        const collection = data?.COLLECTION || data;
        if (Array.isArray(collection))
            return collection;
        if (typeof collection === 'object' && collection !== null) {
            for (const key of Object.keys(collection)) {
                if (Array.isArray(collection[key])) {
                    return collection[key];
                }
            }
            return [collection];
        }
        return [];
    }
    /**
     * Extract object data from parsed envelope
     */
    static extractObjectData(parsed) {
        const envelope = parsed?.ENVELOPE || parsed;
        return envelope?.BODY?.DATA || envelope?.DATA || parsed;
    }
    /**
     * Extract list of names from a simple collection export
     */
    static extractNameList(parsed, entityTag) {
        const data = this.extractCollectionData(parsed);
        if (Array.isArray(data)) {
            return data
                .map((item) => {
                const raw = item?.NAME || item?.['@_NAME'] || item?.['#text'] || '';
                return TallyValueParser.cleanString(String(raw));
            })
                .filter((n) => n.length > 0);
        }
        return [];
    }
}
// ── Value Parsing Helpers ──────────────────────────────────────
// Tally returns all values as strings in specific formats.
// These helpers convert them to usable JS types.
export class TallyValueParser {
    /**
     * Clean a Tally string value — unescape HTML entities and trim.
     */
    static cleanString(val) {
        if (!val)
            return '';
        return val
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#13;/g, '\r')
            .replace(/&#10;/g, '\n')
            .trim();
    }
    /**
     * Parse a Tally amount string to a number.
     * Tally formats: "12345.67", "-12345.67", "(12345.67)" for negative,
     * sometimes with commas: "1,23,456.78" (Indian numbering).
     */
    static parseAmount(val) {
        if (val === undefined || val === null || val === '')
            return 0;
        if (typeof val === 'number')
            return val;
        let s = String(val).trim();
        // Handle parenthetical negatives: (1234.56) → -1234.56
        const isNegParen = s.startsWith('(') && s.endsWith(')');
        if (isNegParen)
            s = '-' + s.slice(1, -1);
        // Strip commas (Indian or Western grouping)
        s = s.replace(/,/g, '');
        // Strip currency symbols and spaces
        s = s.replace(/[₹$€£¥\s]/g, '');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }
    /**
     * Parse a Tally date string.
     * Tally primary format: "YYYYMMDD" (e.g., "20240315")
     * Alt formats: "d-MMM-yyyy" (e.g., "15-Mar-2024"), "d-MMM-yy"
     */
    static parseDate(val) {
        if (!val)
            return null;
        const s = String(val).trim();
        // Primary format: YYYYMMDD
        if (/^\d{8}$/.test(s)) {
            return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        }
        // Already ISO format
        if (/^\d{4}-\d{2}-\d{2}$/.test(s))
            return s;
        // d-MMM-yyyy or d-MMM-yy
        const months = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        };
        const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
        if (m) {
            const day = m[1].padStart(2, '0');
            const mon = months[m[2].toLowerCase()];
            let year = m[3];
            if (year.length === 2)
                year = (parseInt(year) > 50 ? '19' : '20') + year;
            if (mon)
                return `${year}-${mon}-${day}`;
        }
        return s; // Return as-is if unrecognized
    }
    /**
     * Parse a Tally quantity string.
     * Tally format: "123.45 pcs", "10 Nos", "5.5 Kgs", etc.
     */
    static parseQuantity(val) {
        if (val === undefined || val === null || val === '')
            return { qty: 0, unit: '' };
        if (typeof val === 'number')
            return { qty: val, unit: '' };
        const s = String(val).trim();
        const m = s.match(/^(-?[\d,]+\.?\d*)\s*(.*)$/);
        if (m) {
            return {
                qty: parseFloat(m[1].replace(/,/g, '')) || 0,
                unit: m[2].trim(),
            };
        }
        return { qty: 0, unit: s };
    }
    /**
     * Parse a Tally boolean value.
     * Tally uses: "Yes"/"No", "1"/"0", "True"/"False"
     */
    static parseBool(val) {
        if (typeof val === 'boolean')
            return val;
        if (!val)
            return false;
        const s = String(val).trim().toLowerCase();
        return s === 'yes' || s === '1' || s === 'true';
    }
    /**
     * Parse a Tally rate string.
     * Tally format: "100/pcs", "50.5/Nos"
     */
    static parseRate(val) {
        if (val === undefined || val === null || val === '')
            return { rate: 0, unit: '' };
        if (typeof val === 'number')
            return { rate: val, unit: '' };
        const s = String(val).trim();
        const parts = s.split('/');
        if (parts.length === 2) {
            return {
                rate: parseFloat(parts[0].replace(/,/g, '')) || 0,
                unit: parts[1].trim(),
            };
        }
        return { rate: parseFloat(s.replace(/,/g, '')) || 0, unit: '' };
    }
}
//# sourceMappingURL=xml-parser.mjs.map