const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://mehfdwqululparywkpde.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listTables() {
  console.log('=== LISTING ALL TABLES ===');
  try {
    const { data, error } = await supabase.rpc('get_tables'); // Check if there is an rpc
    if (error) {
      console.log('RPC get_tables failed, querying pg_catalog instead...');
      const { data: catData, error: catErr } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
      if (catErr) {
        // Let's use a query on pg_class or another system view via a direct sql-like approach if we can,
        // or let's try querying standard system tables
        console.log('Failed to query pg_tables directly:', catErr.message);
        
        // Let's try querying pg_type or something else, or run an RPC
        const { data: schemas, error: schemaErr } = await supabase.from('_analytics_events').select('*').limit(1);
        console.log('Testing general select error:', schemaErr ? schemaErr.message : 'success');
      } else {
        console.log('Tables found via pg_tables:', catData);
      }
    } else {
      console.log('Tables found:', data);
    }
  } catch (err) {
    console.error('Exception listing tables:', err.message);
  }

  // Let's try getting tables list by selecting from pg_catalog pg_tables via the rest api (it might be exposed)
  try {
    const { data: r, error: re } = await supabase.from('pg_catalog.pg_tables').select('tablename');
    console.log('Direct pg_catalog.pg_tables select:', re ? re.message : r);
  } catch (e) {
    console.log('pg_catalog exception:', e.message);
  }
}

listTables();
