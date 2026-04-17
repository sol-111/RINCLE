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
  console.log("✅ 詳細ページ（日時選択前）");

  // Inspect ALL input/select/dropdown/button visible elements in booking form area
  const formElements = await page.evaluate(() => {
    const interactiveEls = Array.from(document.querySelectorAll(
      "input:not([type=hidden]), select, textarea, button, [role=button], [role=combobox], [role=listbox]"
    ));
    return interactiveEls.map(el => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        type: el.getAttribute("type") || "",
        role: el.getAttribute("role") || "",
        class: el.className?.toString().substring(0, 60),
        text: el.textContent?.trim().substring(0, 50) || el.value || el.placeholder || "",
        visible: r.width > 0 && r.height > 0,
        visibility: s.visibility,
        display: s.display,
        rect: { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) }
      };
    }).filter(el => el.visible);
  });
  console.log("\n=== 可視インタラクティブ要素 ===");
  formElements.forEach(e => console.log(JSON.stringify(e)));

  // Look specifically at quantity/counter elements (数量, 台数)
  const allVisible = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("*"))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        const text = el.textContent?.trim() || "";
        return r.width > 0 && r.height > 0 &&
          s.visibility !== "hidden" &&
          el.children.length <= 2 &&
          text.length > 0 && text.length < 30 &&
          (text.match(/台|個|枚|数|quantity|count/i) || text.match(/^[0-9]+$/));
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, text: el.textContent?.trim(), class: el.className?.toString().substring(0, 50), y: Math.round(r.y) };
      });
  });
  console.log("\n=== 数量関連 ===");
  allVisible.forEach(e => console.log(JSON.stringify(e)));

  // Time picker footer structure
  const timeInput = page.locator("input.time_div.picker__input").nth(0);
  await timeInput.click({ force: true });
  await page.waitForTimeout(500);
  const ariaOwns = await timeInput.getAttribute("aria-owns");
  const timeRoot = page.locator(`#${ariaOwns}`);
  const timePickerHtml = await timeRoot.evaluate(el => el.innerHTML.substring(0, 2000));
  console.log("\n=== Time picker HTML (先頭2000文字) ===");
  console.log(timePickerHtml);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  await page.screenshot({ path: "screenshots/debug_form.png" });

  await page.waitForTimeout(25000);
  await browser.close();
})();
