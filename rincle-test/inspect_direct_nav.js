const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();

  // Login first
  await page.goto("https://rincle.co.jp/version-5398j", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(process.env.RINCLE_EMAIL);
  await page.locator('input[type="password"]').fill(process.env.RINCLE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });
  console.log("✅ ログイン");

  // Navigate to bicycle detail and complete full form flow
  // then directly navigate to cart URL candidates
  const BASE = "https://rincle.co.jp/version-5398j";
  const BICYCLE_ID = "1759034684755x353916196529111040";

  // 2026/04/05 11:00 JST = Unix timestamp
  const START_TS = 1774749600000;
  // 2026/04/05 19:00 JST
  const END_TS = 1774778400000;

  const candidates = [
    `${BASE}/index/cart?startDate2=${START_TS}&endDate2=${END_TS}&change=no`,
    `${BASE}/index/cart?bicycle_id=${BICYCLE_ID}&startDate2=${START_TS}&endDate2=${END_TS}&change=no`,
    `${BASE}/index?startDate2=${START_TS}&endDate2=${END_TS}&change=no`,
    `${BASE}/index/cart`,
    `${BASE}/cart`,
  ];

  for (const url of candidates) {
    console.log(`\n→ 試行: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 }).catch(e => console.log("  goto error:", e.message.split("\n")[0]));
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    console.log(`  最終URL: ${finalUrl}`);

    const btns = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter(b => {
          const s = window.getComputedStyle(b);
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && s.visibility === "visible";
        })
        .map(b => b.textContent?.trim())
        .filter(t => t && !["今日","消去","Close","keyboard_arrow_left","keyboard_arrow_right"].includes(t))
    );
    console.log(`  visible ボタン:`, btns.slice(0, 5));

    if (btns.includes("予約する")) {
      console.log("🎉 予約する ボタンを発見！");
      await page.screenshot({ path: `screenshots/direct_nav_found.png` });
      break;
    }
  }

  // Also check the current user's reservation list
  console.log("\n→ 予約一覧ページを確認...");
  await page.goto(`${BASE}/user_reservation_list`, { waitUntil: "networkidle", timeout: 15000 }).catch(e => {});
  await page.waitForTimeout(2000);
  console.log("URL:", page.url());
  const listBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter(b => {
        const s = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && s.visibility === "visible";
      })
      .map(b => b.textContent?.trim())
      .filter(Boolean)
  );
  console.log("visible ボタン:", listBtns.slice(0, 10));
  await page.screenshot({ path: "screenshots/direct_nav_list.png" });

  await page.waitForTimeout(20000);
  await browser.close();
})();
