const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://mehfdwqululparywkpde.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('No Supabase Key found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugProducts() {
  console.log('--- DEBUGGING PRODUCTS DATA FLOW ---');
  console.log('Using URL:', supabaseUrl);

  try {
    // 1. Raw count
    const { data: rawData, error: rawError } = await supabase.from('products').select('*');
    if (rawError) {
      console.error('Raw query error:', rawError.message);
      return;
    }
    console.log('Raw products count:', rawData.length);

    if (rawData.length > 0) {
      const first = rawData[0];
      console.log('Sample product keys:', Object.keys(first));
      console.log('Sample product (first 1):', JSON.stringify(first, null, 2));

      // 2. Check is_published values
      const publishedCount = rawData.filter(p => p.is_published === true).length;
      const unpublishedCount = rawData.filter(p => p.is_published === false).length;
      const nullPublishedCount = rawData.filter(p => p.is_published === null || p.is_published === undefined).length;
      
      console.log('is_published = true count:', publishedCount);
      console.log('is_published = false count:', unpublishedCount);
      console.log('is_published is null/undefined count:', nullPublishedCount);

      // 3. Check is_available values
      const availableCount = rawData.filter(p => p.is_available === true).length;
      console.log('is_available = true count:', availableCount);

      // 4. Check for company_id and is_deleted
      console.log('Contains is_deleted column:', 'is_deleted' in first);
      console.log('Contains company_id column:', 'company_id' in first);
      console.log('Contains category_id column:', 'category_id' in first);
    }

    // 5. Simulate the exact query used in productService.ts
    console.log('Simulating productService.getAllProducts(false) query...');
    const { data: filteredData, error: filteredError } = await supabase
      .from('products')
      .select('*')
      .eq('is_published', true);
    
    if (filteredError) {
      console.error('Filtered query error:', filteredError.message);
    } else {
      console.log('Filtered products count (is_published=true):', filteredData.length);
    }

  } catch (err) {
    console.error('Exception during debug:', err.message);
  }
}

debugProducts();
