const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  // Monitor console messages and JS errors
  const consoleMessages = [];
  page.on("console", msg => {
    if (msg.type() === "error" || msg.text().includes("bubble") || msg.text().includes("workflow")) {
      consoleMessages.push({ type: msg.type(), text: msg.text().substring(0, 200) });
    }
  });
  page.on("pageerror", err => {
    consoleMessages.push({ type: "pageerror", text: err.message.substring(0, 200) });
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

  // Scroll into view
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(500);

  // Clear previous messages
  consoleMessages.length = 0;

  // Try Playwright native click
  console.log("クリック実行...");
  await page.locator(".clickable-element.bubble-element").filter({ hasText: "予約画面へ進む" }).first().click({ timeout: 5000 }).catch(e => console.log("クリックエラー:", e.message.split("\n")[0]));
  await page.waitForTimeout(3000);

  console.log("\n=== コンソールメッセージ ===");
  consoleMessages.forEach(m => console.log(JSON.stringify(m)));

  // Check if any Bubble event listener is attached
  const eventListeners = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (!btn) return null;

    // Check parent chain for event listeners using getEventListeners (only available in Chrome DevTools)
    // We'll use a workaround by looking for Bubble's internal event registry
    const parent = btn.parentElement;
    return {
      btnHasEvents: typeof btn.onclick !== "undefined" && btn.onclick !== null,
      parentHasEvents: typeof parent?.onclick !== "undefined" && parent?.onclick !== null,
      // Check if Bubble's event system is active
      bubbleExists: typeof window.bubble !== "undefined",
      appExists: typeof window.appClient !== "undefined",
    };
  });
  console.log("\n=== イベントリスナー確認 ===", eventListeners);

  // Try triggering via mouse events
  console.log("\n→ mouse events で試行...");
  const btnRect = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
  });
  if (btnRect) {
    console.log("ボタン位置:", btnRect);
    await page.mouse.move(btnRect.x, btnRect.y);
    await page.waitForTimeout(300);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(3000);
    console.log("URL:", page.url());
    console.log("コンソール:", consoleMessages.map(m => JSON.stringify(m)));
  }

  await page.screenshot({ path: "screenshots/debug_console.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
