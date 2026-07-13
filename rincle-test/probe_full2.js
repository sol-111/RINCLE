const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');
dotenv.config({ path: '/Users/shoki.seino/Documents/rincle/rincle-test/.env' });
const BASE = 'https://rincle.co.jp/version-13fge';
const AREA = process.env.RINCLE_AREA;

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
async function selectPikadayDate(page, idx, month, day, year) {
  const inp = page.locator('input.picker__input').nth(idx);
  const ao = await inp.getAttribute('aria-owns');
  const root = page.locator('#' + ao);
  await inp.click({ force: true });
  await page.waitForTimeout(600);
  for (let i = 0; i < 24; i++) {
    const mt = await root.locator('.picker__month').textContent();
    const yt = await root.locator('.picker__year').textContent();
    if (mt?.includes(month + '月') && yt?.includes(String(year))) break;
    await root.locator('.picker__nav--next').click(); await page.waitForTimeout(300);
  }
  await root.locator('.picker__day--infocus').getByText(String(day), { exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  await root.locator('.picker__button--close').click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
}
function dump() {
  const btns = Array.from(document.querySelectorAll('button')).filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(b => (b.textContent || '').trim()).filter(Boolean);
  const set = new Set();
  document.querySelectorAll('.bubble-element').forEach(el => { const r = el.getBoundingClientRect(); const t = (el.textContent || '').trim(); if (r.width > 0 && r.height > 0 && t && t.length < 35 && el.children.length === 0) set.add(t); });
  return { url: location.href, btns, texts: Array.from(set).slice(0, 70) };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('NAV ->', f.url()); });
  await login(page);
  await page.locator('select.bubble-element.Dropdown').first().selectOption({ label: AREA });
  await page.waitForTimeout(600);
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole('button', { name: '検索する' }).click();
  await page.waitForTimeout(5000);
  await page.getByRole('button', { name: '貸出可能な自転車をすべて見る' }).first().click();
  await page.waitForTimeout(5000);
  await page.getByRole('button', { name: '詳細を見る' }).first().click();
  await page.waitForTimeout(5000);
  await freshen(page);
  await page.evaluate(() => window.scrollBy(0, 400));
  await selectPikadayDate(page, 0, 7, 20, 2026);
  await selectPikadayDate(page, 3, 7, 21, 2026);
  await page.locator('select.bubble-element.Dropdown').nth(0).selectOption({ label: '10:00' });
  await page.waitForTimeout(800);
  await page.locator('select.bubble-element.Dropdown').nth(1).selectOption({ label: '11:00' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '予約画面へ進む' }).click();
  await page.waitForURL(/\/reservation/, { timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log('CART:', page.url());
  await freshen(page);
  await page.getByRole('button', { name: 'お客様情報の入力へ' }).click();
  await page.waitForTimeout(4000);

  // ---- customer info step ----
  // 「アプリの登録者と同じ」チェック（アカウント情報からオートフィル）
  const sameLabel = page.getByText('アプリの登録者と同じ').first();
  await sameLabel.click().catch(e => console.log('same-click err', e.message.slice(0, 50)));
  await page.waitForTimeout(2000);
  // input values after autofill (values masked for privacy — report filled/empty only)
  const vals = await page.evaluate(() => Array.from(document.querySelectorAll('input[type=text]')).filter(i => i.getBoundingClientRect().width > 0).map(i => ({ ph: i.placeholder, filled: !!i.value })));
  console.log('after autofill:', JSON.stringify(vals));

  // 同意チェック3つ: クリックはテキストラベルで
  for (const label of ['上記の利用規約に同意する', '身分証明書を持参することに同意する', '親権者または18歳以上の方が同伴すること']) {
    const el = page.getByText(label, { exact: false }).first();
    await el.click().catch(e => console.log('agree click err:', label.slice(0, 12), e.message.slice(0, 40)));
    await page.waitForTimeout(400);
  }
  const cbstate = await page.evaluate(() => Array.from(document.querySelectorAll('input[type=checkbox]')).filter(c => c.getBoundingClientRect().width > 0).map(c => c.checked));
  console.log('checkbox states:', JSON.stringify(cbstate));

  await page.screenshot({ path: '/tmp/step3_filled.png', fullPage: true });
  // 予約内容の確認に進む
  await page.getByRole('button', { name: '予約内容の確認に進む' }).click();
  await page.waitForTimeout(4000);
  console.log('=== confirm step ===');
  console.log(JSON.stringify(await page.evaluate(dump), null, 1));
  await page.screenshot({ path: '/tmp/step4_confirm.png', fullPage: true });

  // ---- payment step ----
  await page.getByRole('button', { name: '支払い方法を選択する' }).click();
  await page.waitForTimeout(4000);
  console.log('=== payment step ===');
  console.log(JSON.stringify(await page.evaluate(dump), null, 1));
  // radios/checkboxes near payment labels
  const payCtl = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('input[type=radio], input[type=checkbox], .clickable-element').forEach(el => {
      const r = el.getBoundingClientRect();
      const t = (el.textContent || '').trim();
      if (r.width > 0 && r.height > 0 && /店頭|カード|クレジット|決済/.test(t) && t.length < 40) out.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 50), t });
    });
    return out;
  });
  console.log('payment controls:', JSON.stringify(payCtl, null, 1));
  await page.screenshot({ path: '/tmp/step5_payment.png', fullPage: true });

  // 店頭決済を選択（実カード決済は禁止）
  await page.getByText('店頭決済', { exact: true }).first().click().catch(e => console.log('tentou click err', e.message.slice(0, 60)));
  await page.waitForTimeout(2000);
  console.log('after selecting 店頭決済:');
  console.log(JSON.stringify(await page.evaluate(dump), null, 1));
  await page.screenshot({ path: '/tmp/step6_tentou.png', fullPage: true });

  // カード入力欄が出ていないか安全確認
  const cardFields = await page.locator('input[autocomplete="cc-number"], input[name*="card" i]').count();
  console.log('visible card fields:', cardFields);

  // 確定ボタンを探してクリック（予約する/確定系）
  const finalBtn = page.getByRole('button', { name: /予約を確定|^予約する$|申込|確定/ }).first();
  if (await finalBtn.isVisible().catch(() => false)) {
    const label = await finalBtn.textContent();
    console.log('clicking final button:', label?.trim());
    await finalBtn.click();
    await page.waitForTimeout(8000);
    console.log('=== after final confirm ===');
    console.log(JSON.stringify(await page.evaluate(dump), null, 1));
    await page.screenshot({ path: '/tmp/step7_done.png', fullPage: true });
    // 予約番号を拾う
    const num = await page.evaluate(() => {
      const m = document.body.innerText.match(/予約番号[^0-9]*([0-9]{6,})/);
      return m ? m[1] : null;
    });
    console.log('予約番号:', num);
  } else {
    console.log('final button not visible — dumping and stopping');
  }
  await browser.close();
})();
