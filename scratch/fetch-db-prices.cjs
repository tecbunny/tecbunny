const { createClient } = require('@supabase/supabase-js');

// Local Supabase credentials from config.toml and common defaults
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IjdlNzQzMzQxLTNmZTktNGJkNi04OGJkLTM5MzYwYzc2YzUyZCIsInJvbGUiOiJhb24iLCJpYXQiOjE2ODE4MTE2MDAsImV4cCI6MTk5NzM4NzYwMH0.placeholder'; // standard default fallback key or placeholder

const supabase = createClient(supabaseUrl, supabaseKey);
supabase.from('products').select('id, title, price, mrp').then(({ data, error }) => {
  if (error) {
    console.error('REST API failed, trying direct DB connection...');
    const { Client } = require('pg');
    const client = new Client({
      connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres'
    });
    client.connect()
      .then(() => client.query('SELECT id, title, price, mrp FROM products'))
      .then(res => {
        console.log('Successfully fetched from DB:', res.rows.length, 'rows');
        console.log('Sample row:', res.rows[0]);
        client.end();
      })
      .catch(dbErr => {
        console.error('Both REST and DB failed.');
        console.error('DB Error:', dbErr.message);
        client.end();
      });
  } else {
    console.log('REST API Success:', data.length, 'rows');
    console.log('Sample row:', data[0]);
  }
});
