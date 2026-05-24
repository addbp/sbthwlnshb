/**
 * process-data.js — Sabbath Spa Historical Data Cleaner (Final)
 *
 * Usage:  node process-data.js
 *
 * Place this file in the same folder as the two CSV inputs, then run it.
 *
 * Input:
 *   "Copy of SABBATH SPA SALES - SERVICES_IMPORT.csv"
 *   "Copy of SABBATH SPA SALES - FOOD_IMPORT.csv"
 *
 * Output:
 *   PERFECT_services_history.csv   — 13 columns, Supabase-ready
 *   PERFECT_food_history.csv       — 7 columns,  Supabase-ready
 */

const fs = require('fs');
const crypto = require('crypto');

// ─── Config ───────────────────────────────────────────────────────────────────

const SERVICES_IN = 'Copy of SABBATH SPA SALES - SERVICES_IMPORT.csv';
const FOOD_IN = 'Copy of SABBATH SPA SALES - FOOD_IMPORT.csv';
const SERVICES_OUT = 'PERFECT_services_history.csv';
const FOOD_OUT = 'PERFECT_food_history.csv';

const FALLBACK_DATE = '2025-01-01';
const DEFAULT_TIME = '12:00:00';
const DEFAULT_STATUS = 'completed';   // all historical rows are done
const DEFAULT_PAYMENT = 'paid';        // all historical rows are paid

// ─── Membership tiers found in actual data ────────────────────────────────────
// Verified by scanning every value in col 5 of the raw file.
// PLATINUM / VIP / BASIC are real membership tiers.
// Everything else (SENIOR, FAMILY, PWD, etc.) is a discount reason, not a tier.

const MEMBERSHIP_TIERS = new Set(['PLATINUM', 'VIP', 'BASIC']);

// ─── CSV line parser ──────────────────────────────────────────────────────────

function parseLine(line) {
    const fields = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            fields.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    fields.push(cur.trim());
    return fields;
}

// ─── Strict number ────────────────────────────────────────────────────────────
// Strips everything except digits and dots. Returns '0' for empty/unparseable.

function strictNumber(val) {
    if (!val) return '0';
    const cleaned = String(val).replace(/[^0-9.]/g, '');
    if (!cleaned || cleaned === '.') return '0';
    const n = parseFloat(cleaned);
    return isNaN(n) ? '0' : String(n);
}

// ─── Strict date → YYYY-MM-DD ─────────────────────────────────────────────────

function strictDate(raw) {
    if (!raw) return FALLBACK_DATE;
    const s = raw.trim();
    if (!s) return FALLBACK_DATE;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const normalised = s
        .replace(/^([A-Za-z]+)\s+(\d+)\s+(\d{4})$/, '$1 $2, $3')
        .replace(/^([A-Za-z]+)\s+(\d+),(\d{4})$/, '$1 $2, $3');

    const d = new Date(normalised);
    if (isNaN(d.getTime())) return FALLBACK_DATE;
    const yyyy = d.getFullYear();
    if (yyyy < 2020 || yyyy > 2035) return FALLBACK_DATE;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ─── Text cleaner ─────────────────────────────────────────────────────────────

function cleanText(val) {
    if (!val) return '';
    return String(val).trim().replace(/\s{2,}/g, ' ');
}

// ─── Customer type mapper ─────────────────────────────────────────────────────
// Actual values in file: "1ST TIME CUSTOMER", "REPEAT CUSTOMER"

function mapCustomerType(raw) {
    if (!raw) return '';
    const v = raw.trim().toUpperCase();
    if (v.includes('1ST') || v.includes('NEW') || v.includes('FIRST')) return 'new';
    if (v.includes('REPEAT') || v.includes('RETURN')) return 'returning';
    return '';
}

// ─── Membership type mapper ───────────────────────────────────────────────────
// Only PLATINUM, VIP, BASIC are real membership tiers in this dataset.

function mapMembership(raw) {
    if (!raw) return '';
    const v = raw.trim().toUpperCase();
    for (const tier of MEMBERSHIP_TIERS) {
        if (v === tier) return tier.charAt(0) + tier.slice(1).toLowerCase(); // e.g. "Platinum"
    }
    return '';
}

// ─── Net sales fixer ──────────────────────────────────────────────────────────
// If net_sales is 0 but total_amount > 0, derive it as total - discount.

function fixNetSales(totalStr, discountStr, netStr) {
    const net = parseFloat(netStr) || 0;
    const total = parseFloat(totalStr) || 0;
    const discount = parseFloat(discountStr) || 0;
    if (net === 0 && total > 0) {
        const derived = total - discount;
        return String(derived >= 0 ? derived : 0);
    }
    return netStr || '0';
}

// ─── CSV writer ───────────────────────────────────────────────────────────────

function escape(val) {
    const s = val == null ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function writeCsv(filePath, headers, rows) {
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map(h => escape(row[h] ?? '')).join(','));
    }
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// ─── SERVICES processor ───────────────────────────────────────────────────────
//
// Raw column indices (verified from actual file header):
//  0  DATE               →  booking_date
//  1  Customer Type      →  customer_type
//  2  CLIENT'S NAME      →  client_name_text
//  3  CATEGORY           →  category
//  4  SERVICE            →  service_name_text
//  5  DISCOUNT/MEMBERSHIP→  membership_type (tiers only)
//  7  THERAPIST          →  therapist_name_text
//  11 SERVICE AMOUNT     →  total_amount
//  13 DISCOUNT           →  discount_amount
//  17 NET SALES          →  net_sales

function processServices() {
    console.log(`\n📂  Reading: ${SERVICES_IN}`);

    const raw = fs.readFileSync(SERVICES_IN, 'utf8');
    const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // Exact 13 columns required by the database — in this order, nothing else.
    const headers = [
        'booking_date',
        'booking_time',
        'client_name_text',
        'service_name_text',
        'therapist_name_text',
        'category',
        'total_amount',
        'discount_amount',
        'net_sales',
        'customer_type',
        'membership_type',
        'payment_status',
        'booking_status',
    ];

    const results = [];
    let skipped = 0;
    let written = 0;
    let netFixed = 0;
    let fallbackDates = 0;

    // Fill-down state
    let lastDate = '';
    let lastCustomerType = '';
    let lastClientName = '';

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const c = parseLine(line);

        // Fill-down: use last non-empty value if cell is blank
        if (c[0]) lastDate = c[0];
        if (c[1]) lastCustomerType = c[1];
        if (c[2]) lastClientName = c[2];

        const service = cleanText(c[4]);
        const rawAmount = c[11] || '';

        // Skip rows with no service name AND no amount — pure junk/spacer rows
        if (!service && strictNumber(rawAmount) === '0') {
            skipped++;
            continue;
        }

        const bookingDate = strictDate(lastDate);
        if (bookingDate === FALLBACK_DATE && lastDate) fallbackDates++;

        const totalAmount = strictNumber(rawAmount);
        const discountAmount = strictNumber(c[13]);
        const rawNet = strictNumber(c[17]);
        const netSales = fixNetSales(totalAmount, discountAmount, rawNet);
        if (netSales !== rawNet) netFixed++;

        results.push({
            booking_date: bookingDate,
            booking_time: DEFAULT_TIME,
            client_name_text: cleanText(lastClientName),
            service_name_text: service,
            therapist_name_text: cleanText(c[7]),
            category: cleanText(c[3]),
            total_amount: totalAmount,
            discount_amount: discountAmount,
            net_sales: netSales,
            customer_type: mapCustomerType(lastCustomerType),
            membership_type: mapMembership(c[5]),
            payment_status: DEFAULT_PAYMENT,
            booking_status: DEFAULT_STATUS,
        });
        written++;
    }

    writeCsv(SERVICES_OUT, headers, results);
    console.log(`   ✅ Written        : ${SERVICES_OUT}`);
    console.log(`   📊 Rows out       : ${written.toLocaleString()}`);
    console.log(`   🗑️  Skipped        : ${skipped.toLocaleString()} (no service + no amount)`);
    console.log(`   🔧 Net sales fixed : ${netFixed.toLocaleString()} (derived from total − discount)`);
    if (fallbackDates > 0) {
        console.log(`   ⚠️  Fallback dates : ${fallbackDates} row(s) unparseable → set to ${FALLBACK_DATE}`);
    }
}

// ─── FOOD processor ───────────────────────────────────────────────────────────
//
// Raw column indices (verified from actual file header):
//  0  DATE        →  created_at (YYYY-MM-DD 12:00:00)
//  3  FOOD        →  notes  (item name)
//  8  FOOD AMOUNT →  amount (strict number)
//
// Output maps to the Supabase `payments` table:
//   created_at, amount, payment_status, payment_method, notes

function processFood() {
    console.log(`\n📂  Reading: ${FOOD_IN}`);

    const raw = fs.readFileSync(FOOD_IN, 'utf8');
    const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // Exact 8 columns matching the Supabase payments table schema — in order.
    const headers = [
        'created_at',
        'amount',
        'payment_status',
        'payment_method',
        'notes',
    ];

    const results = [];
    let skipped = 0;
    let written = 0;
    let fallbackDates = 0;

    let lastDate = '';

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const c = parseLine(line);

        // Fill-down date
        if (c[0]) lastDate = c[0];

        // col 3 = FOOD item name
        const foodItem = cleanText(c[3]);

        // Skip if no item name, or item is literally '0'
        if (!foodItem || foodItem === '0') { skipped++; continue; }

        const dateOnly = strictDate(lastDate);
        if (dateOnly === FALLBACK_DATE && lastDate) fallbackDates++;

        // col 8 = FOOD AMOUNT → amount, forced to 2 decimal places for numeric type
        const amount = parseFloat(strictNumber(c[8]) || '0').toFixed(2);

        results.push({
            id: crypto.randomUUID(),               // empty — Supabase generates UUID
            created_at: `${dateOnly} 12:00:00+00`,
            booking_id: '',               // empty — NULL
            amount: amount,
            payment_status: DEFAULT_PAYMENT,  // 'paid'
            payment_method: 'cash',
            notes: foodItem,
            client_id: '',               // empty — NULL
        });
        written++;
    }

    writeCsv(FOOD_OUT, headers, results);
    console.log(`   ✅ Written        : ${FOOD_OUT}`);
    console.log(`   📊 Rows out       : ${written.toLocaleString()}`);
    console.log(`   🗑️  Skipped        : ${skipped.toLocaleString()} (empty or '0' item names)`);
    if (fallbackDates > 0) {
        console.log(`   ⚠️  Fallback dates : ${fallbackDates} row(s) unparseable → set to ${FALLBACK_DATE}`);
    }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateOutput(filePath, numericCols) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const headers = parseLine(lines[0]);
    let issues = 0;

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const c = parseLine(lines[i]);
        for (const col of numericCols) {
            const idx = headers.indexOf(col);
            if (idx === -1) continue;
            const val = c[idx] || '';
            if (val !== '' && !/^[0-9]+(\.[0-9]+)?$/.test(val)) {
                console.log(`   ⚠️  Row ${i + 1} [${col}]: "${val}"`);
                issues++;
            }
        }
    }
    if (issues === 0) console.log(`   ✅ All numeric columns clean`);
    else console.log(`   ⚠️  ${issues} issue(s) — review before importing`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════╗');
console.log('║   Sabbath Spa — Data Cleaner (Final)     ║');
console.log('╚══════════════════════════════════════════╝');

const missing = [SERVICES_IN, FOOD_IN].filter(f => !fs.existsSync(f));
if (missing.length) {
    console.error('\n❌  Missing input files:');
    missing.forEach(f => console.error(`     ${f}`));
    process.exit(1);
}

processServices();
processFood();

console.log('\n🔍  Validating numeric columns...');
console.log(`  ${SERVICES_OUT}:`);
validateOutput(SERVICES_OUT, ['total_amount', 'discount_amount', 'net_sales']);
console.log(`  ${FOOD_OUT}:`);
validateOutput(FOOD_OUT, ['amount']);

console.log('\n✨  Done! Both files are Supabase-ready.\n');