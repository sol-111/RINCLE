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

  // Select dates
  await selectDate(2, 3, 29, 2026);
  console.log("✅ 貸出日選択");
  await selectDate(5, 3, 29, 2026);
  console.log("✅ 返却日選択");
  await page.waitForTimeout(1000);

  // Check available options in SELECT
  const opts = await page.locator("select").nth(3).evaluate(el =>
    Array.from(el.options).map(o => o.text)
  );
  console.log("SELECT 3 options:", opts);
  const opts4 = await page.locator("select").nth(4).evaluate(el =>
    Array.from(el.options).map(o => o.text)
  );
  console.log("SELECT 4 options:", opts4);

  // Check if 19:00 is in the options
  console.log("11:00 in opts:", opts.includes("11:00"));
  console.log("19:00 in opts:", opts.includes("19:00"));

  // Select times using SELECT dropdown (nth 3 = 貸出時間, nth 4 = 返却時間)
  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(500);
  console.log("✅ 貸出時間 11:00 選択");

  // Check 予約する button state after 貸出時間 selection
  const btnState1 = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter(b => b.textContent?.trim() === "予約する")
      .map(b => ({ visibility: window.getComputedStyle(b).visibility }))
  );
  console.log("貸出時間選択後 予約するボタン:", btnState1);

  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(1000);
  console.log("✅ 返却時間 19:00 選択");

  // Check 予約する button state after both times selected
  const btnState2 = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter(b => b.textContent?.trim() === "予約する")
      .map(b => {
        const s = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return { visibility: s.visibility, display: s.display, w: Math.round(r.width), h: Math.round(r.height) };
      })
  );
  console.log("両時刻選択後 予約するボタン:", btnState2);

  await page.screenshot({ path: "screenshots/debug_after_time.png" });

  // Check all visible buttons
  const visibleBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter(b => {
        const s = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && s.visibility === "visible";
      })
      .map(b => b.textContent?.trim())
      .filter(Boolean)
  );
  console.log("visible ボタン一覧:", visibleBtns);

  await page.waitForTimeout(30000);
  await browser.close();
})();
