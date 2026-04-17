const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
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

  // Use April 5 (available date)
  await selectDate(2, 4, 5, 2026);
  console.log("✅ 貸出日: 2026/04/05");
  await selectDate(5, 4, 5, 2026);
  console.log("✅ 返却日: 2026/04/05");

  // Wait for SELECT options to load
  await page.waitForTimeout(500);
  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(500);
  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(1000);
  console.log("✅ 時刻選択");

  // Check for existing-reservation warning
  const warnings = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility === "visible" &&
          el.children.length === 0 &&
          el.textContent?.trim().match(/指定期間|既に貸出|貸出中|予定があります/);
      })
      .map(el => el.textContent?.trim())
  );
  console.log("警告メッセージ:", warnings);

  // Scroll to and click 予約画面へ進む
  await page.getByRole("button", { name: "予約画面へ進む" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/debug3_before_proceed.png" });

  // Listen for DOM changes
  await page.evaluate(() => {
    window._domChanges = [];
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        if (m.addedNodes.length > 0) {
          m.addedNodes.forEach(n => {
            if (n.className) window._domChanges.push({ added: n.className.toString().substring(0, 60) });
          });
        }
        if (m.attributeName) {
          const el = m.target;
          const s = window.getComputedStyle(el);
          if (s.display !== "none" && el.className?.toString().includes("Popup")) {
            window._domChanges.push({ popupVisible: el.className.toString().substring(0, 60) });
          }
        }
      });
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"] });
    window._observer = observer;
  });

  await page.getByRole("button", { name: "予約画面へ進む" }).click();
  console.log("クリック実行");

  await page.waitForTimeout(5000);

  const changes = await page.evaluate(() => window._domChanges);
  console.log("DOM変化 (最初の20件):", changes.slice(0, 20));

  // Check popup elements
  const popups = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.bubble-element.Popup')).map(el => {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        class: el.className.substring(0, 60),
        display: s.display,
        visibility: s.visibility,
        rect: { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) }
      };
    })
  );
  console.log("\n=== Popup 状態 ===");
  popups.forEach(p => console.log(JSON.stringify(p)));

  // Check ALL visible buttons
  const allBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter(b => {
        const s = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && s.visibility === "visible";
      })
      .map(b => ({ text: b.textContent?.trim(), y: Math.round(b.getBoundingClientRect().y) }))
      .filter(b => b.text && !["今日","消去","Close","keyboard_arrow_left","keyboard_arrow_right"].includes(b.text))
  );
  console.log("\n=== visible ボタン (picker以外) ===");
  allBtns.forEach(b => console.log(JSON.stringify(b)));

  await page.screenshot({ path: "screenshots/debug3_after_proceed.png" });

  await page.waitForTimeout(30000);
  await browser.close();
})();
