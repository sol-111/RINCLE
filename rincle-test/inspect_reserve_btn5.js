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
  console.log("✅ 詳細ページ");

  // How picker__holder is visually open/closed - check more CSS props
  const pickerStyles = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".picker__holder")).map((el, i) => {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        i,
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        overflow: s.overflow,
        height: s.height,
        maxHeight: s.maxHeight,
        clipPath: s.clipPath,
        rect: { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) }
      };
    })
  );
  console.log("=== picker__holder CSS 詳細 ===");
  pickerStyles.forEach(s => console.log(JSON.stringify(s)));

  // Check if there's a picker__holder--opened class
  const holderClasses = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".picker__holder")).map(el => el.className)
  );
  console.log("\n=== picker__holder クラス ===");
  holderClasses.forEach((c, i) => console.log(`[${i}] ${c}`));

  // Try selecting date and check state
  const input = page.locator("input.picker__input").nth(2);
  const ariaOwns = await input.getAttribute("aria-owns");
  const root = page.locator(`#${ariaOwns}`);

  console.log("\n→ 貸出日 picker を開く...");
  await input.click({ force: true });
  await page.waitForTimeout(600);

  const afterOpenStyles = await root.evaluate(el => {
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { display: s.display, visibility: s.visibility, opacity: s.opacity, overflow: s.overflow, height: s.height, rect: { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) } };
  });
  console.log("Open後 picker holder:", afterOpenStyles);

  // Navigate to March 2026 and click 29
  for (let i = 0; i < 24; i++) {
    const mt = await root.locator(".picker__month").textContent();
    const yt = await root.locator(".picker__year").textContent();
    if (mt?.includes("3月") && yt?.includes("2026")) break;
    await root.locator(".picker__nav--next").click();
    await page.waitForTimeout(300);
  }
  await root.locator(".picker__day--infocus").getByText("29", { exact: true }).click({ force: true });
  await page.waitForTimeout(400);

  const afterSelectStyles = await root.evaluate(el => {
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { display: s.display, visibility: s.visibility, opacity: s.opacity, overflow: s.overflow, height: s.height, rect: { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) } };
  });
  console.log("日付選択後 picker holder:", afterSelectStyles);

  // Close with .picker__button--close
  await root.locator(".picker__button--close").click({ force: true });
  await page.waitForTimeout(400);

  const afterCloseStyles = await root.evaluate(el => {
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { display: s.display, visibility: s.visibility, opacity: s.opacity, overflow: s.overflow, height: s.height, rect: { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) } };
  });
  console.log("Close後 picker holder:", afterCloseStyles);

  // Check input value
  const inputVal = await input.inputValue();
  console.log("入力値:", inputVal);

  await page.waitForTimeout(20000);
  await browser.close();
})();
