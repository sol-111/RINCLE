const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();

  await page.goto("https://rincle.co.jp/version-5398j", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(process.env.RINCLE_EMAIL);
  await page.locator('input[type="password"]').fill(process.env.RINCLE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });
  console.log("✅ ログイン");

  // Navigate to bicycle_detail and fill form first (to set cart data)
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
  console.log("✅ 自転車詳細ページ");

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

  // Get the SELECT timestamps for 11:00 and 19:00
  const startTs = await page.locator("select").nth(3).evaluate(el => {
    const opt = Array.from(el.options).find(o => o.text === "11:00");
    return opt?.value;
  });
  const endTs = await page.locator("select").nth(4).evaluate(el => {
    const opt = Array.from(el.options).find(o => o.text === "19:00");
    return opt?.value;
  });
  console.log("11:00 timestamp:", startTs);
  console.log("19:00 timestamp:", endTs);

  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(500);
  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(1000);
  console.log("✅ 時刻選択");

  // Scroll and try clicking 予約画面へ進む
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(500);

  const urlBefore = page.url();
  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  await page.waitForTimeout(3000);

  let cartUrl;
  if (page.url() !== urlBefore) {
    console.log("✅ 自動遷移:", page.url());
    cartUrl = null; // Already navigated
  } else {
    console.log("⚠️ 自動遷移なし → 直接 cart URL へナビゲート");
    // Navigate directly to cart with the timestamps
    cartUrl = `https://rincle.co.jp/version-5398j/index/cart?startDate2=${startTs}&endDate2=${endTs}&change=no`;
    await page.goto(cartUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    console.log("Cart URL最終:", page.url());
  }

  await page.screenshot({ path: "screenshots/debug_cart.png" });

  // Inspect cart page content
  const cartTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility === "visible" &&
          el.children.length === 0 && el.textContent?.trim().length > 0;
      })
      .map(el => el.textContent?.trim())
      .filter(t => t && t.length > 2 && t.length < 80)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 50)
  );
  console.log("\n=== カートページテキスト ===");
  console.log(cartTexts.join(" | "));

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
  console.log("\n=== visible ボタン ===", visibleBtns);

  await page.waitForTimeout(25000);
  await browser.close();
})();
