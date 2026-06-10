import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env variables');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('quotes')
    .select('id, quote_number, customer_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
