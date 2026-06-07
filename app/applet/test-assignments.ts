import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fyenjzfyjlfhvayelrpp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZW5qemZ5amxmaHZheWVscnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzY1ODEsImV4cCI6MjA5MDAxMjU4MX0.wWeqy8qeOktLn4rRWmpManHQLcrysUXLHMf1RiqqKDA";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: assignments, error } = await supabase.from("schedule_assignments").select("*");
  console.log("Error:", error);
  console.log("Assignments for rule:", assignments);
}

check();
