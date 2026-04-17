const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
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

  // Inspect all SELECT elements
  const selects = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("select")).map((el, i) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      const options = Array.from(el.options).map(o => ({ value: o.value, text: o.text }));
      return {
        index: i,
        class: el.className?.toString().substring(0, 80),
        currentText: el.options[el.selectedIndex]?.text || "",
        visible: r.width > 0 && r.height > 0,
        visibility: s.visibility,
        rect: { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) },
        options: options.slice(0, 10), // first 10 options
        totalOptions: options.length
      };
    });
  });

  console.log("\n=== 全 SELECT 要素 ===");
  selects.forEach(s => console.log(JSON.stringify(s)));

  await page.waitForTimeout(15000);
  await browser.close();
})();
