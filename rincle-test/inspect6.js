const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  await page.goto('https://rincle.co.jp/version-5398j', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  // ログイン
  await page.getByRole('button', { name: 'ログイン' }).first().click();
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill('shoki.seino@swooo.net');
  await page.locator('input[type="password"]').fill('karin0921');
  await page.locator('.baTaOwaW').click();
  await page.waitForTimeout(3000);

  // 検索
  await page.locator('select.bubble-element.Dropdown').first().selectOption({ label: '兵庫県' });
  await page.waitForTimeout(500);
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  if (checkboxes.length >= 1) await checkboxes[0].click();
  if (checkboxes.length >= 2) await checkboxes[1].click();
  await page.getByRole('button', { name: '検索する' }).click();
  await page.waitForTimeout(4000);

  // 店舗一覧 → 最初の「店舗詳細へ」をクリック
  await page.getByRole('button', { name: '店舗詳細へ' }).first().click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/shop_page.png' });
  console.log('URL shop page:', page.url());

  // 詳細ページのフォーム要素を確認
  const formEls = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button, input, select').forEach(el => {
      const text = el.textContent?.trim() || '';
      const type = el.getAttribute('type') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      results.push({ tag: el.tagName, type, text: text.substring(0, 50), placeholder });
    });
    return results.filter(r => r.text || r.placeholder);
  });
  console.log('Shop page elements:', JSON.stringify(formEls, null, 2));

  await browser.close();
})();
