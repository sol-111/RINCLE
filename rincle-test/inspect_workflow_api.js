const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  // Capture ALL requests with full details
  const workflowRequests = [];
  page.on("request", req => {
    const url = req.url();
    if (url.includes("workflow") || url.includes("api/1.1/wf")) {
      workflowRequests.push({
        url: url,
        method: req.method(),
        headers: req.headers(),
        postData: req.postData()
      });
    }
  });
  page.on("response", async res => {
    const url = res.url();
    if (url.includes("workflow")) {
      const body = await res.body().catch(() => null);
      if (body) {
        workflowRequests.find(r => r.url === url && !r.response)
          && (workflowRequests.find(r => r.url === url && !r.response).response = body.toString().substring(0, 500));
      }
    }
  });

  // Login
  await page.goto("https://rincle.co.jp/version-5398j", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(process.env.RINCLE_EMAIL);
  await page.locator('input[type="password"]').fill(process.env.RINCLE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });
  console.log("✅ ログイン");

  // Navigate to bicycle_detail with pre-filled dates
  const BICYCLE_ID = "1759034684755x353916196529111040";
  const START_TS = 1775354400000;
  const END_TS = 1775383200000;
  const detailUrl = `https://rincle.co.jp/version-5398j/index/bicycle_detail?bicycle_id=${BICYCLE_ID}&startDate2=${START_TS}&endDate2=${END_TS}&change=no`;
  await page.goto(detailUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  console.log("URL:", page.url());

  // Show all workflow requests so far
  console.log("\n=== ページロード時のworkflowリクエスト ===");
  workflowRequests.forEach(r => {
    console.log(`${r.method} ${r.url}`);
    if (r.postData) console.log("  BODY:", r.postData.substring(0, 300));
    if (r.response) console.log("  RESP:", r.response.substring(0, 200));
  });

  // Try clicking button with interception
  workflowRequests.length = 0;
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(300);
  
  console.log("\n→ 予約画面へ進む クリック...");
  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  await page.waitForTimeout(3000);

  console.log("URL after click:", page.url());
  console.log("workflow リクエスト:", workflowRequests.length);
  workflowRequests.forEach(r => {
    console.log(`  ${r.method} ${r.url}`);
    if (r.postData) console.log("  BODY:", r.postData.substring(0, 300));
  });

  // Now try Bubble's internal dispatch via evaluate
  console.log("\n→ Bubble内部でのクリック試行...");
  const bubbleClick = await page.evaluate(() => {
    // Try to find and trigger Bubble's internal click handler
    const clickables = Array.from(document.querySelectorAll(".clickable-element"));
    const target = clickables.find(el => el.textContent?.includes("予約画面へ進む"));
    
    if (!target) return "clickable not found";

    // Get all event listeners using Chrome's internal API
    const win = window;
    
    // Try dispatching through the element chain
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return `dispatched to ${target.className.substring(0, 50)}`;
  });
  console.log("Bubble click result:", bubbleClick);
  await page.waitForTimeout(2000);
  console.log("workflow リクエスト after dispatch:", workflowRequests.length);

  // Check if there's a Bubble app object we can use
  const appInfo = await page.evaluate(() => {
    const keys = Object.keys(window).filter(k => k.startsWith("appClient") || k === "app");
    const info = {};
    keys.forEach(k => {
      try { info[k] = typeof window[k]; } catch(e) { info[k] = "error"; }
    });
    
    // Look for Bubble's workflow trigger mechanism
    if (window.appClient) {
      info.appClientKeys = Object.keys(window.appClient).slice(0, 20);
    }
    
    // Check for Bubble's event system
    if (window.Bubble) {
      info.BubbleKeys = Object.keys(window.Bubble).slice(0, 20);
    }
    
    return info;
  });
  console.log("\n=== App オブジェクト ===");
  console.log(JSON.stringify(appInfo, null, 2));

  await page.screenshot({ path: "screenshots/debug_workflow.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
