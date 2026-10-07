const puppeteer = require('puppeteer');

(async () => {
  let emptySrcCount = 0;
  let warningCount = 0;

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: "new"
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    console.log(`[BROWSER ${msg.type()}] ${text}`);
    if (text.includes('An empty string ("") was passed to the')) {
      warningCount++;
    }
    if (text.includes('[IMAGE AUDIT] Empty src found')) {
      emptySrcCount++;
    }
  });

  const url = 'http://localhost:3000';
  
  const checkEmptySrcDOM = async (label) => {
    const count = await page.evaluate(() => document.querySelectorAll('[src=""]').length);
    if (count > 0) {
      console.error(`[${label}] Found ${count} [src=""] elements in DOM.`);
      emptySrcCount += count;
    }
  };

  try {
    console.log('Navigating to Home...');
    await page.goto(url, { waitUntil: 'load' });
    
    // Extract diagnostic info
    const diag = await page.evaluate(() => {
      const el = document.querySelector('.fixed.top-2.left-4');
      return el ? el.innerText : 'Diagnostic overlay not found';
    });
    console.log('--- UI DIAGNOSTIC ---');
    console.log(diag);
    console.log('---------------------');

    await checkEmptySrcDOM('Home');

    console.log('Navigating to Categories...');
    await page.goto(`${url}/categories`, { waitUntil: 'load' });
    await checkEmptySrcDOM('Categories');

    console.log('Navigating to Products...');
    await page.goto(`${url}/products`, { waitUntil: 'load' });
    await checkEmptySrcDOM('Products');

    console.log('Opening first product...');
    const productCards = await page.$$('[aria-label^="منتج:"]');
    if (productCards.length > 0) {
      console.log(`Found ${productCards.length} product cards.`);
      await productCards[0].click();
      await page.waitForTimeout(1000); // Wait for navigation
      await checkEmptySrcDOM('Product Details');
      
      console.log('Hard refreshing product page...');
      await page.reload({ waitUntil: 'networkidle0' });
      await checkEmptySrcDOM('Product Details - After Refresh');

      console.log('Testing color selector...');
      const colorSwatches = await page.$$('button[aria-label^="اختر لون"]'); // 'Choose color' basically
      for (const swatch of colorSwatches) {
        await swatch.click();
        await page.waitForTimeout(200);
        await checkEmptySrcDOM('Product Color Switched');
      }

      console.log('Testing gallery thumbnail clicks...');
      const thumbnails = await page.$$('button img');
      for (const thumb of thumbnails) {
         try {
           const parent = await thumb.evaluateHandle(el => el.parentElement);
           await parent.click();
           await page.waitForTimeout(200);
         } catch(e) {}
      }
      await checkEmptySrcDOM('Product Gallery');
      
      // Fullscreen image modal?
      // Click the main image
      const mainImages = await page.$$('.aspect-square img');
      if (mainImages.length > 0) {
        await mainImages[0].click();
        await page.waitForTimeout(300);
        await checkEmptySrcDOM('Fullscreen Modal');
      }
    } else {
       console.log('No products found on listing page to test.');
    }

    console.log('Navigating to Admin Homepage...');
    await page.goto(`${url}/admin/home`, { waitUntil: 'networkidle0' });
    await checkEmptySrcDOM('Admin Homepage');

    console.log('Navigating to Admin Products...');
    await page.goto(`${url}/admin/products`, { waitUntil: 'networkidle0' });
    await checkEmptySrcDOM('Admin Products');

    console.log(`\nTEST RESULTS:`);
    console.log(`Screens Tested: Home, Categories, Product Listing, Product Details, Admin Products, Admin Homepage, Color Swapping, Fullscreen modal.`);
    console.log(`React Warning Count: ${warningCount}`);
    console.log(`DOM Empty Src Elements: ${emptySrcCount}`);

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
})();
