
import { supabaseAdmin } from './src/lib/data/supabaseDb';
import dotenv from 'dotenv';
dotenv.config();

async function checkPublishedOnly() {
  console.log('--- Checking Published Products ---');
  try {
    const { data, error } = await supabaseAdmin.from('products').select('id, name, is_published');
    if (error) throw error;
    
    console.log('Total count:', data.length);
    const published = data.filter((p: any) => p.is_published === true);
    console.log('Published count:', published.length);
    if (published.length > 0) {
       console.log('First published item:', JSON.stringify(published[0], null, 2));
    }
  } catch (err) {
    console.error('Failed to check published:', err);
  }
}

checkPublishedOnly();
