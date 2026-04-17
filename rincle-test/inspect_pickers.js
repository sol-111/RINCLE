const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://rincle.co.jp/version-5398j', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // ログイン
  await page.getByRole('button', { name: 'ログイン' }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 5000 });
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

  // 全 picker__input を調べる
  const pickers = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input.picker__input')).map((el, i) => ({
      index: i,
      cls: el.className,
      placeholder: el.getAttribute('placeholder'),
      value: el.value,
      disabled: el.disabled,
      readonly: el.readOnly,
      ariaOwns: el.getAttribute('aria-owns'),
    }));
  });
  console.log('All picker__inputs:');
  pickers.forEach(p => console.log(JSON.stringify(p)));

  await browser.close();
})();
