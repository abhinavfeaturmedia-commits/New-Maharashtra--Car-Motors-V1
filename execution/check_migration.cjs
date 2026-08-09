/**
 * check_migration.cjs
 * Queries information_schema.columns via Supabase REST API
 * to see which audit migration columns are already present,
 * then prints ONLY the missing ALTER TABLE statements.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8')
    .split('\n').forEach(line => {
        const eq = line.indexOf('=');
        if (eq > 0 && !line.startsWith('#')) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });

const BASE = env['VITE_SUPABASE_URL'];
const KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];
const host = BASE.replace('https://', '');

const get = (urlPath) => new Promise((resolve, reject) => {
    const req = https.request({
        hostname: host, path: urlPath, method: 'GET',
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Accept': 'application/json' },
    }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
});

const NEEDED = [
    // table, column, definition
    ['customers', 'lead_id',                    `UUID REFERENCES public.leads(id) ON DELETE SET NULL`],
    ['sales',     'sale_type',                  `TEXT DEFAULT 'purchased'`],
    ['sales',     'profit',                     `NUMERIC DEFAULT 0`],
    ['sales',     'purchase_cost_snapshot',     `NUMERIC`],
    ['sales',     'consignment_fee_collected',  `NUMERIC`],
    ['sales',     'lead_id',                    `UUID`],
    ['sales',     'sold_by',                    `UUID`],
    ['sales',     'status',                     `TEXT DEFAULT 'completed'`],
    ['sales',     'payment_status',             `TEXT DEFAULT 'paid'`],
    ['leads',     'assessed_price',             `NUMERIC`],
    ['leads',     'condition_notes',            `TEXT`],
    ['leads',     'offer_made',                 `NUMERIC`],
    ['leads',     'offer_outcome',              `TEXT`],
    ['inventory', 'purchase_cost',              `NUMERIC`],
    ['inventory', 'consignment_owner_name',     `TEXT`],
    ['inventory', 'consignment_owner_phone',    `TEXT`],
    ['inventory', 'consignment_agreed_price',   `NUMERIC`],
    ['inventory', 'consignment_fee_type',       `TEXT`],
    ['inventory', 'consignment_fee_value',      `NUMERIC`],
    ['inventory', 'consignment_start_date',     `DATE`],
    ['inventory', 'consignment_end_date',       `DATE`],
    ['inventory', 'consignment_customer_id',    `UUID`],
];

(async () => {
    console.log('\n🔍  Checking existing columns in Supabase...\n');

    // Fetch all columns for the 4 tables at once
    const qs = `table_schema=eq.public&table_name=in.(customers,sales,leads,inventory)&select=table_name,column_name`;
    const existing = await get(`/rest/v1/information_schema.columns?${qs}`);

    console.log('  Raw response type:', typeof existing, Array.isArray(existing));
    if (!Array.isArray(existing)) {
        console.log('  Raw response:', JSON.stringify(existing).substring(0, 300));
        console.log('\n⚠️  Cannot query information_schema via REST. Generating full migration SQL instead...');
        const missing = NEEDED;
        const sql = [
            '-- Swami Motors Audit Migration',
            '-- Run in: Supabase Dashboard → SQL Editor → New Query',
            '',
            ...missing.map(([tbl, col, def]) =>
                `ALTER TABLE public.${tbl} ADD COLUMN IF NOT EXISTS ${col} ${def};`
            ),
            '',
            `ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_source_check;`,
            `ALTER TABLE public.inventory ADD CONSTRAINT inventory_source_check CHECK (source IN ('purchased','own','consignment','dealer'));`,
            '',
            '-- Done!',
        ].join('\n');
        const outPath = require('path').join(__dirname, '..', 'supabase_minimal_migration.sql');
        require('fs').writeFileSync(outPath, sql);
        console.log('\n' + '='.repeat(60));
        console.log('PASTE THIS IN SUPABASE SQL EDITOR:');
        console.log('='.repeat(60));
        console.log(sql);
        console.log('\n✅  Also saved to: supabase_minimal_migration.sql\n');
        return;
    }

    const existSet = new Set(existing.map(r => `${r.table_name}.${r.column_name}`));

    const missing = NEEDED.filter(([tbl, col]) => !existSet.has(`${tbl}.${col}`));
    const present = NEEDED.filter(([tbl, col]) =>  existSet.has(`${tbl}.${col}`));

    console.log(`✅  Already present: ${present.length}/${NEEDED.length}`);
    present.forEach(([t, c]) => console.log(`    ✓ ${t}.${c}`));

    console.log(`\n❌  Missing: ${missing.length}/${NEEDED.length}`);
    missing.forEach(([t, c]) => console.log(`    ✗ ${t}.${c}`));

    if (missing.length === 0) {
        console.log('\n🎉  All columns already exist — no migration needed!\n');
        return;
    }

    // Generate minimal SQL
    const sql = [
        '-- Swami Motors Audit Migration — MINIMAL (only missing columns)',
        '-- Run this in: Supabase Dashboard → SQL Editor → New Query',
        '',
        ...missing.map(([tbl, col, def]) =>
            `ALTER TABLE public.${tbl} ADD COLUMN IF NOT EXISTS ${col} ${def};`
        ),
        '',
        '-- Fix inventory source constraint',
        'ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_source_check;',
        `ALTER TABLE public.inventory ADD CONSTRAINT inventory_source_check CHECK (source IN ('purchased','own','consignment','dealer'));`,
        '',
        '-- Done! ✓',
    ].join('\n');

    const outPath = path.join(__dirname, '..', 'supabase_minimal_migration.sql');
    fs.writeFileSync(outPath, sql);

    console.log('\n' + '═'.repeat(60));
    console.log('📋  PASTE THIS IN SUPABASE SQL EDITOR:');
    console.log('═'.repeat(60));
    console.log(sql);
    console.log('═'.repeat(60));
    console.log(`\n✅  Also saved to: supabase_minimal_migration.sql\n`);
})();
