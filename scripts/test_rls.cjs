const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://mehfdwqululparywkpde.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!serviceRoleKey || !anonKey) {
  console.error('FATAL: Both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY must be configured.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const publicClient = createClient(supabaseUrl, anonKey);

async function testRLS() {
  console.log('=== TESTING PRODUCTS RLS ===');
  
  // 1. Admin Client Read
  try {
    const { data: adminData, error: adminErr } = await adminClient.from('products').select('id, name, is_published');
    if (adminErr) {
      console.error('Admin Client Read failed:', adminErr.message);
    } else {
      console.log(`Admin Client Read Succeeded. Row count = ${adminData.length}`);
      if (adminData.length > 0) {
        console.log('Sample admin records:', adminData.slice(0, 3));
      }
    }
  } catch (err) {
    console.error('Admin Client exception:', err.message);
  }

  // 2. Public Client Read
  try {
    const { data: publicData, error: publicErr } = await publicClient.from('products').select('id, name, is_published');
    if (publicErr) {
      console.error('Public Client Read failed:', publicErr.message);
    } else {
      console.log(`Public Client Read Succeeded. Row count = ${publicData.length}`);
      if (publicData.length > 0) {
        console.log('Sample public records:', publicData.slice(0, 3));
      }
    }
  } catch (err) {
    console.error('Public Client exception:', err.message);
  }

  console.log('=== TESTING USERS RLS ===');
  // Let's test inserting into users using publicClient to see the exact error
  try {
    const testUid = 'test-firebase-uid-' + Date.now();
    const { data, error } = await publicClient.from('users').insert([{
      id: testUid,
      firebase_uid: testUid,
      email: 'test@example.com',
      role: 'customer'
    }]);
    if (error) {
      console.log('Inserting into users (as anon) failed as expected:', error.message);
    } else {
      console.log('Inserting into users (as anon) succeeded?!:', data);
    }
  } catch (err) {
    console.log('Inserting into users exception:', err.message);
  }
}

testRLS();
