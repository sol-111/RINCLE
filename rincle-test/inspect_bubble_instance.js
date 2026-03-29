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

  const instanceInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    const clickable = btn?.closest(".clickable-element");
    if (!clickable) return { error: "clickable not found" };
    
    const inst = clickable.bubble_data?.bubble_instance;
    if (!inst) return { error: "no bubble_instance" };
    
    const info = {
      type: typeof inst,
      ownKeys: Object.keys(inst).slice(0, 30),
      protoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(inst) || {}).slice(0, 30)
    };
    
    // Try to get workflows
    try {
      if (inst.workflows) info.workflowCount = Object.keys(inst.workflows).length;
      if (inst._workflows) info._workflowCount = Object.keys(inst._workflows).length;
      if (inst.element) {
        info.elementId = inst.element.id;
        info.elementType = inst.element.type;
        if (inst.element.workflows) {
          const wfs = inst.element.workflows;
          info.workflowKeys = Object.keys(wfs).slice(0, 10);
          // Get the ButtonClicked workflows
          const buttonClicked = Object.entries(wfs).filter(([k, v]) => v?.trigger === "ButtonClicked" || JSON.stringify(v).includes("ButtonClicked"));
          info.buttonClickedWfs = buttonClicked.map(([k, v]) => k);
        }
      }
    } catch(e) { info.error = e.message; }
    
    return info;
  });
  console.log("=== bubble_instance ===");
  console.log(JSON.stringify(instanceInfo, null, 2));

  // Access methods on the instance
  const instanceMethods = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    const clickable = btn?.closest(".clickable-element");
    const inst = clickable?.bubble_data?.bubble_instance;
    if (!inst) return null;
    
    const methods = {};
    for (const key of Object.keys(inst)) {
      methods[key] = typeof inst[key];
    }
    
    // Also check prototype methods
    const proto = Object.getPrototypeOf(inst);
    const protoMethods = {};
    for (const key of Object.getOwnPropertyNames(proto || {})) {
      protoMethods[key] = typeof proto[key];
    }
    
    return { own: methods, proto: protoMethods };
  });
  console.log("\n=== instance methods/props ===");
  console.log(JSON.stringify(instanceMethods, null, 2));

  // Try to get the element definition to find conditions
  const elementDef = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    const clickable = btn?.closest(".clickable-element");
    const inst = clickable?.bubble_data?.bubble_instance;
    if (!inst) return null;
    
    const el = inst.element || inst._element || inst.definition;
    if (!el) return { noElement: true };
    
    const elInfo = {
      id: el.id,
      type: el.type,
    };
    
    // Get conditions
    if (el.conditions) {
      elInfo.conditionCount = el.conditions.length || Object.keys(el.conditions).length;
      elInfo.conditions = JSON.stringify(el.conditions).substring(0, 1000);
    }
    
    // Get workflows
    if (el.workflows) {
      const wfKeys = Object.keys(el.workflows);
      elInfo.workflowKeys = wfKeys;
      // Find ButtonClicked
      wfKeys.forEach(k => {
        const wf = el.workflows[k];
        if (JSON.stringify(wf).includes("ButtonClicked")) {
          elInfo.buttonClickedWf = JSON.stringify(wf).substring(0, 500);
        }
      });
    }
    
    return elInfo;
  });
  console.log("\n=== element definition ===");
  console.log(JSON.stringify(elementDef, null, 2));

  await page.screenshot({ path: "screenshots/debug_instance.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
