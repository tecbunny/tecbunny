const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ulpgnuiocjfrwpdediik.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscGdudWlvY2pmcndwZGVkaWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY2NDg3NiwiZXhwIjoyMDk2MjQwODc2fQ.L4xjlqwlNgCGgAZIgxIVwLCdJyLuCr6qi2-ercKSoAw'
);

async function checkProducts() {
  console.log('Querying all products in supabase...');
  const { data: allProducts, error: allErr } = await supabase
    .from('products')
    .select('id, title, status, is_active, is_deleted, price, mrp, stock_quantity, image, description');

  if (allErr) {
    console.error('Error fetching all products:', allErr);
    return;
  }

  console.log(`Total products in DB: ${allProducts.length}`);
  allProducts.forEach((p, i) => {
    console.log(`\nProduct ${i + 1}: ${p.title} (ID: ${p.id})`);
    console.log(`  status: ${p.status}`);
    console.log(`  is_active: ${p.is_active}`);
    console.log(`  is_deleted: ${p.is_deleted}`);
    console.log(`  price: ${p.price}`);
    console.log(`  mrp: ${p.mrp}`);
    console.log(`  stock_quantity: ${p.stock_quantity}`);
    console.log(`  image: ${p.image ? 'Present' : 'Null/Empty'}`);
    console.log(`  description: ${p.description ? 'Present' : 'Null/Empty'}`);
  });
}

checkProducts();
