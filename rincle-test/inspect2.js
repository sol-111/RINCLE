const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();
  await page.goto('https://rincle.co.jp/version-test', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  // ログインボタンをクリック
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/after_login_click.png' });

  // ポップアップ・フォーム要素を調べる
  const els = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('input, button, [role="button"]').forEach(el => {
      const text = el.textContent?.trim() || '';
      const type = el.getAttribute('type') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      const cls = (el.className || '').toString().substring(0, 100);
      results.push({ tag: el.tagName, type, text: text.substring(0, 50), placeholder, cls });
    });
    return results;
  });
  console.log(JSON.stringify(els, null, 2));

  await browser.close();
})();
