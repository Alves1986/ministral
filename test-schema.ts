import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await sb.from("schedule_assignments").select("*").limit(1);
  console.log("SCHEDULE_ASSIGNMENTS:", Object.keys(data?.[0] || {}));
  
  const { data: sr, error: sre } = await sb.from("swap_requests").select("*").limit(1);
  console.log("SWAP_REQUESTS:", Object.keys(sr?.[0] || {}));

  const { data: mn, error: mne } = await sb.from("ministry_settings").select("*").limit(1);
  console.log("MINISTRY_SETTINGS:", Object.keys(mn?.[0] || {}));

  const { data: wn, error: wne } = await sb.from("whatsapp_notifications").select("*").limit(1);
  console.log("WHATSAPP_NOTIF:", Object.keys(wn?.[0] || {}), wne);
}
main();
