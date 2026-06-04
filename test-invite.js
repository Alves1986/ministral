import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const envUrl = process.env.VITE_SUPABASE_URL || '';
const envKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!envUrl || !envKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const sb = createClient(envUrl, envKey);

async function testGenerate() {
    console.log("Generating first token...");
    let token1 = Math.random().toString(36).substring(2, 15);
    const payload1 = { 
        token: token1, 
        organization_id: "test-org", 
        ministry_id: "test-min", 
        created_by: "test-user",
        expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(), 
        used: false
    };

    const { data: d1, error: e1 } = await sb.from('invite_tokens').insert(payload1);
    console.log("Result 1:", { error: e1?.message });

    console.log("Generating second token...");
    let token2 = Math.random().toString(36).substring(2, 15);
    const payload2 = { 
        token: token2, 
        organization_id: "test-org", 
        ministry_id: "test-min", 
        created_by: "test-user",
        expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(), 
        used: false
    };

    const { data: d2, error: e2 } = await sb.from('invite_tokens').insert(payload2);
    console.log("Result 2:", { error: e2?.message });
}

testGenerate().then(() => console.log("Done")).catch(console.error);
