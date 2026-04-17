const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();

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

  await selectDate(2, 3, 29, 2026);
  await selectDate(5, 3, 29, 2026);
  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(500);
  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(500);
  console.log("✅ 日時入力完了");

  // Click 予約画面へ進む
  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "screenshots/debug_popup.png" });
  console.log("✅ 予約画面へ進む クリック後");

  // Check what's visible now
  const visibleBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map(b => {
        const s = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return {
          text: b.textContent?.trim(),
          visible: r.width > 0 && r.height > 0 && s.visibility === "visible",
          visibility: s.visibility,
          rect: { y: Math.round(r.y), h: Math.round(r.height) }
        };
      })
      .filter(b => b.text)
  );
  console.log("=== ボタン一覧 ===");
  visibleBtns.filter(b => b.visible).forEach(b => console.log(JSON.stringify(b)));

  console.log("\n=== visibility:hidden ボタン ===");
  visibleBtns.filter(b => !b.visible && b.visibility === "hidden").forEach(b => console.log(JSON.stringify(b)));

  // Check for popups/dialogs
  const popups = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll(
      '.bubble-element.Popup, .bubble-element.popup, [class*="Popup"], [role="dialog"]'
    ));
    return candidates.map(el => {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        class: el.className?.toString().substring(0, 80),
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        rect: { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) }
      };
    });
  });
  console.log("\n=== Popup/Dialog 要素 ===");
  popups.forEach(p => console.log(JSON.stringify(p)));

  // All visible leaf text
  const texts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility === "visible" && el.children.length === 0;
      })
      .map(el => el.textContent?.trim())
      .filter(t => t && t.length > 1 && t.length < 50)
      .filter((v, i, arr) => arr.indexOf(v) === i)
  );
  console.log("\n=== 画面上の visible テキスト ===");
  console.log(texts.join(" | "));

  await page.waitForTimeout(30000);
  await browser.close();
})();
