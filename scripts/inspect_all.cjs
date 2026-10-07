const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://mehfdwqululparywkpde.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectAll() {
  console.log('=== PRODUCTS ===');
  const { data: prods } = await supabase.from('products').select('*');
  console.log('Products Count:', prods ? prods.length : 'null');
  if (prods && prods.length > 0) {
    console.log('First Product Keys:', Object.keys(prods[0]));
    console.log('First Product values:', JSON.stringify(prods[0], null, 2));
  }

  console.log('=== CATEGORIES ===');
  const { data: cats } = await supabase.from('categories').select('*');
  console.log('Categories Count:', cats ? cats.length : 'null');
  if (cats && cats.length > 0) {
    console.log('First Category Keys:', Object.keys(cats[0]));
    console.log('First Category values:', JSON.stringify(cats[0], null, 2));
  }

  console.log('=== COMPANIES ===');
  // Check if companies table exists by fetching
  try {
    const { data: corps, error } = await supabase.from('companies').select('*');
    if (error) {
      console.log('Companies table select error:', error.message);
    } else {
      console.log('Companies Count:', corps ? corps.length : 'null');
      if (corps && corps.length > 0) {
        console.log('First Company Keys:', Object.keys(corps[0]));
      }
    }
  } catch (err) {
    console.log('Companies exception:', err.message);
  }

  console.log('=== STORE SETTINGS ===');
  const { data: settings } = await supabase.from('store_settings').select('*');
  console.log('Store Settings Count:', settings ? settings.length : 'null');
  if (settings && settings.length > 0) {
    console.log('First Store Settings Keys:', Object.keys(settings[0]));
    console.log('First Store Settings values:', JSON.stringify(settings[0], null, 2));
  }
}

inspectAll();
