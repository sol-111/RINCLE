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

  // エリア選択（兵庫県）
  const selects = await page.locator('select.bubble-element.Dropdown').all();
  console.log('Dropdown count:', selects.length);

  // エリアのdropdownに兵庫県があるか確認
  const areaOptions = await page.locator('select.bubble-element.Dropdown').first().evaluate(el => {
    return Array.from(el.options).map(o => ({ value: o.value, text: o.text }));
  });
  console.log('Area options:', JSON.stringify(areaOptions));

  // 兵庫県を選択
  await page.locator('select.bubble-element.Dropdown').first().selectOption({ label: '兵庫県' });
  await page.waitForTimeout(1000);

  // 日付未定チェック
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  console.log('Checkbox count:', checkboxes.length);
  if (checkboxes.length >= 1) await checkboxes[0].click();  // 貸出日 未定
  if (checkboxes.length >= 2) await checkboxes[1].click();  // 返却日 未定
  await page.waitForTimeout(500);

  // 検索する
  await page.getByRole('button', { name: '検索する' }).click();
  await page.waitForTimeout(4000);

  await page.screenshot({ path: '/tmp/after_search.png' });
  console.log('URL after search:', page.url());

  // 検索結果の要素を確認
  const resultBtns = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button, a').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 40) {
        results.push({ tag: el.tagName, text, cls: (el.className || '').toString().substring(0, 80) });
      }
    });
    return [...new Map(results.map(r => [r.text, r])).values()];
  });
  console.log('Buttons/links after search:', JSON.stringify(resultBtns, null, 2));

  await browser.close();
})();
