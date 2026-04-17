const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  const allRequests = [];
  page.on("request", req => {
    const url = req.url();
    if (url.includes("rincle") || url.includes("workflow") || url.includes("api")) {
      allRequests.push({ url: url.substring(0, 200), method: req.method(), postData: req.postData()?.substring(0, 100) });
    }
  });

  const consoleLogs = [];
  page.on("console", msg => consoleLogs.push({ type: msg.type(), text: msg.text().substring(0, 200) }));

  // Login first
  await page.goto("https://rincle.co.jp/version-5398j", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(process.env.RINCLE_EMAIL);
  await page.locator('input[type="password"]').fill(process.env.RINCLE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });
  console.log("✅ ログイン");

  const BICYCLE_ID = "1759034684755x353916196529111040";
  const START_TS = 1775354400000;  // 2026/04/05 11:00 JST
  const END_TS = 1775383200000;    // 2026/04/05 19:00 JST

  // Navigate directly to bicycle_detail with timestamps in URL
  const detailUrl = `https://rincle.co.jp/version-5398j/index/bicycle_detail?bicycle_id=${BICYCLE_ID}&startDate2=${START_TS}&endDate2=${END_TS}&change=no`;
  console.log("\n→ 直接ナビゲート:", detailUrl);
  await page.goto(detailUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  console.log("最終URL:", page.url());

  // Check what buttons are visible
  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map(b => ({ text: b.textContent?.trim(), y: Math.round(b.getBoundingClientRect().y) }))
      .filter(b => b.text && !["今日","消去","Close","keyboard_arrow_left","keyboard_arrow_right"].includes(b.text))
  );
  console.log("visible ボタン:", btns.slice(0, 15));

  // Check if date pickers are pre-filled
  const pickerValues = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input.picker__input")).map((el, i) => ({
      index: i,
      value: el.value,
      disabled: el.disabled,
      ariaOwns: el.getAttribute("aria-owns")
    }));
  });
  console.log("\n日付ピッカー状態:");
  pickerValues.forEach(p => console.log(JSON.stringify(p)));

  // Check SELECT dropdowns
  const selects = await page.evaluate(() =>
    Array.from(document.querySelectorAll("select")).map((el, i) => ({
      index: i,
      optionCount: el.options.length,
      selectedValue: el.value,
      firstFewOptions: Array.from(el.options).slice(0, 3).map(o => o.text)
    }))
  );
  console.log("\nSELECT一覧:");
  selects.forEach(s => console.log(JSON.stringify(s)));

  // Scroll to find 予約画面へ進む button
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1000);

  const reserveBtn = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { found: true, y: Math.round(r.y), visible: r.width > 0 && r.height > 0 };
  });
  console.log("\n予約画面へ進む:", reserveBtn);

  // Try clicking if found
  if (reserveBtn?.found) {
    allRequests.length = 0;
    consoleLogs.length = 0;
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
      if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "予約画面へ進む" }).click();
    await page.waitForTimeout(3000);
    console.log("\n=== クリック後 ===");
    console.log("URL:", page.url());
    console.log("API リクエスト:", allRequests.length);
    allRequests.forEach(r => console.log(" ", r.method, r.url.substring(0, 120)));
    const errors = consoleLogs.filter(l => l.type === "error");
    errors.forEach(e => console.log("ERROR:", e.text));
  }

  await page.screenshot({ path: "screenshots/debug_direct.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
