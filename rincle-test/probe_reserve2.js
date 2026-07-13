const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');
dotenv.config({ path: '/Users/shoki.seino/Documents/rincle/rincle-test/.env' });
const BASE = 'https://rincle.co.jp/version-13fge';
const AREA = process.env.RINCLE_AREA;

async function login(page) {
  for (let a = 0; a < 3; a++) {
    await page.goto(BASE + '/signin', { waitUntil: 'networkidle', timeout: 40000 });
    await page.waitForTimeout(3000);
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
  const inputs = Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, vis: i.getBoundingClientRect().width > 0, ph: i.placeholder, ac: i.getAttribute('autocomplete'), name: i.name })).filter(x => x.vis);
  const iframes = Array.from(document.querySelectorAll('iframe')).map(f => (f.src || '').slice(0, 70));
  const set = new Set();
  document.querySelectorAll('.bubble-element').forEach(el => { const r = el.getBoundingClientRect(); const t = (el.textContent || '').trim(); if (r.width > 0 && r.height > 0 && t && t.length < 30 && el.children.length === 0) set.add(t); });
  return { url: location.href, btns, inputs, iframes, texts: Array.from(set).slice(0, 60) };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('NAV ->', f.url()); });
  await login(page);
  // search -> detail
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
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(1500);
  // fill form
  await selectPikadayDate(page, 0, 7, 20, 2026);
  await selectPikadayDate(page, 3, 7, 21, 2026);
  await page.locator('select.bubble-element.Dropdown').nth(0).selectOption({ label: '10:00' });
  await page.waitForTimeout(800);
  await page.locator('select.bubble-element.Dropdown').nth(1).selectOption({ label: '11:00' });
  await page.waitForTimeout(1500);
  // proceed (normal click on now-visible button)
  await page.getByRole('button', { name: '予約画面へ進む' }).click();
  await page.waitForURL(/\/reservation/, { timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log('=== STEP cart ===');
  console.log(JSON.stringify(await page.evaluate(dump), null, 1));

  // お客様情報の入力へ
  await page.getByRole('button', { name: 'お客様情報の入力へ' }).click();
  await page.waitForTimeout(4000);
  console.log('=== STEP customer info ===');
  console.log(JSON.stringify(await page.evaluate(dump), null, 1));
  await page.screenshot({ path: '/tmp/step_customer.png', fullPage: true });

  await browser.close();
})();
