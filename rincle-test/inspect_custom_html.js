const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text().substring(0, 300)); });
  page.on("pageerror", e => consoleErrors.push("PAGE: " + e.message.substring(0, 300)));

  await page.goto("https://rincle.co.jp/version-test", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible" });
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

  // Get all custom HTML element content
  const customHtml = await page.evaluate(() => {
    // Custom HTML elements in Bubble have class containing 'HTML' or are script tags
    const htmlEls = Array.from(document.querySelectorAll("[class*='HTML']"));
    return htmlEls.map(el => ({
      class: el.className.substring(0, 60),
      innerHTML: el.innerHTML?.substring(0, 500),
      visible: window.getComputedStyle(el).display !== "none"
    }));
  });
  console.log("=== Custom HTML elements ===");
  customHtml.forEach((el, i) => console.log(`[${i}] ${el.class}\n${el.innerHTML}\n`));

  // Look at the pre_run_jquery.js content (loaded by Bubble custom HTML)
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("script")).map(s => ({
      src: s.src?.substring(0, 100),
      content: s.textContent?.substring(0, 200)
    })).filter(s => s.src?.includes("pre_run") || s.content?.includes("return"));
  });
  console.log("=== Pre-run scripts ===");
  scripts.forEach(s => console.log(JSON.stringify(s)));

  console.log("\n=== Console errors ===");
  consoleErrors.forEach(e => console.log(e));

  await page.waitForTimeout(5000);
  await browser.close();
})();
