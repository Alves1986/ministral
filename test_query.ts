import { createClient } from '@supabase/supabase-js';
import process from 'process';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const sb = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await sb.from('schedule_assignments').select('member_id, event_date, confirmed, event_rules(time)').limit(5);
    console.log(JSON.stringify(data, null, 2), error);
}

test();

