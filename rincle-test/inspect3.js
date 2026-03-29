const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  await page.goto('https://rincle.co.jp/version-test', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  // ログインボタンクリック
  await page.getByRole('button', { name: 'ログイン' }).first().click();
  await page.waitForTimeout(2000);

  // メール・パスワード入力
  await page.locator('input[type="email"]').fill('shoki.seino@swooo.net');
  await page.locator('input[type="password"]').fill('karin0921');
  await page.screenshot({ path: '/tmp/before_login_submit.png' });

  // ログインボタン（ポップアップ内の2つ目）クリック
  await page.locator('.baTaOwaW').click();
  await page.waitForTimeout(4000);

  await page.screenshot({ path: '/tmp/after_login.png' });
  console.log('URL after login:', page.url());

  // ログイン後のボタン類を確認
  const btns = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button, a').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 30) {
        results.push({ tag: el.tagName, text, cls: (el.className || '').toString().substring(0, 80) });
      }
    });
    return [...new Map(results.map(r => [r.text, r])).values()];
  });
  console.log(JSON.stringify(btns, null, 2));

  await browser.close();
})();
