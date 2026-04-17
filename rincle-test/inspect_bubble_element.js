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
      if (last) last.response = body.substring(0, 800);
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

  // Safely access element definition
  const elementDef = await page.evaluate(() => {
    try {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
      const clickable = btn?.closest(".clickable-element");
      const inst = clickable?.bubble_data?.bubble_instance;
      if (!inst) return { error: "no instance" };
      
      const el = inst.element;
      if (!el) return { noElement: true };
      
      const result = {
        type: el.type,
        id: el.id,
        keys: Object.keys(el).slice(0, 30)
      };
      
      // Safely get conditions
      try {
        if (el.conditions) {
          result.conditionCount = Array.isArray(el.conditions) ? el.conditions.length : Object.keys(el.conditions).length;
          // Get just the first condition's type info safely
          const cond0 = Array.isArray(el.conditions) ? el.conditions[0] : el.conditions[Object.keys(el.conditions)[0]];
          if (cond0) {
            result.condition0Keys = Object.keys(cond0);
            result.condition0Type = cond0.type || cond0.trigger;
          }
          result.conditionsRaw = JSON.stringify(el.conditions).substring(0, 2000);
        }
      } catch(e) { result.condError = e.message; }
      
      // Safely get workflows
      try {
        if (el.workflows) {
          result.workflowKeys = Object.keys(el.workflows).slice(0, 10);
          result.workflowsRaw = JSON.stringify(el.workflows).substring(0, 3000);
        }
      } catch(e) { result.wfError = e.message; }
      
      // Instance states
      try {
        const states = inst._states;
        if (states) {
          result.stateKeys = Object.keys(states).slice(0, 10);
        }
      } catch(e) { result.stateError = e.message; }
      
      return result;
    } catch(e) {
      return { outerError: e.message, stack: e.stack?.substring(0, 200) };
    }
  });
  console.log("=== element definition ===");
  console.log(JSON.stringify(elementDef, null, 2));

  await page.screenshot({ path: "screenshots/debug_element.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
