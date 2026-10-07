const http = require('http');

http.get('http://localhost:3000/api/cache/products', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('Is Array:', Array.isArray(json));
      if (Array.isArray(json)) {
        console.log('Product Count returned:', json.length);
        if (json.length > 0) {
          console.log('Sample Product Name:', json[0].name);
          console.log('Keys of first product:', Object.keys(json[0]));
        }
      } else {
        console.log('Response body:', data);
      }
    } catch (e) {
      console.log('Failed to parse JSON:', e.message);
      console.log('Raw data:', data);
    }
  });
}).on('error', (err) => {
  console.error('Error hitting local server API:', err.message);
});
