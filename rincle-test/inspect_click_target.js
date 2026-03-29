const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const page = await browser.newPage();

  await page.goto("https://rincle.co.jp/version-test", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(process.env.RINCLE_EMAIL);
  await page.locator('input[type="password"]').fill(process.env.RINCLE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });

  await page.locator("select.bubble-element.Dropdown").first().selectOption({ label: process.env.RINCLE_AREA });
  await page.waitForTimeout(500);
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole("button", { name: "検索する" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "詳細を見る" }).first().click();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1500);

  async function selectDate(pickerIndex, month, day, year) {
    const input = page.locator("input.picker__input").nth(pickerIndex);
    const ariaOwns = await input.getAttribute("aria-owns");
    const root = page.locator(`#${ariaOwns}`);
    await input.click({ force: true });
    await page.waitForTimeout(600);
    for (let i = 0; i < 24; i++) {
      const mt = await root.locator(".picker__month").textContent();
      const yt = await root.locator(".picker__year").textContent();
      if (mt?.includes(`${month}月`) && yt?.includes(String(year))) break;
      await root.locator(".picker__nav--next").click();
      await page.waitForTimeout(300);
    }
    await root.locator(".picker__day--infocus").getByText(String(day), { exact: true }).click({ force: true });
    await page.waitForTimeout(400);
    await root.locator(".picker__button--close").click({ force: true });
    await page.waitForTimeout(500);
  }

  await selectDate(2, 4, 5, 2026);
  await selectDate(5, 4, 5, 2026);
  await page.waitForTimeout(500);
  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(500);
  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(1000);

  // Find button and check element at its position
  const btnInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent?.trim() === "予約画面へ進む");
    if (!btn) return { found: false };
    const r = btn.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;

    // Get element at the center of the button
    const topEl = document.elementFromPoint(cx, cy);
    const topElInfo = topEl ? {
      tag: topEl.tagName,
      class: topEl.className?.toString().substring(0, 80),
      text: topEl.textContent?.trim().substring(0, 30),
      isSameAsBtn: topEl === btn
    } : null;

    return {
      found: true,
      btnRect: { x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height) },
      topEl: topElInfo
    };
  });
  console.log("ボタン情報:", JSON.stringify(btnInfo));

  // Check elements stacked at button position
  const stackedElements = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent?.trim() === "予約画面へ進む");
    if (!btn) return [];
    const r = btn.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;

    // Get ALL elements at the point
    const els = document.elementsFromPoint(cx, cy);
    return els.map(el => ({
      tag: el.tagName,
      class: el.className?.toString().substring(0, 60),
      zIndex: window.getComputedStyle(el).zIndex,
      pointerEvents: window.getComputedStyle(el).pointerEvents,
      visibility: window.getComputedStyle(el).visibility,
      display: window.getComputedStyle(el).display
    }));
  });
  console.log("\n=== ボタン位置のスタック要素 ===");
  stackedElements.forEach((el, i) => console.log(`  [${i}] ${JSON.stringify(el)}`));

  // Check current URL
  console.log("\n現在のURL:", page.url());

  // Click and watch URL change
  const urlBefore = page.url();
  await page.getByRole("button", { name: "予約画面へ進む" }).click();

  // Wait for potential navigation
  let urlAfter = page.url();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    urlAfter = page.url();
    if (urlAfter !== urlBefore) {
      console.log(`\n✅ URL変化 (${i*0.5}s): ${urlBefore} → ${urlAfter}`);
      break;
    }
  }
  if (urlAfter === urlBefore) {
    console.log("\n❌ URL変化なし (10s後):", urlAfter);
  }

  await page.screenshot({ path: "screenshots/debug_click_target.png" });

  // Check page after click
  const afterClickBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter(b => {
        const s = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && s.visibility === "visible";
      })
      .map(b => b.textContent?.trim())
      .filter(t => t && !["今日","消去","Close","keyboard_arrow_left","keyboard_arrow_right"].includes(t))
  );
  console.log("クリック後のvisibleボタン:", afterClickBtns);

  await page.waitForTimeout(20000);
  await browser.close();
})();
