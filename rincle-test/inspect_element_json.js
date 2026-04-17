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

  const deepInfo = await page.evaluate(() => {
    try {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
      const clickable = btn?.closest(".clickable-element");
      const inst = clickable?.bubble_data?.bubble_instance;
      if (!inst) return { error: "no instance" };
      
      const el = inst.element;
      const result = {};
      
      // Get el.json
      try {
        const json = el.json;
        result.json = JSON.stringify(json).substring(0, 5000);
      } catch(e) { result.jsonError = e.message; }
      
      // Get workflows via the method
      try {
        const wfs = el.get_related_workflows_run_cache_1_param("ButtonClicked");
        result.buttonClickedWfs = JSON.stringify(wfs).substring(0, 3000);
      } catch(e) { result.wfError = e.message; }
      
      // Get states
      try {
        const states = inst._states;
        const stateValues = {};
        for (const [k, v] of Object.entries(states || {})) {
          try {
            stateValues[k] = typeof v === "object" ? JSON.stringify(v)?.substring(0, 200) : v;
          } catch(e) { stateValues[k] = "error: " + e.message; }
        }
        result.states = stateValues;
      } catch(e) { result.stateError = e.message; }
      
      // Get group_data specifically
      try {
        const groupData = inst._states?.group_data;
        result.groupData = typeof groupData === "undefined" ? "undefined" : 
                          groupData === null ? "null" :
                          JSON.stringify(groupData)?.substring(0, 500);
      } catch(e) { result.groupDataError = e.message; }
      
      // Try calling get_partial
      try {
        const partial = inst.get_partial?.();
        result.partial = JSON.stringify(partial)?.substring(0, 500);
      } catch(e) { result.partialError = e.message; }
      
      return result;
    } catch(e) {
      return { outerError: e.message };
    }
  });
  console.log("=== Deep element info ===");
  console.log(JSON.stringify(deepInfo, null, 2));

  await page.screenshot({ path: "screenshots/debug_deep.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
