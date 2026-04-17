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
  // Try second bike instead
  await page.getByRole("button", { name: "詳細を見る" }).nth(1).click();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1500);
  console.log("✅ 詳細ページ (2番目の自転車)");

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

  // Check SELECT options
  const opts = await page.locator("select").nth(3).evaluate(el =>
    Array.from(el.options).map(o => o.text)
  );
  console.log("SELECT 3 options:", opts);

  if (opts.includes("11:00")) {
    await page.locator("select").nth(3).selectOption({ label: "11:00" });
    await page.waitForTimeout(500);
    await page.locator("select").nth(4).selectOption({ label: "19:00" });
    await page.waitForTimeout(1000);
    console.log("✅ 時刻選択");
  } else {
    console.log("❌ 11:00 が選択肢にない");
    const allOpts = await page.locator("select").nth(3).evaluate(el =>
      Array.from(el.options).map(o => o.text)
    );
    console.log("利用可能な時刻:", allOpts);
  }

  // Check for warnings
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
  console.log("警告:", warnings);

  // Check price estimate
  const priceEl = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("*")).filter(el => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility === "visible" &&
        el.children.length <= 1 && el.textContent?.trim().match(/^[￥¥][0-9,]+円?$/);
    });
    return els.map(el => ({ text: el.textContent?.trim(), y: Math.round(el.getBoundingClientRect().y) }));
  });
  console.log("価格:", priceEl);

  // Check estimate total
  const estimateTotal = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("*")).filter(el => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility === "visible" &&
        el.children.length === 0 && el.textContent?.trim().match(/合計|円/);
    });
    return els.map(el => ({ text: el.textContent?.trim(), y: Math.round(el.getBoundingClientRect().y) }));
  });
  console.log("合計:", estimateTotal.slice(0, 5));

  // Scroll to 予約画面へ進む and try JavaScript click
  const btnHandle = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"))
      .filter(b => b.textContent?.trim() === "予約画面へ進む");
    if (btns.length > 0) {
      const btn = btns[0];
      const r = btn.getBoundingClientRect();
      return { found: true, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, class: btn.className.substring(0, 80) };
    }
    return { found: false };
  });
  console.log("予約画面へ進む button:", btnHandle);

  if (btnHandle.found) {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む");
      if (btn) btn.click();
    });
    console.log("JS click 実行");
    await page.waitForTimeout(5000);

    const popups = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.bubble-element.Popup')).map(el => {
        const s = window.getComputedStyle(el);
        return { class: el.className.substring(0, 60), display: s.display, visibility: s.visibility };
      }).filter(p => p.display !== "none")
    );
    console.log("開いているPopup:", popups);

    const visibleBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter(b => {
          const s = window.getComputedStyle(b);
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && s.visibility === "visible";
        })
        .map(b => b.textContent?.trim())
        .filter(t => t && !["今日","消去","Close","keyboard_arrow_left","keyboard_arrow_right"].includes(t))
    );
    console.log("visible ボタン:", visibleBtns);
  }

  await page.screenshot({ path: "screenshots/debug_btn_click.png" });
  await page.waitForTimeout(25000);
  await browser.close();
})();
