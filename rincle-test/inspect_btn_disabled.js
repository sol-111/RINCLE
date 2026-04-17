const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  const allReqs = [];
  page.on("request", req => { if (req.url().includes("workflow/start")) allReqs.push({ body: req.postData() }); });
  page.on("response", async res => { if (res.url().includes("workflow/start")) { const b = await res.text().catch(() => ""); const l = allReqs[allReqs.length-1]; if(l) l.response = b.substring(0,600); }});

  await page.goto("https://rincle.co.jp/version-5398j", { waitUntil: "networkidle" });
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

  async function selectDate(i, m, d, y) {
    const inp = page.locator("input.picker__input").nth(i);
    const ao = await inp.getAttribute("aria-owns");
    const root = page.locator(`#${ao}`);
    await inp.click({ force: true });
    await page.waitForTimeout(600);
    for (let n = 0; n < 24; n++) {
      const mt = await root.locator(".picker__month").textContent();
      const yt = await root.locator(".picker__year").textContent();
      if (mt?.includes(`${m}月`) && yt?.includes(String(y))) break;
      await root.locator(".picker__nav--next").click();
      await page.waitForTimeout(300);
    }
    await root.locator(".picker__day--infocus").getByText(String(d), { exact: true }).click({ force: true });
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

  // Check button_disabled via get_static_property
  const btnDisabledInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    const clickable = btn?.closest(".clickable-element");
    const inst = clickable?.bubble_data?.bubble_instance;
    if (!inst) return "no instance";
    
    const results = {};
    
    // Try get_static_property
    try {
      results.btnDisabled = inst.get_static_property?.("button_disabled", true);
    } catch(e) { results.btnDisabledError = e.message.substring(0, 100); }
    
    // Try state("button_disabled")
    try {
      results.stateButtonDisabled = inst.state?.("button_disabled");
    } catch(e) { results.stateError = e.message.substring(0, 100); }
    
    // Check precomputed
    try {
      const precomputed = inst.element?.get_precomputed?.();
      results.precomputed = precomputed ? Object.keys(precomputed) : null;
      results.precomputedBtnDisabled = precomputed?.button_disabled;
    } catch(e) { results.precomputedError = e.message.substring(0, 100); }
    
    return results;
  });
  console.log("button_disabled info:", JSON.stringify(btnDisabledInfo));

  // Try to force button_disabled to false by patching the precomputed
  const patchResult = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    const clickable = btn?.closest(".clickable-element");
    const inst = clickable?.bubble_data?.bubble_instance;
    if (!inst) return "no instance";
    
    // Patch precomputed to set button_disabled = false
    try {
      const precomputed = inst.element?.get_precomputed?.();
      if (precomputed) {
        precomputed.button_disabled = false;
        return "patched precomputed.button_disabled = false, keys: " + Object.keys(precomputed).join(", ");
      }
    } catch(e) { /* ignore */ }
    
    // Also try to override get_static_property
    const origGetStatic = inst.get_static_property?.bind(inst);
    if (origGetStatic) {
      inst.get_static_property = function(name, ...args) {
        if (name === "button_disabled") return false;
        return origGetStatic(name, ...args);
      };
      return "patched get_static_property";
    }
    
    return "no patch applied";
  });
  console.log("patch:", patchResult);

  // Now try clicking
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  await page.waitForTimeout(5000);
  console.log("URL:", page.url());
  console.log("workflow reqs:", allReqs.length);
  allReqs.forEach(r => {
    console.log(" REQ:", r.body?.substring(0, 200));
    console.log(" RESP:", r.response?.substring(0, 300));
  });

  await page.waitForTimeout(20000);
  await browser.close();
})();
