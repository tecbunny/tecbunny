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
  console.log('Testing Supabase Admin Auth...');
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('listUsers error:', usersError);
  } else {
    console.log('listUsers success, users count:', usersData.users.length);
  }

  console.log('Testing DB connection (profiles)...');
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);
  
  if (profilesError) {
    console.error('profiles query error:', profilesError);
  } else {
    console.log('profiles query success, row count:', profilesData.length);
  }
}
main();
