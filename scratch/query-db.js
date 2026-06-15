import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8');
const getEnvVal = (name) => {
  const match = env.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const url = getEnvVal('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnvVal('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, key);

async function main() {
  console.log('Querying orders...');
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .limit(1);
  if (error) {
    console.error('Query error:', error);
  } else {
    console.log('Query success:', data);
  }
}
main();
