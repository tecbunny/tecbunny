const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ulpgnuiocjfrwpdediik.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscGdudWlvY2pmcndwZGVkaWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY2NDg3NiwiZXhwIjoyMDk2MjQwODc2fQ.L4xjlqwlNgCGgAZIgxIVwLCdJyLuCr6qi2-ercKSoAw'
);

async function listTables() {
  console.log('Fetching table list...');
  // We can query postgrest to see table list
  const { data, error } = await supabase.rpc('get_tables'); // Or query from pg_catalog if we have direct SQL access, but RPC might not exist.
  // Let's try select from pg_class/pg_namespace or use standard REST API options:
  // Let's query information_schema or run a raw sql query via REST? No, REST doesn't allow raw SQL unless we have a specific RPC function.
  // But we can check what tables exist by querying something like `supabase.from('products').select('count')` or others.
  // Let's query some typical table names:
  const tables = ['products', 'profiles', 'orders', 'sales_agents', 'service_tickets', 'quotes'];
  for (const table of tables) {
    const { data: tblData, error: tblErr } = await supabase.from(table).select('*').limit(1);
    if (tblErr) {
      console.log(`Table '${table}' failed:`, tblErr.message);
    } else {
      console.log(`Table '${table}' exists. Row keys:`, tblData[0] ? Object.keys(tblData[0]) : 'empty');
    }
  }
}

listTables();
