
import { supabaseAdmin } from './src/lib/data/supabaseDb';
import dotenv from 'dotenv';
dotenv.config();

async function checkRLS() {
  console.log('--- Checking RLS Policies ---');
  try {
    const { data, error } = await supabaseAdmin
      .from('pg_policies' as any)
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'products');
    
    if (error) {
      // If we can't query pg_policies directly, try to get them via RPC if available
      console.error('Error querying pg_policies:', error.message);
    } else {
      console.log('Policies for products:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Failed to check RLS:', err);
  }
}

checkRLS();
