/**
 * run_migration.js
 * Runs supabase_audit_migration.sql against your Supabase project
 * using the service role key (which has DDL permissions).
 *
 * Usage:
 *   1. Add SUPABASE_SERVICE_ROLE_KEY to your .env
 *   2. node execution/run_migration.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PROJECT_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROJECT_URL || !SERVICE_KEY) {
    console.error('\n❌  Missing credentials.');
    console.error('   Add SUPABASE_SERVICE_ROLE_KEY to your .env file.');
    console.error('   Find it in: Supabase Dashboard → Project Settings → API → service_role\n');
    process.exit(1);
}

// Read the migration SQL
const sqlPath = path.join(__dirname, '..', 'supabase_audit_migration.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

// Split into individual statements (skip comments and blanks)
const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`\n🔄  Running ${statements.length} SQL statements against ${PROJECT_URL}...\n`);

// We use the Supabase REST SQL endpoint (/rest/v1/rpc/exec_sql if it exists,
// otherwise fall back to the pg_meta/query endpoint on the management API).
// For simplicity we call each statement via the pg_meta query API.

const projectRef = PROJECT_URL.replace('https://', '').replace('.supabase.co', '');
const host = 'api.supabase.com';

const runSQL = (sqlStatement) => {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: sqlStatement + ';' });
        const options = {
            hostname: host,
            path: `/v1/projects/${projectRef}/database/query`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ ok: true });
                } else {
                    try {
                        const parsed = JSON.parse(data);
                        // Treat "already exists" errors as OK (idempotent)
                        const msg = parsed.message || parsed.error || data;
                        if (msg.includes('already exists') || msg.includes('does not exist')) {
                            resolve({ ok: true, skipped: true, msg });
                        } else {
                            resolve({ ok: false, msg });
                        }
                    } catch {
                        resolve({ ok: false, msg: data });
                    }
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
};

(async () => {
    let passed = 0, skipped = 0, failed = 0;

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.replace(/\n/g, ' ').substring(0, 72);
        process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}…`);

        try {
            const result = await runSQL(stmt);
            if (result.ok) {
                if (result.skipped) {
                    console.log(` ⚠️  skipped (${result.msg?.substring(0, 60)})`);
                    skipped++;
                } else {
                    console.log(' ✅');
                    passed++;
                }
            } else {
                console.log(` ❌  ${result.msg?.substring(0, 80)}`);
                failed++;
            }
        } catch (err) {
            console.log(` ❌  Network error: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`✅  Passed:  ${passed}`);
    console.log(`⚠️   Skipped: ${skipped}`);
    console.log(`❌  Failed:  ${failed}`);
    console.log('─'.repeat(60));

    if (failed === 0) {
        console.log('\n🎉  Migration complete! All columns are now live.\n');
    } else {
        console.log('\n⚠️   Some statements failed. Check errors above.\n');
    }
})();
