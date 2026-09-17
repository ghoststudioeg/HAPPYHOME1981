const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Replace fetchWithCache to allow query constraints
code = code.replace(
  /const snap = await firestore.collection\(collectionName\).get\(\);/,
  `
    let queryRef = firestore.collection(collectionName);
    if (collectionName === 'products') {
      queryRef = queryRef.where('isPublished', '==', true);
    } else if (collectionName === 'categories') {
      queryRef = queryRef.where('visibility', '==', true);
    }
    const snap = await queryRef.get();
  `
);

fs.writeFileSync('server.ts', code);
console.log('server.ts products/categories query patched');
