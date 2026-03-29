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

  // Find availability calendar - it's in the main page area (not the booking form picker)
  // Look for calendar cells with availability info
  const calendarCells = await page.evaluate(() => {
    // Bubble calendar / availability grid
    const cells = Array.from(document.querySelectorAll("td, .calendar-cell, [class*='calendar'], [class*='Calendar']"));
    return cells
      .filter(el => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility === "visible";
      })
      .map(el => ({
        tag: el.tagName,
        class: el.className?.toString().substring(0, 80),
        text: el.textContent?.trim().substring(0, 30),
        rect: { y: Math.round(el.getBoundingClientRect().y) }
      }))
      .filter(el => el.text);
  });
  console.log("=== カレンダーセル ===");
  calendarCells.slice(0, 30).forEach(c => console.log(JSON.stringify(c)));

  // Check Pikaday calendar dates in the BOOKING FORM picker (not the availability calendar)
  // Open the 貸出日 picker to see which dates are available
  const input2 = page.locator("input.picker__input").nth(2);
  const ariaOwns2 = await input2.getAttribute("aria-owns");
  const root2 = page.locator(`#${ariaOwns2}`);
  await input2.click({ force: true });
  await page.waitForTimeout(600);

  // Navigate to April 2026
  for (let i = 0; i < 24; i++) {
    const mt = await root2.locator(".picker__month").textContent();
    const yt = await root2.locator(".picker__year").textContent();
    if (mt?.includes("4月") && yt?.includes("2026")) break;
    await root2.locator(".picker__nav--next").click();
    await page.waitForTimeout(300);
  }

  // Check which days are available (not disabled/unavailable)
  const aprilDays = await root2.evaluate(root => {
    return Array.from(root.querySelectorAll(".picker__day")).map(el => ({
      text: el.textContent?.trim(),
      class: el.className,
      disabled: el.getAttribute("aria-disabled") === "true" || el.classList.contains("picker__day--disabled") || el.classList.contains("picker__day--outfocus")
    }));
  });
  console.log("\n=== 4月 Pikaday カレンダー ===");
  aprilDays.forEach(d => {
    const icon = d.disabled ? "❌" : "✅";
    console.log(`  ${icon} ${d.text?.padEnd(3)} ${d.class.substring(0, 60)}`);
  });

  // Find first available day in April
  const availableDay = aprilDays.find(d => !d.disabled && d.text?.match(/^[0-9]+$/));
  console.log("\n最初の空き日:", availableDay?.text);

  await root2.locator(".picker__button--close").click({ force: true });
  await page.waitForTimeout(500);

  // Also check March 2026 for remaining available dates (from today 2026-03-28)
  const input2b = page.locator("input.picker__input").nth(2);
  const ariaOwns2b = await input2b.getAttribute("aria-owns");
  const root2b = page.locator(`#${ariaOwns2b}`);
  await input2b.click({ force: true });
  await page.waitForTimeout(600);

  const marchDays = await root2b.evaluate(root => {
    return Array.from(root.querySelectorAll(".picker__day--infocus")).map(el => ({
      text: el.textContent?.trim(),
      class: el.className,
      disabled: el.getAttribute("aria-disabled") === "true" || el.classList.contains("picker__day--disabled")
    }));
  });
  console.log("\n=== 3月 Pikaday カレンダー (infocus のみ) ===");
  marchDays.forEach(d => {
    const icon = d.disabled ? "❌" : "✅";
    console.log(`  ${icon} ${d.text?.padEnd(3)} ${d.class.substring(0, 80)}`);
  });

  await root2b.locator(".picker__button--close").click({ force: true });

  await page.waitForTimeout(20000);
  await browser.close();
})();
