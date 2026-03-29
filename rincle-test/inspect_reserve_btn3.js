const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();

  const BASE_URL = "https://rincle.co.jp/version-test";

  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(process.env.RINCLE_EMAIL);
  await page.locator('input[type="password"]').fill(process.env.RINCLE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });
  console.log("✅ ログイン");

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
  console.log("✅ 詳細ページ");

  // Picker open count helper
  async function openPickerCount() {
    return page.evaluate(() =>
      Array.from(document.querySelectorAll(".picker__holder")).filter(el =>
        window.getComputedStyle(el).display === "block"
      ).length
    );
  }

  // Close all open pickers by clicking outside
  async function closeAllPickers() {
    // Click on a safe spot (top-left of page body, outside any picker)
    await page.mouse.click(200, 100);
    await page.waitForTimeout(400);
    const remaining = await openPickerCount();
    console.log(`  → remaining open pickers: ${remaining}`);
  }

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
    // Close this picker with the "Close" footer button
    await root.locator(".picker__close").click({ force: true });
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
    // Close with footer button
    await root.locator(".picker__close").click({ force: true });
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

  // Ensure all pickers closed
  await closeAllPickers();
  await page.waitForTimeout(1000);

  const count = await openPickerCount();
  console.log(`open pickers after close: ${count}`);

  // Check 予約する button state
  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).map(b => {
      const r = b.getBoundingClientRect();
      const s = window.getComputedStyle(b);
      return {
        text: b.textContent?.trim(),
        visible: r.width > 0 && r.height > 0,
        visibility: s.visibility,
        display: s.display,
        rect: { w: Math.round(r.width), h: Math.round(r.height) }
      };
    }).filter(b => b.text && (b.text.includes("予約") || b.text.includes("料金") || b.text.includes("確認")))
  );
  console.log("=== 予約/料金/確認 ボタン ===");
  btns.forEach(b => console.log(JSON.stringify(b)));

  // Check input values
  const inputVals = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input.picker__input")).map(el => ({
      class: el.className,
      value: el.value,
      placeholder: el.placeholder,
      disabled: el.disabled
    }))
  );
  console.log("\n=== picker input 値 ===");
  inputVals.forEach((v, i) => console.log(`  [${i}] val="${v.value}" placeholder="${v.placeholder}" disabled=${v.disabled}`));

  await page.screenshot({ path: "screenshots/debug3_state.png" });

  // Try CSS selector force click
  console.log("\n→ CSS セレクターで force クリック試み...");
  try {
    // Use CSS selector to bypass role check
    const reserveBtns = page.locator("button").filter({ hasText: "予約する" });
    const cnt = await reserveBtns.count();
    console.log(`  '予約する' button count: ${cnt}`);
    // Try clicking the last one with force
    await reserveBtns.last().click({ force: true, timeout: 3000 });
    console.log("✅ force クリック成功");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "screenshots/debug3_after_click.png" });

    // What appeared?
    const visible = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
        .map(b => b.textContent?.trim()).filter(Boolean)
    );
    console.log("クリック後の visible ボタン:", visible);
  } catch (e) {
    console.log("❌", e.message.split("\n")[0]);
  }

  await page.waitForTimeout(30000);
  await browser.close();
})();
