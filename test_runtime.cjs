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
    if (text.includes('An empty string ("") was passed to the')) {
      warningCount++;
      console.warn('React Warning:', text);
    }
    if (text.includes('[IMAGE AUDIT] Empty src found')) {
      emptySrcCount++;
      console.error('Audit Error:', text);
    }
    if (msg.type() === 'error') {
      // console.log('Console Error:', text);
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
    await page.goto(url, { waitUntil: 'networkidle0' });
    await checkEmptySrcDOM('Home');

    console.log('Navigating to Categories...');
    await page.goto(`${url}/categories`, { waitUntil: 'networkidle0' });
    await checkEmptySrcDOM('Categories');

    console.log('Navigating to Products...');
    await page.goto(`${url}/products`, { waitUntil: 'networkidle0' });
    await checkEmptySrcDOM('Products');

    // Click on the first product
    console.log('Opening first product...');
    const productLinks = await page.$$('a[href^="/product/"]');
    if (productLinks.length > 0) {
      const prodUrl = await page.evaluate(el => el.href, productLinks[0]);
      await page.goto(prodUrl, { waitUntil: 'networkidle0' });
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
