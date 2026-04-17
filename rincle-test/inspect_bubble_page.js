const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on("console", msg => consoleLogs.push({ type: msg.type(), text: msg.text().substring(0, 400) }));

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
  await page.waitForTimeout(2000);

  // Check Bubble page data
  const bubblePageData = await page.evaluate(() => {
    return {
      page_name: window.bubble_page_name,
      page_load_id: window.bubble_page_load_id,
      version: window.bubble_version,
      is_leanjs: window.bubble_is_leanjs,
      // Try to get page data
      page_load_data: JSON.stringify(window._bubble_page_load_data)?.substring(0, 500),
      // Check for specific Bubble state variables
      session_uid: window.bubble_session_uid,
    };
  });
  console.log("Bubble page data:", JSON.stringify(bubblePageData, null, 2));

  // Check custom HTML elements on the page
  const customHtmlEls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[class*='HTML'], [class*='html'], script")).map(el => ({
      tag: el.tagName,
      class: el.className?.toString().substring(0, 60),
      src: el.getAttribute("src")?.substring(0, 80),
      content: el.textContent?.trim().substring(0, 100)
    })).slice(0, 20);
  });
  console.log("\n=== カスタムHTML要素 ===");
  customHtmlEls.forEach(el => console.log(JSON.stringify(el)));

  // Check if Bubble's workflow registry has the button workflow
  const workflowCheck = await page.evaluate(() => {
    // Try to access Bubble's internal event system
    const clickables = Array.from(document.querySelectorAll(".clickable-element"));
    return clickables.map(el => {
      const r = el.getBoundingClientRect();
      return {
        class: el.className.substring(0, 60),
        text: el.textContent?.trim().substring(0, 30),
        inViewport: r.width > 0 && r.height > 0 && r.y < window.innerHeight,
        y: Math.round(r.y)
      };
    }).filter(el => el.text && el.text.includes("予約画面"));
  });
  console.log("\n=== clickable-element 予約画面 ===");
  workflowCheck.forEach(el => console.log(JSON.stringify(el)));

  // Check for any existing event listeners on the button's parent
  const listenerCheck = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (!btn) return null;
    const parent = btn.closest(".clickable-element");

    // Chrome DevTools API to get event listeners (not available in eval)
    // Instead, check if the parent has any data attributes or Bubble-specific markers
    return {
      btnId: btn.id,
      btnDataAttrs: Array.from(btn.attributes).map(a => `${a.name}=${a.value}`),
      parentId: parent?.id,
      parentDataAttrs: parent ? Array.from(parent.attributes).map(a => `${a.name}=${a.value}`).slice(0, 10) : []
    };
  });
  console.log("\n=== ボタンの属性 ===", JSON.stringify(listenerCheck));

  // Look at ALL console errors
  const errors = consoleLogs.filter(l => l.type === "error");
  console.log("\n=== 全コンソールエラー ===");
  errors.forEach(e => console.log(e.text));

  // Check window after date selection to see if state changes
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
  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(500);
  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(1000);

  // Check if bubble state changed after selections
  const bubbleStateAfter = await page.evaluate(() => {
    return {
      page_name: window.bubble_page_name,
      watcher_cache_size: Object.keys(window._bubble_watcher_cache || {}).length,
    };
  });
  console.log("\nBubble state after selections:", bubbleStateAfter);

  // Look for the button condition checker
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(500);

  // Try clicking and immediately capture response
  consoleLogs.length = 0;
  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  await page.waitForTimeout(2000);
  console.log("\n=== クリック後のコンソール ===");
  consoleLogs.forEach(l => console.log(JSON.stringify(l)));

  await page.screenshot({ path: "screenshots/debug_page.png" });
  await page.waitForTimeout(25000);
  await browser.close();
})();
