const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  const allReqs = [];
  page.on("request", req => {
    if (req.url().includes("workflow/start"))
      allReqs.push({ url: req.url(), body: req.postData() });
  });
  page.on("response", async res => {
    if (res.url().includes("workflow/start")) {
      const body = await res.text().catch(() => "");
      const last = allReqs[allReqs.length - 1];
      if (last) last.response = body.substring(0, 300);
    }
  });

  await page.goto("https://rincle.co.jp/version-test", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible" });
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
  allReqs.length = 0;

  // Get workflow IDs without circular JSON
  const wfInfo = await page.evaluate(() => {
    try {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
      const clickable = btn?.closest(".clickable-element");
      const inst = clickable?.bubble_data?.bubble_instance;
      const el = inst?.element;
      if (!el) return "no element";
      
      // get_related_workflows returns array/object of workflow definitions
      const wfs = el.get_related_workflows_run_cache_1_param?.("ButtonClicked");
      if (!wfs) return "no workflows method";
      
      // Try to extract just the IDs/triggers without going deep
      const result = [];
      const wfsArr = Array.isArray(wfs) ? wfs : Object.values(wfs);
      for (const wf of wfsArr) {
        try {
          result.push({
            id: wf?.id || wf?.json?.id,
            trigger: wf?.trigger || wf?.json?.trigger,
            conditionType: typeof (wf?.condition || wf?.json?.condition)
          });
        } catch(e) { result.push({ error: e.message }); }
      }
      return result;
    } catch(e) { return "error: " + e.message; }
  });
  console.log("Workflows:", JSON.stringify(wfInfo));

  // Check the "not clickable" state via Bubble internals
  const notClickable = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    const clickable = btn?.closest(".clickable-element");
    const inst = clickable?.bubble_data?.bubble_instance;
    if (!inst) return null;
    
    // Check _watchers for any "not_clickable" watcher
    const watchers = inst._watchers || [];
    const watcherInfo = watchers.length;
    
    // Try to find is_clickable via element's style computation
    const el = inst.element;
    try {
      const styleProps = el.get_styleable_properties?.();
      const notClickableProp = styleProps?.find?.(p => String(p).includes("clickable"));
      return {
        watcherCount: watcherInfo,
        notClickableProp: String(notClickableProp),
        inlineStyle: clickable.getAttribute("style"),
        // Check if there's an opacity_override state
        opacityOverride: inst._states?.opacity_override,
        isClickableState: inst._states?.is_clickable
      };
    } catch(e) { return { error: e.message, watcherCount: watcherInfo, inlineStyle: clickable.getAttribute("style") }; }
  });
  console.log("Not clickable info:", JSON.stringify(notClickable));

  // Capture a working workflow/start request for comparison
  // Click 検索する (goes back, so we'll capture during time select above)
  // Instead, look at what requests fired during our selections
  console.log("Captured workflow reqs so far:", allReqs.length);

  // Try brute force: patch Bubble's clickable check in CSS
  // Remove inline style on clickable and directly call the jQuery handler  
  console.log("\n→ Force-enable and trigger...");
  const triggerResult = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    const clickable = btn?.closest(".clickable-element");
    if (!clickable) return "no clickable";
    
    const inst = clickable.bubble_data?.bubble_instance;
    
    // Set opacity_override to 1 if possible
    if (inst?._states) {
      inst._states.opacity_override = 1;
    }
    
    // Remove inline styles
    clickable.style.opacity = "1";
    clickable.style.cursor = "pointer";
    clickable.style.pointerEvents = "auto";
    
    // Also set on all parents
    let el = clickable.parentElement;
    while (el) {
      if (el.style?.opacity === "0.6") el.style.opacity = "1";
      el = el.parentElement;
    }
    
    // Now call the click handler
    const events = window.jQuery._data(clickable, "events");
    if (!events?.click?.[0]) return "no handler";
    
    const e = window.jQuery.Event("click");
    e.target = btn;
    e.currentTarget = clickable;
    events.click[0].handler.call(clickable, e);
    return "triggered";
  });
  console.log("Trigger result:", triggerResult);
  await page.waitForTimeout(3000);
  console.log("URL:", page.url());
  console.log("Workflow reqs after force:", allReqs.length);
  allReqs.forEach(r => {
    console.log(" REQ:", r.body?.substring(0, 300));
    console.log(" RESP:", r.response);
  });

  await page.waitForTimeout(20000);
  await browser.close();
})();
