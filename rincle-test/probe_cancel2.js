const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');
dotenv.config({ path: '/Users/shoki.seino/Documents/rincle/rincle-test/.env' });
const BASE = 'https://rincle.co.jp/version-13fge';

async function freshen(page) {
  const stale = await page.getByText('アプリが更新されました').first().isVisible().catch(() => false);
  if (stale) { console.log('!! stale banner -> reload'); await page.reload({ waitUntil: 'networkidle', timeout: 40000 }).catch(() => {}); await page.waitForTimeout(3000); }
}
async function login(page) {
  for (let a = 0; a < 3; a++) {
    await page.goto(BASE + '/signin', { waitUntil: 'networkidle', timeout: 40000 });
    await page.waitForTimeout(3000);
    await freshen(page);
    await page.locator('input[type="email"]').first().fill(process.env.RINCLE_EMAIL);
    await page.locator('input[type="password"]').first().fill(process.env.RINCLE_PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).first().click();
    await page.waitForTimeout(5000);
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 40000 });
    const ok = await page.getByText('ログアウト').first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (ok) return;
    console.log('login retry', a + 1);
  }
  throw new Error('login failed');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('NAV ->', f.url()); });
  page.on('dialog', async d => { console.log('DIALOG:', d.type(), d.message().slice(0, 80)); await d.accept(); });
  await login(page);
  await page.getByRole('button', { name: '予約の確認・キャンセル' }).first().click();
  await page.waitForTimeout(6000);
  await freshen(page);
  console.log('URL:', page.url());

  // 各キャンセルボタンの状態と、属する予約カードの日付を対応付け
  const info = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').trim() === '予約をキャンセルする');
    return btns.map((b, i) => {
      // 祖先をさかのぼって「予約番号」を含むカードを特定
      let card = b.parentElement;
      while (card && !(card.textContent || '').includes('予約番号')) card = card.parentElement;
      const cardText = (card?.textContent || '');
      const num = cardText.match(/予約番号[^0-9]*([0-9]{6,})/)?.[1];
      const date = cardText.match(/(\d{4}年\d{2}月\d{2}日)/)?.[1];
      const st = getComputedStyle(b);
      return { i, num, date, disabledAttr: b.disabled, cls: b.className.slice(0, 60), opacity: st.opacity, pointerEvents: st.pointerEvents, bg: st.backgroundColor };
    });
  });
  console.log(JSON.stringify(info, null, 1));

  // 2026年07月20日 の予約（probeで作成したもの）のキャンセルボタンをクリック
  const target = info.find(x => x.date === '2026年07月20日');
  if (!target) { console.log('!! 7/20の予約が見つからない'); await browser.close(); return; }
  console.log('cancelling reservation index', target.i, 'num', target.num);
  await page.evaluate((idx) => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').trim() === '予約をキャンセルする');
    btns[idx].scrollIntoView({ behavior: 'instant', block: 'center' });
  }, target.i);
  await page.waitForTimeout(500);
  const btn = page.getByRole('button', { name: '予約をキャンセルする' }).nth(target.i);
  await btn.click();
  await page.waitForTimeout(3000);

  // 確認ポップアップ？
  const popup = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(b => (b.textContent || '').trim()).filter(Boolean);
    const set = new Set();
    document.querySelectorAll('.bubble-element').forEach(el => { const r = el.getBoundingClientRect(); const t = (el.textContent || '').trim(); if (r.width > 0 && r.height > 0 && t && t.length < 45 && el.children.length === 0) set.add(t); });
    return { btns: btns.slice(0, 15), texts: Array.from(set).slice(0, 30) };
  });
  console.log('after cancel click:', JSON.stringify(popup, null, 1));
  await page.screenshot({ path: '/tmp/cancel_popup.png', fullPage: false });

  // 確認ボタンがあれば押す
  for (const name of ['予約をキャンセルする', 'はい', 'OK', 'キャンセルする']) {
    const cb = page.locator('.bubble-element.Popup button, [class*=Popup] button').filter({ hasText: name }).first();
    if (await cb.isVisible().catch(() => false)) { console.log('confirm via popup button:', name); await cb.click(); await page.waitForTimeout(4000); break; }
  }
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => {
    const cards = document.body.innerText.match(/2026年07月20日/g)?.length || 0;
    const cnt = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').trim() === '予約をキャンセルする').length;
    return { still720: cards, cancelBtns: cnt };
  });
  console.log('after confirm:', JSON.stringify(after));
  await page.screenshot({ path: '/tmp/cancel_after.png', fullPage: true });
  await browser.close();
})();
