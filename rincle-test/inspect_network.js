const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  // Monitor network requests
  const requests = [];
  page.on("request", req => {
    if (req.url().includes("rincle") || req.url().includes("bubble") || req.url().includes("api/1.1")) {
      requests.push({ method: req.method(), url: req.url().substring(0, 120), time: Date.now() });
    }
  });

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

  // Scroll button into view
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(500);

  requests.length = 0; // Clear previous requests
  console.log("クリック前リクエスト数:", requests.length);

  const urlBefore = page.url();
  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  await page.waitForTimeout(5000);

  console.log("クリック後リクエスト数:", requests.length);
  console.log("URL変化:", page.url() !== urlBefore ? `${urlBefore} → ${page.url()}` : "なし");

  console.log("\n=== クリック後のネットワークリクエスト ===");
  requests.forEach(r => console.log(`  ${r.method} ${r.url}`));

  await page.screenshot({ path: "screenshots/debug_network.png" });

  // Also try Playwright click (not JS click)
  if (page.url() === urlBefore) {
    console.log("\n→ Playwright click() 試み...");
    requests.length = 0;
    await page.locator("button.bubble-element.Button").filter({ hasText: "予約画面へ進む" }).click();
    await page.waitForTimeout(5000);
    console.log("Playwright click後リクエスト数:", requests.length);
    console.log("URL:", page.url());
    requests.forEach(r => console.log(`  ${r.method} ${r.url}`));
  }

  await page.waitForTimeout(20000);
  await browser.close();
})();
