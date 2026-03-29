const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
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
  console.log("✅ 詳細ページ");

  // Check picker footer button structure
  const pickerInput = page.locator("input.picker__input").nth(2);
  const ariaOwns = await pickerInput.getAttribute("aria-owns");
  const root = page.locator(`#${ariaOwns}`);
  await pickerInput.click({ force: true });
  await page.waitForTimeout(600);

  // Inspect the footer buttons inside picker
  const footerBtns = await root.evaluate(el => {
    return Array.from(el.querySelectorAll("button, [type=button], .picker__button, .picker__footer *")).map(b => ({
      tag: b.tagName,
      text: b.textContent?.trim(),
      class: b.className
    }));
  });
  console.log("=== ピッカーフッターのボタン ===");
  footerBtns.forEach(b => console.log(JSON.stringify(b)));

  // Close by pressing Escape or clicking outside
  await page.mouse.click(100, 400);
  await page.waitForTimeout(500);

  const openCount = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".picker__holder")).filter(el =>
      window.getComputedStyle(el).display === "block"
    ).length
  );
  console.log(`open pickers after mouse click: ${openCount}`);

  await page.waitForTimeout(15000);
  await browser.close();
})();
