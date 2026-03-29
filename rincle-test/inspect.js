const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://rincle.co.jp/version-test', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);

  // ログイン関連要素を探す
  const loginEls = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a, button, [role="button"], [role="link"]').forEach(el => {
      const text = el.textContent?.trim();
      const href = el.getAttribute('href') || '';
      const cls = el.className || '';
      if (text && (text.includes('ログイン') || text.includes('login') || text.includes('Login') || href.includes('login'))) {
        results.push({ tag: el.tagName, text, href, cls: cls.toString().substring(0, 100) });
      }
    });
    return results;
  });
  console.log('=== ログイン要素 ===');
  console.log(JSON.stringify(loginEls, null, 2));

  // フォーム要素を探す
  const formEls = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('input, select, textarea').forEach(el => {
      results.push({
        tag: el.tagName,
        type: el.getAttribute('type'),
        name: el.getAttribute('name'),
        placeholder: el.getAttribute('placeholder'),
        id: el.id,
        cls: (el.className || '').toString().substring(0, 100)
      });
    });
    return results;
  });
  console.log('\n=== フォーム要素 ===');
  console.log(JSON.stringify(formEls, null, 2));

  await browser.close();
})();
