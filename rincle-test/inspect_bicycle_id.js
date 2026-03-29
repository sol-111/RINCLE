const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  const allRequests = [];
  page.on("request", req => {
    const url = req.url();
    if (url.includes("rincle") || url.includes("bubble") || url.includes("api")) {
      allRequests.push({ url: url.substring(0, 200), method: req.method() });
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

  allRequests.length = 0;
  await page.getByRole("button", { name: "詳細を見る" }).first().click();
  await page.waitForLoadState("networkidle");

  console.log("URL after 詳細を見る:", page.url());
  console.log("Requests during 詳細を見る:");
  allRequests.forEach(r => console.log(" ", r.method, r.url));

  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1500);

  // Find bicycle ID in DOM
  const bikeInfo = await page.evaluate(() => {
    // Look for elements with bicycle-related data attributes
    const allEls = Array.from(document.querySelectorAll("[data-id], [data-bicycle], [class*='bicycle']"));
    
    // Check popup elements
    const popups = Array.from(document.querySelectorAll(".bubble-element.Group, .bubble-element.Popup")).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    // Look for bicycle ID in window._bubble_page_load_data
    const pageData = window._bubble_page_load_data;
    
    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const urlParamsObj = {};
    for (const [k, v] of urlParams) urlParamsObj[k] = v;

    // Look for any element with a long ID that looks like a Bubble ID
    const elementsWithBubbleId = Array.from(document.querySelectorAll("[id]"))
      .filter(el => /^[0-9]+x[0-9]+/.test(el.id))
      .map(el => ({ id: el.id, class: el.className?.toString().substring(0, 60) }))
      .slice(0, 10);

    // Check Bubble's internal state for current Thing
    const bubbleState = window.appClient?.stateData?.data?.getAllElements?.()?.slice(0, 5);

    return {
      urlParams: urlParamsObj,
      urlHash: window.location.hash,
      elementsWithBubbleId,
      popupCount: popups.length,
      popupInfo: popups.slice(0, 3).map(el => ({
        class: el.className?.toString().substring(0, 80),
        dataAttrs: Array.from(el.attributes)
          .filter(a => a.name.startsWith('data-'))
          .map(a => `${a.name}=${a.value}`),
        visible: window.getComputedStyle(el).visibility
      }))
    };
  });
  console.log("\n=== 自転車情報 ===");
  console.log(JSON.stringify(bikeInfo, null, 2));

  // Look for bicycle ID in Bubble's watcher/state system
  const bubbleWatcherInfo = await page.evaluate(() => {
    const cache = window._bubble_watcher_cache || {};
    // Find entries that look like bicycle IDs
    const bicycleKeys = Object.keys(cache).filter(k => 
      k.includes("1759034") || k.includes("bicycle") || k.toLowerCase().includes("bike")
    ).slice(0, 5);
    
    // Also check all state variable keys
    const stateKeys = Object.keys(window).filter(k => 
      k.includes("state") || k.includes("thing") || k.includes("current")
    ).slice(0, 10);

    // Check if there's a current popup element
    const openPopups = Array.from(document.querySelectorAll(".bubble-element.Popup"))
      .filter(el => window.getComputedStyle(el).display !== 'none' && 
                    window.getComputedStyle(el).visibility !== 'hidden' &&
                    window.getComputedStyle(el).opacity !== '0')
      .map(el => el.className?.toString().substring(0, 80));

    return { bicycleKeys, stateKeys, openPopups };
  });
  console.log("\n=== Bubble Watcher Info ===");
  console.log(JSON.stringify(bubbleWatcherInfo, null, 2));

  // Inspect the clickable element for 予約画面へ進む
  const btnDetails = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (!btn) return { found: false };
    
    const clickable = btn.closest(".clickable-element");
    const allParents = [];
    let el = btn.parentElement;
    while (el && allParents.length < 8) {
      allParents.push({
        tag: el.tagName,
        class: el.className?.toString().substring(0, 80),
        dataAttrs: Array.from(el.attributes).filter(a => a.name.startsWith('data-')).map(a => `${a.name}=${a.value}`)
      });
      el = el.parentElement;
    }
    
    return {
      found: true,
      btnRect: btn.getBoundingClientRect(),
      closestClickable: clickable?.className?.toString().substring(0, 80),
      allParents
    };
  });
  console.log("\n=== 予約画面へ進む ボタン詳細 ===");
  console.log(JSON.stringify(btnDetails, null, 2));

  await page.waitForTimeout(20000);
  await browser.close();
})();
