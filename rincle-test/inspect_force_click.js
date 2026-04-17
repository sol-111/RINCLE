const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  const workflowReqs = [];
  page.on("request", req => {
    if (req.url().includes("workflow")) workflowReqs.push({ method: req.method(), url: req.url().substring(0, 120), body: req.postData()?.substring(0, 300) });
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
  await page.waitForTimeout(1500);

  // Check button state
  const btnState = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    const clickable = btn?.closest(".clickable-element");
    return {
      btnOpacity: btn ? window.getComputedStyle(btn).opacity : null,
      clickableOpacity: clickable ? window.getComputedStyle(clickable).opacity : null,
      clickableStyle: clickable?.getAttribute("style"),
      // Check SELECT values after selection
      selects: Array.from(document.querySelectorAll("select")).map((el, i) => ({
        index: i,
        selectedText: el.options[el.selectedIndex]?.text,
        selectedValue: el.value.substring(0, 60)
      }))
    };
  });
  console.log("=== 全選択後の状態 ===");
  console.log(JSON.stringify(btnState, null, 2));

  // Show the 6 workflow requests
  console.log("\n=== 選択中のworkflowリクエスト ===");
  workflowReqs.forEach(r => {
    console.log(`${r.method} ${r.url}`);
    if (r.body) console.log("  REQ:", r.body.substring(0, 200));
    if (r.response) console.log("  RESP:", r.response.substring(0, 200));
  });

  // Try to force-enable the clickable element and trigger click
  console.log("\n→ opacity削除してjQuery trigger...");
  workflowReqs.length = 0;
  
  const result = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (!btn) return "button not found";
    const clickable = btn.closest(".clickable-element");
    if (!clickable) return "clickable not found";
    
    // Remove the disabled style
    clickable.style.opacity = "";
    clickable.style.cursor = "";
    clickable.style.pointerEvents = "auto";
    
    // Try jQuery trigger
    if (window.jQuery) {
      window.jQuery(clickable).trigger("click");
      return "jQuery trigger fired";
    }
    
    // Fallback to native dispatch
    clickable.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return "native dispatch fired";
  });
  console.log("Result:", result);
  await page.waitForTimeout(3000);
  console.log("URL after:", page.url());
  console.log("workflow リクエスト:", workflowReqs.length);
  workflowReqs.forEach(r => {
    console.log(" ", r.method, r.url);
    if (r.response) console.log("  RESP:", r.response.substring(0, 200));
  });

  // Also try mousedown + mouseup + click sequence
  if (workflowReqs.length === 0) {
    console.log("\n→ mousedown/up/click sequence...");
    workflowReqs.length = 0;
    const btnPos = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
      if (!btn) return null;
      btn.scrollIntoView({ behavior: "instant", block: "center" });
      const r = btn.getBoundingClientRect();
      return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
    });
    if (btnPos) {
      await page.waitForTimeout(300);
      // Force click via evaluating jQuery mousedown then click
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
        const clickable = btn?.closest(".clickable-element");
        if (!clickable || !window.jQuery) return;
        const $c = window.jQuery(clickable);
        $c.trigger("mousedown");
        $c.trigger("mouseup");
        $c.trigger("click");
      });
      await page.waitForTimeout(3000);
      console.log("URL after:", page.url());
      console.log("workflow リクエスト:", workflowReqs.length);
      workflowReqs.forEach(r => console.log(" ", r.method, r.url));
    }
  }

  await page.screenshot({ path: "screenshots/debug_force.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
