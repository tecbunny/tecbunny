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
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('table_name')
    .eq('table_schema', 'public');
  if (error) {
    console.error(error);
  } else {
    console.log('Tables:', data);
  }
}
main();
