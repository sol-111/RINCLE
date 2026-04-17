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
  console.log("✅ 詳細ページ");

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
    await page.waitForTimeout(300);
  }

  async function selectTime(timeInputIndex, time) {
    const input = page.locator("input.time_div.picker__input").nth(timeInputIndex);
    const ariaOwns = await input.getAttribute("aria-owns");
    const root = page.locator(`#${ariaOwns}`);
    await input.click({ force: true });
    await page.waitForTimeout(500);
    await root.locator(`[aria-label="${time}"]`).click({ force: true });
    await page.waitForTimeout(300);
    await root.locator(".picker__button--close").click({ force: true });
    await page.waitForTimeout(300);
  }

  await selectDate(2, 3, 29, 2026);
  console.log("✅ 貸出日");
  await selectDate(5, 3, 29, 2026);
  console.log("✅ 返却日");
  await selectTime(0, "11:00");
  console.log("✅ 貸出時間");
  await selectTime(1, "19:00");
  console.log("✅ 返却時間");

  // Wait for Bubble to recalculate
  await page.waitForTimeout(2000);

  // Look at ALL visible elements containing 料金/予約/確認/円
  const visibleElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("*"));
    return elements
      .filter(el => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        const text = el.textContent?.trim() || "";
        // visible + has relevant text + is a leaf or near-leaf element
        return r.width > 0 && r.height > 0 &&
          s.visibility !== "hidden" && s.display !== "none" &&
          text.length > 0 && text.length < 200 &&
          (text.includes("料金") || text.includes("予約") || text.includes("円") || text.includes("確認") || text.includes("合計")) &&
          el.children.length <= 3;
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 80),
          class: el.className?.toString().substring(0, 60),
          rect: { y: Math.round(r.y), h: Math.round(r.height) }
        };
      })
      .filter((v, i, arr) => arr.findIndex(a => a.text === v.text) === i) // dedupe
      .sort((a, b) => a.rect.y - b.rect.y);
  });
  console.log("\n=== 料金/予約/確認 visible 要素 ===");
  visibleElements.forEach(e => console.log(JSON.stringify(e)));

  // Find the "予約する" button and its parent chain
  const reserveBtnParents = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約する" && Array.from(document.querySelectorAll("button")).indexOf(b) === Array.from(document.querySelectorAll("button")).filter(x => x.textContent?.trim() === "予約する").length - 1);
    if (!btn) return "not found";
    const chain = [];
    let el = btn;
    for (let i = 0; i < 10; i++) {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      chain.push({
        tag: el.tagName,
        class: el.className?.toString().substring(0, 60),
        visibility: s.visibility,
        display: s.display,
        opacity: s.opacity,
        h: Math.round(r.height),
        w: Math.round(r.width)
      });
      if (!el.parentElement) break;
      el = el.parentElement;
    }
    return chain;
  });
  console.log("\n=== '予約する' ボタンの親チェーン ===");
  if (Array.isArray(reserveBtnParents)) {
    reserveBtnParents.forEach((p, i) => console.log(`  [${i}] ${JSON.stringify(p)}`));
  } else {
    console.log(reserveBtnParents);
  }

  // Look for any bubble element with "料金を確認" or similar
  const allText = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("*"))
      .filter(el => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && el.children.length === 0;
      })
      .map(el => el.textContent?.trim())
      .filter(t => t && t.length > 1 && t.length < 50)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 100);
  });
  console.log("\n=== 画面上のテキスト（deduped, leaf nodes）===");
  console.log(allText.join(" | "));

  await page.screenshot({ path: "screenshots/debug_booking_form.png" });

  await page.waitForTimeout(30000);
  await browser.close();
})();
