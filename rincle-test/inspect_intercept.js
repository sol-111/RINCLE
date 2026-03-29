const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  const workflowReqs = [];
  page.on("request", req => {
    if (req.url().includes("workflow")) workflowReqs.push({ method: req.method(), body: req.postData() });
  });
  page.on("response", async res => {
    if (res.url().includes("workflow")) {
      const body = await res.text().catch(() => "");
      const last = workflowReqs[workflowReqs.length - 1];
      if (last) last.response = body.substring(0, 500);
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
  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(1000);
  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(2000);
  workflowReqs.length = 0;

  // Intercept run_element_workflow and log instance data
  const interceptResult = await page.evaluate(() => {
    // Find run_element_workflow in the global scope
    // In minified Bubble, it might be under a different name
    // Let's patch the jQuery click handler to intercept instance2
    
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (!btn) return { error: "button not found" };
    const clickable = btn.closest(".clickable-element");
    if (!clickable) return { error: "clickable not found" };

    const events = window.jQuery._data(clickable, "events");
    if (!events?.click?.[0]) return { error: "no click handler" };

    const origHandler = events.click[0].handler;
    
    // Patch: intercept by replacing the handler temporarily
    const interceptLog = [];
    events.click[0].handler = function(e) {
      interceptLog.push("handler called");
      
      // Get instance2 from closure by toString inspection
      const src = origHandler.toString();
      interceptLog.push("src contains instance2: " + src.includes("instance2"));
      interceptLog.push("src snippet: " + src.substring(0, 200));
      
      // Try to get global run_element_workflow
      const globalKeys = Object.keys(window).filter(k => k.includes("workflow") || k.includes("Workflow"));
      interceptLog.push("global wf keys: " + globalKeys.slice(0, 5).join(", "));
      
      // Call original
      return origHandler.call(this, e);
    };
    
    // Trigger
    const e = window.jQuery.Event("click");
    e.target = clickable;
    e.currentTarget = clickable;
    events.click[0].handler.call(clickable, e);
    
    // Restore
    events.click[0].handler = origHandler;
    
    return interceptLog;
  });
  console.log("=== Intercept result ===");
  console.log(JSON.stringify(interceptResult, null, 2));
  await page.waitForTimeout(2000);
  console.log("workflow reqs:", workflowReqs.length);

  // Try to find the element instance through DOM inspection
  const instanceInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (!btn) return null;
    const clickable = btn.closest(".clickable-element");
    
    // Check jQuery data store for the element
    const data = window.jQuery._data(clickable);
    const keys = data ? Object.keys(data) : [];
    
    // Also check $._data(clickable, "events") for all event details
    const events = window.jQuery._data(clickable, "events");
    
    return {
      jqueryDataKeys: keys,
      eventTypes: events ? Object.keys(events) : [],
      // Check if element has bubbleInstance property
      hasBubbleInstance: "bubbleInstance" in (clickable || {}),
      // Check all own properties
      ownProps: Object.getOwnPropertyNames(clickable || {}).filter(k => !["0","1","2"].includes(k)).slice(0, 20)
    };
  });
  console.log("\n=== Element instance info ===");
  console.log(JSON.stringify(instanceInfo, null, 2));

  // Try the working button "詳細を見る" to compare
  const workingBtnInfo = await page.evaluate(() => {
    // After 詳細を見る was already clicked, find another one if available
    // Instead, look at any OTHER clickable button that works, to compare
    const allClickable = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
      const s = window.getComputedStyle(el);
      return s.opacity === "1" && s.cursor !== "default";
    });
    
    return allClickable.slice(0, 3).map(el => ({
      text: el.textContent?.trim().substring(0, 30),
      opacity: window.getComputedStyle(el).opacity,
      cursor: window.getComputedStyle(el).cursor,
      style: el.getAttribute("style")?.substring(0, 60),
      jqueryDataKeys: Object.keys(window.jQuery._data(el) || {})
    }));
  });
  console.log("\n=== 動作するclickable elements ===");
  console.log(JSON.stringify(workingBtnInfo, null, 2));

  await page.screenshot({ path: "screenshots/debug_intercept.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
