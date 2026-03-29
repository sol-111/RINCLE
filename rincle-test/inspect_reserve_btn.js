const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
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
  console.log("✅ 検索完了");

  // Bike detail
  await page.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "詳細を見る" }).first().click();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1500);
  console.log("✅ 詳細ページ");

  // Select date/time using Pikaday
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
  }

  async function selectTime(timeInputIndex, time) {
    const input = page.locator("input.time_div.picker__input").nth(timeInputIndex);
    const ariaOwns = await input.getAttribute("aria-owns");
    const root = page.locator(`#${ariaOwns}`);
    await input.click({ force: true });
    await page.waitForTimeout(500);
    await root.locator(`[aria-label="${time}"]`).click({ force: true });
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

  await page.waitForTimeout(1000);

  // Scroll down and inspect page
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/debug_after_datetime.png" });

  // Check all buttons
  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).map(b => {
      const r = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      return {
        text: b.textContent?.trim(),
        visible: r.width > 0 && r.height > 0,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }
      };
    }).filter(b => b.text)
  );
  console.log("\n=== 予約するボタン一覧 ===");
  btns.filter(b => b.text.includes("予約")).forEach(b => console.log(JSON.stringify(b)));

  console.log("\n=== 料金関連ボタン一覧 ===");
  btns.filter(b => b.text.includes("料金") || b.text.includes("確認")).forEach(b => console.log(JSON.stringify(b)));

  console.log("\n=== 全ボタン (visible のみ) ===");
  btns.filter(b => b.visible).forEach(b => console.log(JSON.stringify(b)));

  // Check for any text mentioning 料金/price after datetime selection
  const priceText = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    return all
      .filter(el => el.children.length === 0 && el.textContent?.match(/料金|円|¥|price/i))
      .map(el => el.textContent?.trim())
      .filter(t => t && t.length < 100)
      .slice(0, 20);
  });
  console.log("\n=== 料金テキスト ===", priceText);

  await page.waitForTimeout(30000); // Keep open for manual inspection
  await browser.close();
})();
