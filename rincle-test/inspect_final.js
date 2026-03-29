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
  console.log("✅ 日時入力");

  // Scroll button into view
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(500);

  // Check button position AFTER scroll
  const btnPos = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const cx = Math.round(r.x + r.width / 2);
    const cy = Math.round(r.y + r.height / 2);
    const topEl = document.elementFromPoint(cx, cy);
    const stacked = document.elementsFromPoint(cx, cy);
    return {
      rect: { x: cx, y: cy, w: Math.round(r.width), h: Math.round(r.height) },
      viewportH: window.innerHeight,
      inViewport: cy >= 0 && cy <= window.innerHeight,
      topEl: topEl ? { tag: topEl.tagName, class: topEl.className?.toString().substring(0, 60), isSameAsBtn: topEl === btn } : null,
      stacked: stacked.slice(0, 5).map(el => ({ tag: el.tagName, class: el.className?.toString().substring(0, 40), pe: window.getComputedStyle(el).pointerEvents }))
    };
  });
  console.log("スクロール後のボタン:", JSON.stringify(btnPos, null, 2));

  await page.screenshot({ path: "screenshots/debug_final_before.png" });

  // Try click with waitForNavigation
  console.log("\n→ 予約画面へ進む をクリック (waitForNavigation)...");
  try {
    const [_] = await Promise.all([
      page.waitForNavigation({ timeout: 10000 }).catch(e => console.log("waitForNavigation timeout:", e.message.split("\n")[0])),
      page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          b => b.textContent?.trim() === "予約画面へ進む"
        );
        if (btn) btn.click();
      })
    ]);
    console.log("クリック後URL:", page.url());
  } catch(e) {
    console.log("エラー:", e.message.split("\n")[0]);
  }

  await page.waitForTimeout(3000);
  console.log("3秒後URL:", page.url());
  await page.screenshot({ path: "screenshots/debug_final_after.png" });

  const visibleBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter(b => {
        const s = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && s.visibility === "visible";
      })
      .map(b => b.textContent?.trim())
      .filter(t => t && !["今日","消去","Close","keyboard_arrow_left","keyboard_arrow_right"].includes(t))
  );
  console.log("visible ボタン:", visibleBtns);

  await page.waitForTimeout(30000);
  await browser.close();
})();
