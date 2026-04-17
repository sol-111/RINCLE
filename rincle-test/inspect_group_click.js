const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  // Monitor ALL network requests
  const requests = [];
  page.on("request", req => {
    requests.push({ method: req.method(), url: req.url().substring(0, 120) });
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
  await page.waitForTimeout(500);
  await page.locator("select").nth(3).selectOption({ label: "11:00" });
  await page.waitForTimeout(500);
  await page.locator("select").nth(4).selectOption({ label: "19:00" });
  await page.waitForTimeout(1000);

  // Scroll button into view
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(500);

  // Get full class of parent group
  const groupInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "予約画面へ進む"
    );
    if (!btn) return null;
    const parent = btn.parentElement;
    const grandparent = parent?.parentElement;
    return {
      btnClass: btn.className,
      parentClass: parent?.className,
      parentTag: parent?.tagName,
      grandparentClass: grandparent?.className,
      grandparentTag: grandparent?.tagName
    };
  });
  console.log("親要素情報:", JSON.stringify(groupInfo));

  // Try clicking the clickable-element GROUP (not the button)
  requests.length = 0;
  console.log("\n→ clickable-element グループをクリック...");
  const clickableGroup = page.locator(".clickable-element.bubble-element").filter({ hasText: "予約画面へ進む" }).first();
  const count = await clickableGroup.count();
  console.log("マッチ数:", count);

  if (count > 0) {
    await clickableGroup.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await clickableGroup.click({ timeout: 5000 });
    await page.waitForTimeout(5000);
    console.log("クリック後URL:", page.url());
    console.log("リクエスト数:", requests.length);
    requests.forEach(r => console.log(`  ${r.method} ${r.url}`));
  }

  // If still no navigation, try force-clicking the group
  if (requests.length === 0 && !page.url().includes("cart")) {
    console.log("\n→ force: true でクリック...");
    requests.length = 0;
    await page.locator(".clickable-element.bubble-element").filter({ hasText: "予約画面へ進む" }).first().click({ force: true, timeout: 5000 });
    await page.waitForTimeout(5000);
    console.log("force後URL:", page.url());
    console.log("リクエスト数:", requests.length);
    requests.forEach(r => console.log(`  ${r.method} ${r.url}`));
  }

  await page.screenshot({ path: "screenshots/debug_group.png" });
  await page.waitForTimeout(25000);
  await browser.close();
})();
