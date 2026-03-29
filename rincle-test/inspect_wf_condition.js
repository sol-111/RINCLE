const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  const allReqs = [];
  page.on("request", req => { if (req.url().includes("workflow/start")) allReqs.push({ body: req.postData() }); });
  page.on("response", async res => { if (res.url().includes("workflow/start")) { const b = await res.text().catch(() => ""); const l = allReqs[allReqs.length-1]; if(l) l.response = b.substring(0,600); }});

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

  async function selectDate(i, m, d, y) {
    const inp = page.locator("input.picker__input").nth(i);
    const ariaOwns = await inp.getAttribute("aria-owns");
    const root = page.locator(`#${ariaOwns}`);
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

  // Call each workflow condition function and inspect the result
  const condResult = await page.evaluate(() => {
    try {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
      const clickable = btn?.closest(".clickable-element");
      const inst = clickable?.bubble_data?.bubble_instance;
      const el = inst?.element;
      if (!el) return "no element";
      
      const wfs = el.get_related_workflows_run_cache_1_param?.("ButtonClicked");
      if (!wfs) return "no workflows";
      
      const results = [];
      const wfsArr = Array.isArray(wfs) ? wfs : Object.values(wfs);
      
      for (let i = 0; i < wfsArr.length; i++) {
        const wf = wfsArr[i];
        try {
          const condFn = wf?.condition;
          let condResult;
          try {
            condResult = condFn?.call?.(inst);
          } catch(e) {
            condResult = "ERROR calling: " + e.message;
          }
          
          // Try to get string representation of condition
          const condStr = condFn?.toString?.()?.substring(0, 500);
          
          results.push({
            index: i,
            hasCondition: !!condFn,
            condResult: condResult === undefined ? "undefined" :
                        condResult === null ? "null" :
                        typeof condResult === "object" ? String(condResult) : condResult,
            condSource: condStr
          });
        } catch(e) {
          results.push({ index: i, error: e.message });
        }
      }
      return results;
    } catch(e) { return "outer: " + e.message; }
  });
  console.log("=== Workflow conditions ===");
  console.log(JSON.stringify(condResult, null, 2));

  await page.waitForTimeout(20000);
  await browser.close();
})();
