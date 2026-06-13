const { createClient } = require('@supabase/supabase-js');

console.log('ENV NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('ENV SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing');

if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  supabase.from('services').select('*').limit(1).then(({ data, error }) => {
    if (error) {
      console.error('Error fetching services:', error);
    } else {
      console.log('Fetched services row:', data);
    }
  });
}
