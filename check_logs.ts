import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
}, {} as Record<string, string>);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
    const { count: c1, error: e1 } = await supabase.from('whatsapp_send_log').select('*', { count: 'exact', head: true });
    console.log("whatsapp_send_log count:", c1, e1 ? e1.message : "");

    const { count: c2, error: e2 } = await supabase.from('whatsapp_sent_log').select('*', { count: 'exact', head: true });
    console.log("whatsapp_sent_log count:", c2, e2 ? e2.message : "");
}
run();
