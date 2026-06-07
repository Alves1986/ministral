import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data, error } = await supabase.rpc('get_policies' as any).catch(() => ({ data: null, error: 'rpc failed' }));
  
  if (error) {
    // try querying pg_policies directly
    const { data: policies, error: polErr } = await supabase
      .from('pg_policies' as any)
      .select('*')
      .eq('tablename', 'schedule_assignments');
      
    console.log("Policies:", policies || polErr);
  } else {
    console.log(data);
  }
}
check();
