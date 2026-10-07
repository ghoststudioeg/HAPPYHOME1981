const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://mehfdwqululparywkpde.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('Using Supabase URL:', supabaseUrl);
console.log('Using Supabase Key configured:', !!supabaseKey);

if (!supabaseKey) {
  console.error('No key found!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('--- TABLE ROW COUNTS ---');
  const tables = ['products', 'categories', 'companies', 'store_settings'];
  for (const table of tables) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.error(`Error querying count for table ${table}:`, error.message);
      } else {
        console.log(`${table} count = ${count}`);
      }
    } catch (err) {
      console.error(`Exception querying count for table ${table}:`, err.message);
    }
  }

  console.log('--- STORAGE FALLBACK FILES ---');
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
  const collections = ['products', 'categories', 'companies', 'store_settings', 'bundle_offers', 'orders', 'coupons'];
  for (const col of collections) {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(`database/data/${col}.json`);
      if (error) {
        console.log(`Storage file for ${col} NOT found:`, error.message);
      } else {
        const text = await data.text();
        const items = JSON.parse(text);
        console.log(`Storage file ${col}.json count = ${Array.isArray(items) ? items.length : 'invalid json'}`);
      }
    } catch (err) {
      console.log(`Exception checking storage for ${col}:`, err.message);
    }
  }

  console.log('--- PRODUCT SAMPLE ---');
  try {
    const { data, error } = await supabase.from('products').select('*').limit(3);
    if (error) {
      console.error('Error fetching sample products:', error.message);
    } else {
      console.log('Products found (first 3):', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Exception fetching sample products:', err.message);
  }
}

diagnose();
