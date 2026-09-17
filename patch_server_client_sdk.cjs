const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Replace the generic fetchWithCache with client SDK logic
const newFetchWithCache = `
import { collection, getDocs, query as fsQuery, where as fsWhere, doc, getDoc } from 'firebase/firestore';
import { db as clientDb } from './src/lib/firebase';

async function fetchWithCache(key, ttl, collectionName) {
  const now = Date.now();
  if (memoryCache[key].data && (now - memoryCache[key].timestamp < ttl)) {
    return memoryCache[key].data;
  }
  
  try {
    let q = collection(clientDb, collectionName);
    if (collectionName === 'products') {
      q = fsQuery(q, fsWhere('isPublished', '==', true));
    } else if (collectionName === 'categories') {
      q = fsQuery(q, fsWhere('visibility', '==', true));
    }
    
    const snap = await getDocs(q);
    let list = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    
    memoryCache[key] = { data: list, timestamp: now };
    return list;
  } catch (error) {
    console.error(\`Error fetching \${collectionName} for cache:\`, error);
    return memoryCache[key].data || [];
  }
}
`;

code = code.replace(/async function fetchWithCache\([\s\S]*?(?=\/\/ 1\. Settings)/, newFetchWithCache + '\n');

// Update Settings cache endpoint
code = code.replace(/const firestore = getFirestoreInstance\(\);\s*const snap = await firestore\.collection\('storeSettings'\)\.doc\('main'\)\.get\(\);/g, 
  `const snap = await getDoc(doc(clientDb, 'storeSettings', 'main'));`);

fs.writeFileSync('server.ts', code);
console.log('server.ts patched to use client SDK');
