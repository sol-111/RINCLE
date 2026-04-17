const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  const workflowReqs = [];
  page.on("request", req => {
    if (req.url().includes("workflow")) workflowReqs.push({ method: req.method(), url: req.url().substring(0, 120), body: req.postData()?.substring(0, 200) });
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
  console.log("✅ 自転車詳細ページ", page.url());

  // Check initial button state
  const checkBtn = async (label) => {
    const info = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
      if (!btn) return { found: false };
      const clickable = btn.closest(".clickable-element");
      return {
        found: true,
        btnOpacity: window.getComputedStyle(btn).opacity,
        clickableOpacity: clickable ? window.getComputedStyle(clickable).opacity : "no clickable",
        clickableStyle: clickable?.getAttribute("style"),
        clickableClass: clickable?.className
      };
    });
    console.log(`[${label}]`, JSON.stringify(info));
    return info;
  };

  await checkBtn("初期状態（日時選択前）");

  // Select dates
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
  await checkBtn("貸出日選択後");
  
  await selectDate(5, 4, 5, 2026);
  await checkBtn("返却日選択後");

  // Check available times in SELECT
  const timeSelectInfo = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select"));
    return selects.map((el, i) => ({
      index: i,
      options: Array.from(el.options).map(o => o.text).slice(0, 5),
      selectedText: el.options[el.selectedIndex]?.text,
      selectedValue: el.value
    }));
  });
  console.log("\nSELECT一覧:");
  timeSelectInfo.forEach(s => console.log(JSON.stringify(s)));

  // Select times
  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(1000);
  await checkBtn("貸出時間選択後");

  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(1000);
  await checkBtn("返却時間選択後");

  // Check workflow requests after time selection
  console.log("\n=== 時刻選択後のworkflowリクエスト ===");
  workflowReqs.forEach(r => console.log(r.method, r.url.substring(0, 100)));
  console.log("合計:", workflowReqs.length);
  workflowReqs.length = 0;

  // Now try clicking the button
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(300);
  
  console.log("\n→ 予約画面へ進む クリック...");
  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  await page.waitForTimeout(3000);
  console.log("URL after:", page.url());
  console.log("workflow リクエスト:", workflowReqs.length);

  await page.screenshot({ path: "screenshots/debug_opacity.png" });
  await page.waitForTimeout(20000);
  await browser.close();
})();
