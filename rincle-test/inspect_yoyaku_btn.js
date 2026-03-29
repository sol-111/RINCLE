const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  const workflowReqs = [];
  page.on("request", req => {
    if (req.url().includes("workflow")) workflowReqs.push({ method: req.method(), body: req.postData()?.substring(0, 200) });
  });
  page.on("response", async res => {
    if (res.url().includes("workflow")) {
      const body = await res.text().catch(() => "");
      const last = workflowReqs[workflowReqs.length - 1];
      if (last) last.response = body.substring(0, 300);
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

  // Check "予約する" button in detail
  const yoyakuInfo = await page.evaluate(() => {
    const allClickable = Array.from(document.querySelectorAll(".clickable-element"));
    const yoyaku = allClickable.find(el => el.textContent?.trim().includes("予約する") && !el.textContent?.trim().includes("予約画面"));
    if (!yoyaku) return { found: false };
    
    const r = yoyaku.getBoundingClientRect();
    const s = window.getComputedStyle(yoyaku);
    return {
      found: true,
      text: yoyaku.textContent?.trim().substring(0, 50),
      y: Math.round(r.y),
      x: Math.round(r.x),
      width: Math.round(r.width),
      height: Math.round(r.height),
      opacity: s.opacity,
      cursor: s.cursor,
      display: s.display,
      visibility: s.visibility,
      style: yoyaku.getAttribute("style")?.substring(0, 100),
      class: yoyaku.className.substring(0, 80)
    };
  });
  console.log("=== 予約する ボタン ===");
  console.log(JSON.stringify(yoyakuInfo, null, 2));

  // Check bubble_data on the disabled clickable-element
  const bubbleDataInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    const clickable = btn?.closest(".clickable-element");
    if (!clickable) return null;
    
    // Access bubble_data
    const bd = clickable.bubble_data;
    if (!bd) return { no_bubble_data: true };
    
    return {
      type: typeof bd,
      keys: Object.keys(bd),
      // Try to get workflows
      hasWorkflows: "workflows" in bd,
      hasConditions: "conditions" in bd,
      isClickable: bd.is_clickable,
      elementId: bd.element_id || bd.id,
      sampleKeys: Object.keys(bd).slice(0, 15)
    };
  });
  console.log("\n=== bubble_data on 予約画面へ進む ===");
  console.log(JSON.stringify(bubbleDataInfo, null, 2));

  // Try scrolling to "予約する" and clicking it
  console.log("\n→ 予約する ボタンへスクロールしてクリック...");
  const scrollResult = await page.evaluate(() => {
    const allClickable = Array.from(document.querySelectorAll(".clickable-element"));
    const yoyaku = allClickable.find(el => el.textContent?.trim().includes("予約する") && !el.textContent?.trim().includes("予約画面"));
    if (!yoyaku) return "not found";
    yoyaku.scrollIntoView({ behavior: "instant", block: "center" });
    return "scrolled to element";
  });
  console.log("scroll result:", scrollResult);
  await page.waitForTimeout(500);

  // Click "予約する" button
  await page.screenshot({ path: "screenshots/debug_before_yoyaku.png" });
  await page.getByRole("button", { name: "予約する" }).first().click();
  await page.waitForTimeout(3000);
  console.log("URL after 予約する:", page.url());
  console.log("workflow reqs:", workflowReqs.length);
  workflowReqs.forEach(r => {
    console.log("REQ:", r.body?.substring(0, 150));
    console.log("RESP:", r.response?.substring(0, 200));
  });

  await page.screenshot({ path: "screenshots/debug_after_yoyaku.png" });
  await page.waitForTimeout(25000);
  await browser.close();
})();
