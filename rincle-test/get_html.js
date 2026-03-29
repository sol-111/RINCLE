const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://rincle.co.jp/version-test', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  const html = await page.content();
  console.log(html.substring(0, 50000));
  await browser.close();
})();
