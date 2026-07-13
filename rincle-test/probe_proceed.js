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
    console.log('login attempt', a + 1, 'failed; retrying');
  }
  throw new Error('login failed after retries');
}
async function gotoDetail(page) {
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
  console.log(`picker[${idx}] value = "${await inp.inputValue()}"`);
}

function proceedState() {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent?.trim() === '予約画面へ進む');
  if (!b) return 'no-button';
  const r = b.getBoundingClientRect();
  const clickable = b.closest('.clickable-element');
  const inst = clickable?.bubble_data?.bubble_instance;
  let pre = null;
  try { pre = inst?.element?.get_precomputed?.(); } catch (e) { pre = 'err:' + e.message; }
  const events = window.jQuery?._data?.(clickable, 'events');
  return {
    vis: r.width > 0 && r.height > 0,
    top: Math.round(r.top),
    btnCls: b.className.slice(0, 80),
    parentCls: clickable?.className.slice(0, 80),
    hasInst: !!inst,
    button_disabled: pre && typeof pre === 'object' ? pre.button_disabled : String(pre),
    clickHandlers: events?.click?.length || 0,
    parentStyleDisplay: clickable ? getComputedStyle(clickable).display : null,
    parentStyleVisibility: clickable ? getComputedStyle(clickable).visibility : null,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('NAV ->', f.url()); });
  page.on('console', m => { const t = m.text(); if (/error|Error|workflow/i.test(t) && !/favicon/.test(t)) console.log('PAGE-CONSOLE:', t.slice(0, 150)); });
  await login(page);
  await gotoDetail(page);
  console.log('detail url:', page.url());

  console.log('--- proceed state BEFORE input ---');
  console.log(JSON.stringify(await page.evaluate(proceedState), null, 1));

  await selectPikadayDate(page, 0, 7, 20, 2026);
  await selectPikadayDate(page, 3, 7, 21, 2026);
  await page.locator('select.bubble-element.Dropdown').nth(0).selectOption({ label: '10:00' });
  await page.waitForTimeout(800);
  await page.locator('select.bubble-element.Dropdown').nth(1).selectOption({ label: '11:00' });
  await page.waitForTimeout(1500);

  console.log('--- proceed state AFTER input ---');
  console.log(JSON.stringify(await page.evaluate(proceedState), null, 1));

  // dump any other form controls that might be required (size, quantity etc.)
  const others = await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll('select')).map((s, i) => ({ i, vis: s.getBoundingClientRect().width > 0, val: s.value?.slice(0, 20), opts: Array.from(s.options).map(o => o.label).slice(0, 5) }));
    const radios = Array.from(document.querySelectorAll('input[type=radio]')).length;
    const cbs = Array.from(document.querySelectorAll('input[type=checkbox]')).map((c, i) => ({ i, vis: c.getBoundingClientRect().width > 0, checked: c.checked, near: (c.closest('.bubble-element')?.textContent || '').trim().slice(0, 25) }));
    return { sels, radios, cbs };
  });
  console.log('other controls:', JSON.stringify(others, null, 1));

  // screenshot before click
  await page.screenshot({ path: '/tmp/before_proceed.png', fullPage: true });

  // try normal playwright click first if visible
  const st = await page.evaluate(proceedState);
  if (st.vis) {
    console.log('--- trying normal click ---');
    await page.getByRole('button', { name: '予約画面へ進む' }).click().catch(e => console.log('normal click err:', e.message.slice(0, 80)));
    await page.waitForTimeout(6000);
    console.log('url after normal click:', page.url());
  }
  if (!page.url().includes('/reservation')) {
    console.log('--- trying bubble handler click ---');
    const ok = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent?.trim() === '予約画面へ進む');
      if (!b) return 'no-btn';
      b.scrollIntoView({ behavior: 'instant', block: 'center' });
      const clickable = b.closest('.clickable-element');
      const inst = clickable?.bubble_data?.bubble_instance;
      if (inst?.element?.get_precomputed) {
        const orig = inst.element.get_precomputed.bind(inst.element);
        inst.element.get_precomputed = () => { const p = orig(); if (p) p.button_disabled = false; return p; };
      }
      const events = window.jQuery?._data?.(clickable, 'events');
      const h = events?.click?.[0]?.handler;
      if (h) { const e = window.jQuery.Event('click'); e.target = b; e.currentTarget = clickable; h.call(clickable, e); return 'handler-fired'; }
      b.click(); return 'native-click';
    });
    console.log('bubble click result:', ok);
    await page.waitForTimeout(8000);
    console.log('url after bubble click:', page.url());
  }
  await page.screenshot({ path: '/tmp/after_proceed.png', fullPage: true });
  await browser.close();
})();
