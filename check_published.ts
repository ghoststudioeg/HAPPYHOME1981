
import { supabaseAdmin } from './src/lib/data/supabaseDb';
import dotenv from 'dotenv';
dotenv.config();

async function checkPublished() {
  console.log('--- Checking Published Products ---');
  try {
    const { data, error } = await supabaseAdmin.from('products').select('id, name, is_published, is_deleted');
    if (error) throw error;
    
    console.log('Total count:', data.length);
    const published = data.filter((p: any) => p.is_published === true);
    console.log('Published count:', published.length);
    console.log('Published items:', JSON.stringify(published, null, 2));

    const deleted = data.filter((p: any) => p.is_deleted === true);
    console.log('Deleted count:', deleted.length);
  } catch (err) {
    console.error('Failed to check published:', err);
  }
}

checkPublished();
