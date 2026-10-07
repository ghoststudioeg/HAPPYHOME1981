
import { supabaseDb } from './src/lib/data/supabaseDb';
import dotenv from 'dotenv';
dotenv.config();

async function checkMoreCollections() {
  const collections = [
    'bundle_offers',
    'companies',
    'installmentProviders',
    'coupons',
    'promotions'
  ];

  for (const col of collections) {
    console.log(`--- Checking ${col} ---`);
    try {
      const list = await supabaseDb.getCollection(col);
      console.log(`Count:`, list.length);
      if (list.length > 0) console.log(`First item sample:`, JSON.stringify(list[0], null, 2));
    } catch (err) {
      console.error(`Failed to check ${col}:`, err);
    }
  }
}

checkMoreCollections();
