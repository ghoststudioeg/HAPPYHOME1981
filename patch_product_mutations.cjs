const fs = require('fs');
let code = fs.readFileSync('src/lib/data/productService.ts', 'utf-8');

function addCacheClear(codeStr) {
  // We need to inject the fetch clear cache after productsCache = null;
  return codeStr.replace(/productsCache = null;/g, `productsCache = null;
      if (typeof window !== 'undefined') {
        fetch('/api/cache/clear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'products'}) }).catch(()=>{}).finally(() => fetch('/api/cache/clear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'offers'}) }).catch(()=>{}));
      }`);
}

code = addCacheClear(code);
fs.writeFileSync('src/lib/data/productService.ts', code);
console.log('product mutations patched');
