export default async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  console.log("URL:", url, "Key:", key ? "exists" : "missing");
}
run();
