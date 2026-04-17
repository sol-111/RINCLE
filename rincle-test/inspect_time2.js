const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();
  await page.goto('https://rincle.co.jp/version-5398j', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  // ログイン
  await page.getByRole('button', { name: 'ログイン' }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('input[type="email"]').fill('shoki.seino@swooo.net');
  await page.locator('input[type="password"]').fill('karin0921');
  await page.getByRole('button', { name: 'ログイン' }).last().click();
  await page.getByText('ログアウト').first().waitFor({ state: 'visible', timeout: 10000 });

  // 検索→自転車詳細
  await page.locator('select.bubble-element.Dropdown').first().selectOption({ label: '兵庫県' });
  await page.waitForTimeout(500);
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole('button', { name: '検索する' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '貸出可能な自転車をすべて見る' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '詳細を見る' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(2000);

  // 貸出日を選択（picker__input index=2）
  const pickerInput = page.locator('input.picker__input').nth(2);
  const ariaOwns = await pickerInput.getAttribute('aria-owns');
  const pickerRoot = page.locator(`#${ariaOwns}`);
  await pickerInput.click({ force: true });
  await page.waitForTimeout(600);
  // 3月のまま（今月）なのでそのまま29日クリック
  await pickerRoot.locator('.picker__day--infocus').getByText('29', { exact: true }).click({ force: true });
  await page.waitForTimeout(500);

  // 時間ピッカーをクリックしてUIを確認
  const timeInput = page.locator('input.time_div.picker__input').first();
  const timeAriaOwns = await timeInput.getAttribute('aria-owns');
  console.log('time aria-owns:', timeAriaOwns);
  await timeInput.click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/time_picker.png' });

  // 時間ピッカーのDOM構造を確認
  const timePickerRoot = page.locator(`#${timeAriaOwns}`);
  const timePickerHtml = await timePickerRoot.innerHTML().catch(() => 'not found');
  console.log('time picker HTML:', timePickerHtml.substring(0, 2000));

  await browser.close();
})();
