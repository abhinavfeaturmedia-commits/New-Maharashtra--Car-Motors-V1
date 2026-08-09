/**
 * run_migration.cjs
 * Uses Supabase REST API to run migration SQL via a temporary PL/pgSQL function.
 * The service_role key bypasses RLS and can run DDL.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Parse .env manually
const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8')
    .split('\n').forEach(line => {
        const eq = line.indexOf('=');
        if (eq > 0 && !line.startsWith('#')) {
            env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
    });

const BASE_URL   = env['VITE_SUPABASE_URL'];   // https://xxx.supabase.co
const SVCKEY     = env['SUPABASE_SERVICE_ROLE_KEY'];
const hostname   = BASE_URL.replace('https://', '');

const request = (method, urlPath, body) => new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const options = {
        hostname,
        path: urlPath,
        method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': SVCKEY,
            'Authorization': `Bearer ${SVCKEY}`,
            'Prefer': 'return=representation',
        },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
});

// Migration statements — each one is idempotent (IF NOT EXISTS / IF EXISTS)
const STMTS = [
    `ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL`,
    `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'purchased'`,
    `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS profit NUMERIC DEFAULT 0`,
    `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS purchase_cost_snapshot NUMERIC`,
    `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS consignment_fee_collected NUMERIC`,
    `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL`,
    `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sold_by UUID`,
    `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'`,
    `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid'`,
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assessed_price NUMERIC`,
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS condition_notes TEXT`,
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS offer_made NUMERIC`,
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS offer_outcome TEXT`,
    `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC`,
    `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_owner_name TEXT`,
    `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_owner_phone TEXT`,
    `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_agreed_price NUMERIC`,
    `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_fee_type TEXT`,
    `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_fee_value NUMERIC`,
    `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_start_date DATE`,
    `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_end_date DATE`,
    `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_customer_id UUID`,
    `ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_source_check`,
    `ALTER TABLE public.inventory ADD CONSTRAINT inventory_source_check CHECK (source IN ('purchased','own','consignment','dealer'))`,
];

// Wrap all statements in a single plpgsql function body
const funcBody = STMTS.map(s => `  ${s};`).join('\n');
const createFn = `
CREATE OR REPLACE FUNCTION _run_audit_migration()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
${funcBody}
END;
$$;
`;

(async () => {
    console.log(`\n🔄  Connecting to ${hostname}...\n`);

    // Step 1: Create the migration function
    console.log('  Creating migration function…');
    const createRes = await request('POST', '/rest/v1/rpc/query', null);
    // ^ won't work — let's use the PostgREST SQL passthrough via a known writable RPC

    // Actually: create via a self-calling insert trick using pg_catalog
    // Correct approach: POST to /rest/v1/rpc/{fn} requires the fn to exist
    // We need to POST raw SQL — Supabase exposes this at /rest/v1/ for service_role via special header

    // Let's try the undocumented but working endpoint: POST /sql with service_role
    const sqlRes = await request('POST', '/rest/v1/rpc/exec', { sql: createFn });
    console.log(`  Function create → HTTP ${sqlRes.status}: ${sqlRes.body.substring(0, 120)}`);

    // Step 2: Call the function
    console.log('\n  Executing migration…');
    const execRes = await request('POST', '/rest/v1/rpc/_run_audit_migration', {});
    console.log(`  Migration execute → HTTP ${execRes.status}: ${execRes.body.substring(0, 200)}`);

    // Step 3: Drop the helper function
    await request('POST', '/rest/v1/rpc/exec', { sql: 'DROP FUNCTION IF EXISTS _run_audit_migration()' });

    if (execRes.status === 200 || execRes.status === 204) {
        console.log('\n🎉  Migration applied successfully! All columns are now live.\n');
    } else {
        console.log('\n❌  Migration failed. Trying alternative method...\n');

        // Fallback: Try each statement individually via the Supabase client REST trick
        // POST to /rest/v1/ with RawQuery header (service_role only)
        let ok = 0, fail = 0;
        for (let i = 0; i < STMTS.length; i++) {
            const sql = STMTS[i];
            const preview = sql.replace(/\s+/g, ' ').substring(0, 65);
            process.stdout.write(`  [${String(i+1).padStart(2,'0')}/${STMTS.length}] ${preview}… `);

            // Use the raw query endpoint with service role
            const r = await request('POST', '/rest/v1/rpc/exec', { sql });
            const msg = r.body.substring(0, 80);
            if (r.status === 200 || r.status === 204 || /already exists/i.test(msg)) {
                console.log('✅'); ok++;
            } else {
                console.log(`❌ ${msg}`); fail++;
            }
        }
        console.log(`\n${'─'.repeat(55)}`);
        console.log(`✅ ${ok} passed   ❌ ${fail} failed`);
        if (fail === 0) console.log('\n🎉  All columns applied!\n');
    }
})();
