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

  async function checkSelectOptions() {
    return page.evaluate(() =>
      Array.from(document.querySelectorAll("select")).map((el, i) => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        const options = Array.from(el.options).map(o => ({ value: o.value.substring(0, 30), text: o.text }));
        return {
          i,
          visible: r.width > 0 && r.height > 0 && s.visibility === "visible",
          currentText: el.options[el.selectedIndex]?.text || "",
          totalOptions: options.length,
          options: options.slice(0, 5),
          rect: { y: Math.round(r.y) }
        };
      }).filter(s => s.visible)
    );
  }

  console.log("\n--- 日付選択前 ---");
  (await checkSelectOptions()).forEach(s => console.log(JSON.stringify(s)));

  // Select 貸出日
  const input2 = page.locator("input.picker__input").nth(2);
  const ariaOwns2 = await input2.getAttribute("aria-owns");
  const root2 = page.locator(`#${ariaOwns2}`);
  await input2.click({ force: true });
  await page.waitForTimeout(600);
  for (let i = 0; i < 24; i++) {
    const mt = await root2.locator(".picker__month").textContent();
    const yt = await root2.locator(".picker__year").textContent();
    if (mt?.includes("3月") && yt?.includes("2026")) break;
    await root2.locator(".picker__nav--next").click();
    await page.waitForTimeout(300);
  }
  await root2.locator(".picker__day--infocus").getByText("29", { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await root2.locator(".picker__button--close").click({ force: true });
  await page.waitForTimeout(1000);
  console.log("✅ 貸出日 選択後");
  console.log("\n--- 貸出日選択後 ---");
  (await checkSelectOptions()).forEach(s => console.log(JSON.stringify(s)));

  // Select 返却日
  const input5 = page.locator("input.picker__input").nth(5);
  const ariaOwns5 = await input5.getAttribute("aria-owns");
  const root5 = page.locator(`#${ariaOwns5}`);
  await input5.click({ force: true });
  await page.waitForTimeout(600);
  for (let i = 0; i < 24; i++) {
    const mt = await root5.locator(".picker__month").textContent();
    const yt = await root5.locator(".picker__year").textContent();
    if (mt?.includes("3月") && yt?.includes("2026")) break;
    await root5.locator(".picker__nav--next").click();
    await page.waitForTimeout(300);
  }
  await root5.locator(".picker__day--infocus").getByText("29", { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await root5.locator(".picker__button--close").click({ force: true });
  await page.waitForTimeout(2000);  // Wait for Bubble to react
  console.log("✅ 返却日 選択後");
  console.log("\n--- 返却日選択後 ---");
  (await checkSelectOptions()).forEach(s => console.log(JSON.stringify(s)));

  // Check button state
  const reserveBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).filter(b => b.textContent?.trim() === "予約する");
    return btns.map(b => {
      const s = window.getComputedStyle(b);
      return { visibility: s.visibility, display: s.display };
    });
  });
  console.log("\n=== 予約するボタン状態 ===", reserveBtn);

  await page.screenshot({ path: "screenshots/debug_after_date.png" });

  await page.waitForTimeout(20000);
  await browser.close();
})();
