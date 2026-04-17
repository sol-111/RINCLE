const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  const workflowReqs = [];
  page.on("request", req => {
    if (req.url().includes("workflow")) workflowReqs.push({ method: req.method(), body: req.postData()?.substring(0, 500) });
  });
  page.on("response", async res => {
    if (res.url().includes("workflow")) {
      const body = await res.text().catch(() => "");
      const last = workflowReqs[workflowReqs.length - 1];
      if (last) last.response = body.substring(0, 300);
    }
  });

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

  // Try to call the jQuery click handler directly
  const handlerInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (!btn) return { error: "button not found" };
    const clickable = btn.closest(".clickable-element");
    if (!clickable) return { error: "clickable not found" };

    // Get jQuery event data
    const events = window.jQuery._data(clickable, "events");
    if (!events) return { error: "no jquery events" };

    const clickHandlers = events.click || [];
    const mousedownHandlers = events.mousedown || [];

    // Get the handler function source
    const info = {
      clickCount: clickHandlers.length,
      mousedownCount: mousedownHandlers.length,
      clickHandlerSource: clickHandlers[0]?.handler?.toString().substring(0, 300),
      mousedownHandlerSource: mousedownHandlers[0]?.handler?.toString().substring(0, 300)
    };

    return info;
  });
  console.log("=== jQuery handlers ===");
  console.log(JSON.stringify(handlerInfo, null, 2));

  // Try calling the click handler directly with a fake event
  const directCallResult = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (!btn) return "button not found";
    const clickable = btn.closest(".clickable-element");
    if (!clickable) return "clickable not found";

    const events = window.jQuery._data(clickable, "events");
    if (!events?.click?.length) return "no click handlers";

    // Create a synthetic jQuery event
    const e = window.jQuery.Event("click");
    e.target = clickable;
    e.currentTarget = clickable;

    // Call the handler directly
    try {
      events.click[0].handler.call(clickable, e);
      return "handler called successfully";
    } catch(err) {
      return "handler error: " + err.message;
    }
  });
  console.log("\n=== Direct handler call ===");
  console.log(directCallResult);
  await page.waitForTimeout(3000);
  console.log("URL:", page.url());
  console.log("workflow reqs:", workflowReqs.length);
  if (workflowReqs.length > 0) {
    workflowReqs.forEach(r => {
      console.log("REQ:", r.body.substring(0, 200));
      console.log("RESP:", r.response);
    });
  }

  await page.screenshot({ path: "screenshots/debug_handler.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
