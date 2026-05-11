import { createClient } from '@supabase/supabase-js';

const url = 'https://fyenjzfyjlfhvayelrpp.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZW5qemZ5amxmaHZheWVscnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzY1ODEsImV4cCI6MjA5MDAxMjU4MX0.wWeqy8qeOktLn4rRWmpManHQLcrysUXLHMf1RiqqKDA';
const sb = createClient(url, key);

async function run() {
  const { data: requests } = await sb.from('swap_requests').select('*');
  console.log("ALL SWAP REQUESTS:");
  console.log(JSON.stringify(requests, null, 2));

  if (requests && requests.length > 0) {
    for (const req of requests) {
      const datePart = req.event_datetime.split('T')[0];
      console.log(`\nChecking request ${req.id} for datePart: ${datePart}, role: ${req.role}, member_id: ${req.requester_id}, org: ${req.organization_id}`);
      
      const { data: assignment, error } = await sb.from('schedule_assignments')
        .select('*')
        .eq('organization_id', req.organization_id)
        .eq('ministry_id', req.ministry_id)
        .eq('event_date', datePart)
        .eq('role', req.role)
        .eq('member_id', req.requester_id);
      
      console.log("Assignments found by member_id:", assignment);
      if (error) console.log("Error:", error);

      const { data: byName } = await sb.from('schedule_assignments')
        .select('*, profiles!inner(name)')
        .eq('organization_id', req.organization_id)
        .eq('ministry_id', req.ministry_id)
        .eq('event_date', datePart)
        .eq('role', req.role)
        .eq('profiles.name', req.requester_name);

      console.log("Assignments found by name:", byName);
    }
  }
}

run();
