const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  // Track ALL network requests
  const allRequests = [];
  page.on("request", req => allRequests.push({ url: req.url().substring(0, 120), method: req.method() }));

  const consoleLogs = [];
  page.on("console", msg => consoleLogs.push({ type: msg.type(), text: msg.text().substring(0, 300) }));
  page.on("pageerror", err => consoleLogs.push({ type: "ERROR", text: err.message }));

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

  // Check Bubble's internal state for the bicycle
  const bubbleState = await page.evaluate(() => {
    // Check for common Bubble global objects
    const info = {
      hasBubble: typeof window.bubble !== "undefined",
      hasAppClient: typeof window.appClient !== "undefined",
      hasClientData: typeof window.client_data !== "undefined",
      // Check page data/state
      hasAngular: typeof window.angular !== "undefined",
      hasVue: typeof window.Vue !== "undefined",
      hasReact: typeof window.React !== "undefined",
      // URL params
      urlParams: window.location.search,
    };

    // Try to find Bubble's internal registry
    const keys = Object.keys(window).filter(k =>
      k.toLowerCase().includes("bubble") ||
      k.toLowerCase().includes("appwrapper") ||
      k.toLowerCase().includes("client") ||
      k.toLowerCase().includes("state")
    ).slice(0, 20);
    info.bubbleKeys = keys;

    return info;
  });
  console.log("Bubble state:", JSON.stringify(bubbleState, null, 2));

  // Check for JavaScript errors
  const errors = consoleLogs.filter(l => l.type === "error" || l.type === "ERROR");
  console.log("\n=== JS エラー ===");
  errors.slice(0, 10).forEach(e => console.log(e.text));

  // Now do the date/time selection and check what API calls are made
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

  allRequests.length = 0;
  await selectDate(2, 4, 5, 2026);
  const reqsAfterDate1 = allRequests.length;

  await selectDate(5, 4, 5, 2026);
  const reqsAfterDate2 = allRequests.length;

  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(500);
  const reqsAfterTime1 = allRequests.length;

  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(1000);
  const reqsAfterTime2 = allRequests.length;

  console.log("\n=== API リクエスト数 ===");
  console.log("貸出日選択後:", reqsAfterDate1);
  console.log("返却日選択後:", reqsAfterDate2);
  console.log("貸出時間選択後:", reqsAfterTime1);
  console.log("返却時間選択後:", reqsAfterTime2);

  // Show the requests
  console.log("\n=== API リクエスト詳細 ===");
  allRequests.filter(r => r.url.includes("rincle") || r.url.includes("bubble") || r.url.includes("api")).forEach(r => console.log(r.method, r.url));

  // Try 予約画面へ進む with very detailed tracking
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(500);

  allRequests.length = 0;
  consoleLogs.length = 0;

  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  await page.waitForTimeout(5000);

  console.log("\n=== 予約画面へ進む クリック後 ===");
  console.log("API リクエスト:", allRequests.length);
  allRequests.forEach(r => console.log(r.method, r.url));
  console.log("コンソールログ:", consoleLogs.slice(0, 5).map(l => JSON.stringify(l)));
  console.log("URL:", page.url());

  await page.waitForTimeout(20000);
  await browser.close();
})();
