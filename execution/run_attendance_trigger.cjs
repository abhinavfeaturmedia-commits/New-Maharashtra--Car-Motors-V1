/**
 * run_attendance_trigger.cjs
 * Runs the sync_leaves_to_attendance_trigger.sql script on Supabase using the database query Management API.
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

const BASE_URL   = env['VITE_SUPABASE_URL'];
const SVCKEY     = env['SUPABASE_SERVICE_ROLE_KEY'];

const projectRef = BASE_URL.replace('https://', '').replace('.supabase.co', '');
const hostname = 'api.supabase.com';
const urlPath = `/v1/projects/${projectRef}/database/query`;

const runSQL = (sqlStatement) => {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: sqlStatement });
        const options = {
            hostname,
            path: urlPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SVCKEY}`,
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body: data });
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
};

(async () => {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', 'sync_leaves_to_attendance_trigger.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log(`\n🔄  Running Attendance trigger migration on Management API for ${projectRef}...`);

    try {
        const r = await runSQL(sql);
        console.log(`Response HTTP ${r.status}: ${r.body}`);

        if (r.status === 200 || r.status === 201) {
            console.log('\n🎉  Trigger created/updated successfully!\n');
        } else {
            console.error('\n❌  Failed to create trigger.\n');
            process.exit(1);
        }
    } catch (err) {
        console.error('\n❌  Network error:', err);
        process.exit(1);
    }
})();
