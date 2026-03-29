const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();

  const BASE_URL = "https://rincle.co.jp/version-test";
  const EMAIL = process.env.RINCLE_EMAIL;
  const PASSWORD = process.env.RINCLE_PASSWORD;
  const AREA = process.env.RINCLE_AREA;

  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // Login
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });
  console.log("✅ ログイン完了");

  // Search
  await page.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
  await page.waitForTimeout(500);
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole("button", { name: "検索する" }).click();
  await page.waitForLoadState("networkidle");

  // Bike detail
  await page.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "詳細を見る" }).first().click();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1500);
  console.log("✅ 詳細ページ");

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
    // Close picker by pressing Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  async function selectTime(timeInputIndex, time) {
    const input = page.locator("input.time_div.picker__input").nth(timeInputIndex);
    const ariaOwns = await input.getAttribute("aria-owns");
    const root = page.locator(`#${ariaOwns}`);
    await input.click({ force: true });
    await page.waitForTimeout(500);
    await root.locator(`[aria-label="${time}"]`).click({ force: true });
    await page.waitForTimeout(300);
    // Close picker by pressing Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  await selectDate(2, 3, 29, 2026);
  console.log("✅ 貸出日選択");
  await selectDate(5, 3, 29, 2026);
  console.log("✅ 返却日選択");
  await selectTime(0, "11:00");
  console.log("✅ 貸出時間選択");
  await selectTime(1, "19:00");
  console.log("✅ 返却時間選択");

  // Close any remaining open pickers
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  // Click somewhere neutral to close pickers
  await page.evaluate(() => document.body.click());
  await page.waitForTimeout(1000);

  // Scroll to reveal booking form
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(800);
  await page.screenshot({ path: "screenshots/debug2_after_close.png" });

  // Check button state
  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).map(b => {
      const r = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      return {
        text: b.textContent?.trim(),
        visible: r.width > 0 && r.height > 0,
        visibility: style.visibility,
        display: style.display,
        rect: { w: Math.round(r.width), h: Math.round(r.height) }
      };
    }).filter(b => b.text && (b.text.includes("予約") || b.text.includes("料金") || b.text.includes("確認")))
  );
  console.log("=== 予約/料金/確認 ボタン ===");
  btns.forEach(b => console.log(JSON.stringify(b)));

  // Check picker state
  const openPickers = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".picker__holder")).map(el => {
      const s = window.getComputedStyle(el);
      return { class: el.className, display: s.display, visibility: s.visibility };
    })
  );
  console.log("\n=== Picker状態 ===");
  openPickers.forEach(p => console.log(JSON.stringify(p)));

  // Try force-clicking 予約する
  console.log("\n→ 予約するボタンを force: true でクリック試み...");
  try {
    await page.getByRole("button", { name: "予約する" }).last().click({ force: true, timeout: 5000 });
    console.log("✅ クリック成功");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "screenshots/debug2_after_click.png" });

    // Check what happened
    const btns2 = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter(b => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map(b => b.textContent?.trim())
        .filter(Boolean)
    );
    console.log("クリック後のボタン:", btns2);
  } catch (e) {
    console.log("❌ クリック失敗:", e.message);
  }

  await page.waitForTimeout(20000);
  await browser.close();
})();
