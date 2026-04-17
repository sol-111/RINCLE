const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();
  await page.goto('https://rincle.co.jp/version-5398j', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // ログイン
  await page.getByRole('button', { name: 'ログイン' }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('input[type="email"]').fill('shoki.seino@swooo.net');
  await page.locator('input[type="email"]').fill('shoki.seino@swooo.net');
  await page.locator('input[type="password"]').fill('karin0921');
  await page.getByRole('button', { name: 'ログイン' }).last().click();
  await page.getByText('ログアウト').first().waitFor({ state: 'visible', timeout: 10000 });

  // 検索→自転車詳細
  await page.locator('select.bubble-element.Dropdown').first().selectOption({ label: '兵庫県' });
  await page.waitForTimeout(400);
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole('button', { name: '検索する' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '貸出可能な自転車をすべて見る' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '詳細を見る' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1500);

  // 日付選択（貸出日）
  const picker2 = page.locator('input.picker__input').nth(2);
  const owns2 = await picker2.getAttribute('aria-owns');
  await picker2.click({ force: true });
  await page.waitForTimeout(600);
  await page.locator(`#${owns2} .picker__day--infocus`).getByText('29', { exact: true }).click({ force: true });
  await page.waitForTimeout(500);

  // 日付選択（返却日）
  const picker3 = page.locator('input.picker__input').nth(3);
  const owns3 = await picker3.getAttribute('aria-owns');
  await picker3.click({ force: true });
  await page.waitForTimeout(600);
  await page.locator(`#${owns3} .picker__day--infocus`).getByText('29', { exact: true }).click({ force: true });
  await page.waitForTimeout(500);

  // 時間選択
  const time0 = page.locator('input.time_div.picker__input').nth(0);
  const owns_t0 = await time0.getAttribute('aria-owns');
  await time0.click({ force: true });
  await page.waitForTimeout(400);
  await page.locator(`#${owns_t0} [aria-label="11:00"]`).click({ force: true });
  await page.waitForTimeout(300);

  const time1 = page.locator('input.time_div.picker__input').nth(1);
  const owns_t1 = await time1.getAttribute('aria-owns');
  await time1.click({ force: true });
  await page.waitForTimeout(400);
  await page.locator(`#${owns_t1} [aria-label="19:00"]`).click({ force: true });
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/after_datetime.png' });

  // 全テキスト要素でクリック可能なものを探す
  const clickables = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('[class*="clickable"], button, a').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 50) {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        results.push({ tag: el.tagName, text, visible, cls: (el.className||'').toString().substring(0, 60) });
      }
    });
    return [...new Map(results.map(r => [r.text, r])).values()];
  });
  console.log('クリック可能要素:', JSON.stringify(clickables, null, 2));

  await browser.close();
})();
