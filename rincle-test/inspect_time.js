const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
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
  const cbs = await page.locator('input[type="checkbox"]').all();
  await cbs[0].check(); await cbs[1].check();
  await page.getByRole('button', { name: '検索する' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '貸出可能な自転車をすべて見る' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '詳細を見る' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // 時間SELECTの選択肢を取得
  const timeSelects = await page.locator('select').all();
  for (let i = 0; i < timeSelects.length; i++) {
    const options = await timeSelects[i].evaluate(el => ({
      text: el.textContent?.trim().substring(0, 50),
      options: Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
    }));
    if (options.text?.includes('時間') || options.options.some(o => o.text.includes(':'))) {
      console.log(`SELECT[${i}]:`, JSON.stringify(options, null, 2));
    }
  }

  // 日付INPUTの確認
  const dateInputs = await page.locator('input[type="text"]').all();
  for (let i = 0; i < dateInputs.length; i++) {
    const ph = await dateInputs[i].getAttribute('placeholder');
    if (ph) console.log(`INPUT[${i}] placeholder: ${ph}`);
  }

  await browser.close();
})();
