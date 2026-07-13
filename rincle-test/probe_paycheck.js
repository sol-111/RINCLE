const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');
dotenv.config({ path: '/Users/shoki.seino/Documents/rincle/rincle-test/.env' });
const BASE = 'https://rincle.co.jp/version-13fge';
const AREA = process.env.RINCLE_AREA;

async function freshen(page) {
  const stale = await page.getByText('アプリが更新されました').first().isVisible().catch(() => false);
  if (stale) { console.log('!! stale banner -> reload'); await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {}); await page.waitForTimeout(3000); }
}
async function login(page) {
  for (let a = 0; a < 3; a++) {
    await page.goto(BASE + '/signin', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(3000);
    await freshen(page);
    await page.locator('input[type="email"]').first().fill(process.env.RINCLE_EMAIL);
    await page.locator('input[type="password"]').first().fill(process.env.RINCLE_PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).first().click();
    await page.waitForTimeout(5000);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
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
function payState() {
  // 支払い方法グループのチェック状態を可視化する
  const groups = [];
  document.querySelectorAll('.clickable-element').forEach(g => {
    const t = (g.textContent || '').trim();
    if ((t === 'オンライン決済' || t === '店頭決済') && g.getBoundingClientRect().width > 0) {
      const img = g.querySelector('img');
      const ion = g.querySelector('ion-icon, .material-icons, [class*=icon]');
      groups.push({ t, imgSrc: img ? img.src.slice(-60) : null, iconTxt: ion ? (ion.textContent || ion.getAttribute('name') || ion.className).slice(0, 40) : null, html: g.innerHTML.slice(0, 250) });
    }
  });
  const cardBtn = Array.from(document.querySelectorAll('button')).some(b => (b.textContent || '').includes('カード情報を入力する') && b.getBoundingClientRect().width > 0);
  return { groups, cardBtnVisible: cardBtn };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
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
  await page.getByRole('button', { name: 'お客様情報の入力へ' }).click();
  await page.waitForTimeout(4000);
  await page.getByText('アプリの登録者と同じ').first().click();
  await page.waitForTimeout(2000);
  await page.getByText('上記の利用規約に同意する').first().click();
  await page.waitForTimeout(400);
  await page.getByText('身分証明書を持参することに同意する', { exact: false }).first().click();
  await page.waitForTimeout(400);
  await page.getByText('親権者または18歳以上の方が同伴すること', { exact: false }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '予約内容の確認に進む' }).click();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: '支払い方法を選択する' }).click();

  // 直後・1秒ごとに状態を観察（デフォルト選択ワークフローのタイミングを見る）
  for (let s = 0; s <= 6; s += 2) {
    console.log(`t=${s}s:`, JSON.stringify(await page.evaluate(payState)));
    await page.waitForTimeout(2000);
  }

  console.log('--- click 店頭決済 ---');
  await page.getByText('店頭決済', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  console.log('after click:', JSON.stringify(await page.evaluate(payState)));
  await page.waitForTimeout(2000);
  console.log('after +2s :', JSON.stringify(await page.evaluate(payState)));
  await browser.close();
})();
