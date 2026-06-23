import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
}, {} as Record<string, string>);

const adminSupabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await adminSupabase.from('pg_policies').select('*').eq('tablename', 'ministry_members');
    console.log(JSON.stringify(data, null, 2));
    if (error) console.log("Error:", error);
}
run();
