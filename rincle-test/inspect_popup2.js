const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();

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

  await selectDate(2, 3, 29, 2026);
  await selectDate(5, 3, 29, 2026);
  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(500);
  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(1000);
  console.log("✅ 日時入力完了");

  // Check estimate area first
  const estimate = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll("*"))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility === "visible" &&
          el.children.length === 0 && el.textContent?.trim().match(/お見積もり|合計|基本料金|￥|円/);
      })
      .map(el => el.textContent?.trim());
    return [...new Set(texts)];
  });
  console.log("見積もりエリア:", estimate);

  // Scroll to 予約画面へ進む button and click
  await page.getByRole("button", { name: "予約画面へ進む" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/debug_before_proceed.png" });

  // Click and observe for 10 seconds
  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  console.log("クリック直後...");

  // Poll for popup opening
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const popupState = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.bubble-element.Popup')).map(el => {
        const s = window.getComputedStyle(el);
        return { display: s.display, visibility: s.visibility, opacity: s.opacity };
      });
    });
    const openPopup = popupState.find(p => p.display !== "none" && p.visibility !== "hidden");
    if (openPopup) {
      console.log(`  [${i*0.5}s] Popup opened!`, openPopup);
      break;
    }
    // Check for any new visible buttons
    const newBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter(b => {
          const r = b.getBoundingClientRect();
          const s = window.getComputedStyle(b);
          return r.width > 0 && r.height > 0 && s.visibility === "visible" &&
            b.textContent?.trim().match(/予約|確認|進む/);
        })
        .map(b => b.textContent?.trim())
    );
    if (newBtns.length > 0) console.log(`  [${i*0.5}s] visible buttons:`, newBtns);
  }

  await page.screenshot({ path: "screenshots/debug_after_proceed.png" });

  // Final check
  const finalBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map(b => {
        const s = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return {
          text: b.textContent?.trim(),
          visible: r.width > 0 && r.height > 0 && s.visibility === "visible",
          visibility: s.visibility,
        };
      })
      .filter(b => b.text && !["今日","消去","Close","keyboard_arrow_left","keyboard_arrow_right"].includes(b.text))
  );
  console.log("\n=== 最終ボタン状態 ===");
  finalBtns.forEach(b => console.log(JSON.stringify(b)));

  // Check visible text for hints
  const visibleTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility === "visible" &&
          el.children.length === 0 && el.textContent?.trim().length > 0;
      })
      .map(el => el.textContent?.trim())
      .filter(t => t && t.length > 2 && t.length < 60)
      .filter(t => t.match(/予約|確認|貸出|返却|料金|円|進む|完了|エラー|警告|注意|すでに|既に|ご確認/))
      .filter((v, i, arr) => arr.indexOf(v) === i)
  );
  console.log("\n=== 予約/料金関連テキスト ===");
  visibleTexts.forEach(t => console.log(t));

  await page.waitForTimeout(20000);
  await browser.close();
})();
