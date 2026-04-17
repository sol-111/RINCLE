const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
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

  // 検索 → 自転車詳細へ
  await page.locator('select.bubble-element.Dropdown').first().selectOption({ label: '兵庫県' });
  await page.waitForTimeout(500);
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  if (checkboxes.length >= 1) await checkboxes[0].click();
  if (checkboxes.length >= 2) await checkboxes[1].click();
  await page.getByRole('button', { name: '検索する' }).click();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: '貸出可能な自転車をすべて見る' }).first().click();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: '詳細を見る' }).first().click();
  await page.waitForTimeout(4000);

  // 「料金お見積もり」ボタンが表示されてるか確認してクリック
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/bike_detail_bottom.png' });

  // 「料金お見積もり」クリック
  const estimateBtn = page.getByRole('button', { name: /料金お見積もり|見積もり/ });
  if (await estimateBtn.isVisible()) {
    await estimateBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/after_estimate.png' });
    console.log('Clicked 料金お見積もり');
  }

  // 「予約する」ボタンをクリック
  const reserveBtn = page.getByRole('button', { name: '予約する' }).last();
  if (await reserveBtn.isVisible()) {
    await reserveBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/reserve_popup.png' });
    console.log('Clicked 予約する');
  }

  // ポップアップ要素を確認
  const popupEls = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('input, select, button, textarea').forEach(el => {
      const text = el.textContent?.trim() || '';
      const type = el.getAttribute('type') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      results.push({ tag: el.tagName, type, text: text.substring(0, 50), placeholder });
    });
    return results.filter(r => r.text || r.placeholder);
  });
  console.log('Reserve popup elements:', JSON.stringify(popupEls, null, 2));

  await browser.close();
})();
