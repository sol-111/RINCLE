const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  // Capture full workflow responses
  const workflowData = [];
  page.on("request", req => {
    if (req.url().includes("workflow/start")) {
      workflowData.push({ type: "req", url: req.url(), body: req.postData() });
    }
  });
  page.on("response", async res => {
    if (res.url().includes("workflow/start")) {
      const body = await res.text().catch(() => "");
      workflowData.push({ type: "res", url: res.url(), body: body });
    }
  });

  // Login
  await page.goto("https://rincle.co.jp/version-test", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(process.env.RINCLE_EMAIL);
  await page.locator('input[type="password"]').fill(process.env.RINCLE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });
  console.log("✅ ログイン");

  // Navigate directly to bicycle_detail with dates
  const BICYCLE_ID = "1759034684755x353916196529111040";
  const START_TS = 1775354400000;
  const END_TS = 1775383200000;
  await page.goto(
    `https://rincle.co.jp/version-test/index/bicycle_detail?bicycle_id=${BICYCLE_ID}&startDate2=${START_TS}&endDate2=${END_TS}&change=no`,
    { waitUntil: "networkidle" }
  );
  await page.waitForTimeout(3000);

  // Show the 3rd workflow response (the one with action_condition_failed)
  const wfResponses = workflowData.filter(d => d.type === "res");
  if (wfResponses.length >= 3) {
    console.log("\n=== 3番目のworkflow response ===");
    console.log(wfResponses[2].body.substring(0, 1000));
  }

  // Explore window.app
  const appExplore = await page.evaluate(() => {
    const app = window.app;
    if (!app) return { error: "window.app not found" };
    
    const info = {
      type: typeof app,
      isNull: app === null,
    };
    
    if (typeof app === "object" && app !== null) {
      info.keys = Object.keys(app).slice(0, 30);
      info.protoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(app) || {}).slice(0, 20);
    }
    
    return info;
  });
  console.log("\n=== window.app ===");
  console.log(JSON.stringify(appExplore, null, 2));

  // Look at app's methods more closely
  const appMethods = await page.evaluate(() => {
    const app = window.app;
    if (!app || typeof app !== "object") return null;
    
    const methods = {};
    for (const key of Object.keys(app)) {
      methods[key] = typeof app[key];
    }
    return methods;
  });
  console.log("\n=== window.app プロパティ ===");
  console.log(JSON.stringify(appMethods, null, 2));

  // Check if we can find workflow trigger fn
  const workflowTrigger = await page.evaluate(() => {
    const app = window.app;
    if (!app) return null;
    
    // Try to find trigger/workflow methods
    const triggerKeys = Object.keys(app).filter(k => 
      k.toLowerCase().includes("trigger") ||
      k.toLowerCase().includes("workflow") ||
      k.toLowerCase().includes("action") ||
      k.toLowerCase().includes("event") ||
      k.toLowerCase().includes("click") ||
      k.toLowerCase().includes("element") ||
      k.toLowerCase().includes("state")
    );
    
    return triggerKeys;
  });
  console.log("\n=== workflow関連キー ===", workflowTrigger);

  // Try to get element registry from app
  const elementRegistry = await page.evaluate(() => {
    const app = window.app;
    if (!app) return null;
    
    // Look for element instances registry
    try {
      if (app.elementInstances) {
        const keys = Object.keys(app.elementInstances);
        return { count: keys.length, sampleKeys: keys.slice(0, 10) };
      }
      if (app.elements) {
        const keys = Object.keys(app.elements);
        return { count: keys.length, sampleKeys: keys.slice(0, 10) };
      }
    } catch(e) { return { error: e.message }; }
    
    return null;
  });
  console.log("\n=== element registry ===", elementRegistry);

  // Check the clickable element for the button - get all its attributes
  const clickableEl = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (!btn) return { found: false };
    
    const clickable = btn.closest(".clickable-element");
    if (!clickable) return { found: true, noClickable: true };
    
    return {
      found: true,
      clickableClass: clickable.className,
      allAttrs: Array.from(clickable.attributes).map(a => `${a.name}=${a.value}`),
      bubbleId: clickable.id,
      computedStyle: {
        pointerEvents: window.getComputedStyle(clickable).pointerEvents,
        display: window.getComputedStyle(clickable).display,
        visibility: window.getComputedStyle(clickable).visibility,
        opacity: window.getComputedStyle(clickable).opacity
      }
    };
  });
  console.log("\n=== .clickable-element 属性 ===");
  console.log(JSON.stringify(clickableEl, null, 2));

  // Try using Bubble's internal trigger mechanism
  const triggerResult = await page.evaluate(() => {
    // Try to find Bubble's internal event trigger
    // Bubble uses a special internal system for workflow events
    
    // Check all event listeners using Bubblels internal registry
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (!btn) return "button not found";
    
    const clickable = btn.closest(".clickable-element");
    if (!clickable) return "clickable not found";
    
    // Bubble stores element handlers in the element's __handlers__ or similar
    const internals = [];
    for (const key of Object.getOwnPropertyNames(clickable)) {
      if (key.startsWith("__") || key.startsWith("_")) {
        internals.push(key);
      }
    }
    
    // Check jQuery event data if jQuery is available
    let jqueryEvents = null;
    if (window.jQuery) {
      const $el = window.jQuery(clickable);
      jqueryEvents = $el.data("events") || window.jQuery._data(clickable, "events");
    }
    
    return {
      internals,
      hasJquery: !!window.jQuery,
      jqueryVersion: window.jQuery?.fn?.jquery,
      jqueryEvents: jqueryEvents ? Object.keys(jqueryEvents) : null,
      clickableHref: clickable.getAttribute("href")
    };
  });
  console.log("\n=== jQuery/内部イベント ===");
  console.log(JSON.stringify(triggerResult, null, 2));

  await page.waitForTimeout(20000);
  await browser.close();
})();
