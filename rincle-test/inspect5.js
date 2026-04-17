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

  // エリア選択 → 日付未定 → 検索
  await page.locator('select.bubble-element.Dropdown').first().selectOption({ label: '兵庫県' });
  await page.waitForTimeout(500);
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  if (checkboxes.length >= 1) await checkboxes[0].click();
  if (checkboxes.length >= 2) await checkboxes[1].click();
  await page.getByRole('button', { name: '検索する' }).click();
  await page.waitForTimeout(4000);

  // 検索結果ページでスクロール → 店舗カード確認
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/search_results.png' });

  // 店舗名テキストを取得
  const shopTexts = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a, .bubble-element').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.includes('RINCLE') || text?.includes('店')) {
        results.push(text.substring(0, 60));
      }
    });
    return [...new Set(results)].slice(0, 10);
  });
  console.log('Shop texts:', shopTexts);

  // 最初の「貸出可能な自転車をすべて見る」ボタンをクリック
  await page.getByRole('button', { name: '貸出可能な自転車をすべて見る' }).first().click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/shop_detail.png' });
  console.log('URL after shop click:', page.url());

  // 店舗詳細のフォーム要素
  const detailEls = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button, input, select').forEach(el => {
      const text = el.textContent?.trim() || '';
      const type = el.getAttribute('type') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      results.push({ tag: el.tagName, type, text: text.substring(0, 40), placeholder });
    });
    return results.filter(r => r.text || r.placeholder);
  });
  console.log('Shop detail elements:', JSON.stringify(detailEls, null, 2));

  await browser.close();
})();
