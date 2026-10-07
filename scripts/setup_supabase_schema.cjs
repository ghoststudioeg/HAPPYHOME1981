const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupSchema() {
  console.log('--- STARTING SUPABASE SCHEMA PROVISIONING ---');

  // Check existing tables first
  const { data: existingTables, error: tablesErr } = await supabase.from('products').select('id').limit(1);
  console.log('Existing products query test:', { existingTables, tablesErr });
}

setupSchema();
