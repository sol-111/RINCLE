const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await browser.newPage();

  await page.goto("https://rincle.co.jp/version-5398j", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible" });
  await page.locator('input[type="email"]').fill(process.env.RINCLE_EMAIL);
  await page.locator('input[type="password"]').fill(process.env.RINCLE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 15000 });

  const getVisibleBtns = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter(b => { const r = b.getBoundingClientRect(); const s = window.getComputedStyle(b); return r.width > 0 && r.height > 0 && s.visibility !== "hidden"; })
        .map(b => b.textContent?.trim())
        .filter(t => t && !["今日","消去","Close","keyboard_arrow_left","keyboard_arrow_right"].includes(t))
    );

  // マイページ
  await page.goto("https://rincle.co.jp/version-5398j/index/mypage", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log("=== マイページ ===");
  console.log("URL:", page.url());
  console.log("Btns:", await getVisibleBtns());
  const mypageTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter(el => { const r = el.getBoundingClientRect(); const s = window.getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility === "visible" && el.children.length === 0 && (el.textContent?.trim().length || 0) > 0 && (el.textContent?.trim().length || 0) < 60; })
      .map(el => el.textContent?.trim())
      .filter((t, i, a) => t && a.indexOf(t) === i)
      .slice(0, 20)
  );
  console.log("Texts:", mypageTexts);

  // ガイドページ
  await page.goto("https://rincle.co.jp/version-5398j/index/guide", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log("\n=== ガイドページ ===");
  console.log("URL:", page.url());
  console.log("Btns:", await getVisibleBtns());

  // 料金ページ
  await page.goto("https://rincle.co.jp/version-5398j/index/howtopay", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log("\n=== 料金ページ ===");
  console.log("URL:", page.url());
  console.log("Btns:", await getVisibleBtns());

  // 予約一覧ページ
  await page.goto("https://rincle.co.jp/version-5398j/user_reservation_list", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  console.log("\n=== 予約一覧ページ ===");
  console.log("URL:", page.url());
  console.log("Btns:", await getVisibleBtns());
  const listTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter(el => { const r = el.getBoundingClientRect(); const s = window.getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility === "visible" && el.children.length === 0 && (el.textContent?.trim().length || 0) > 0 && (el.textContent?.trim().length || 0) < 60; })
      .map(el => el.textContent?.trim())
      .filter((t, i, a) => t && a.indexOf(t) === i)
      .slice(0, 30)
  );
  console.log("Texts:", listTexts);

  // ログアウト
  await page.goto("https://rincle.co.jp/version-5398j", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  console.log("\n=== ログアウト ===");
  const logoutBtn = page.getByRole("button", { name: "ログアウト" });
  if (await logoutBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutBtn.first().click();
    await page.waitForTimeout(2000);
    console.log("URL after logout:", page.url());
    console.log("Btns after logout:", await getVisibleBtns());
  } else {
    console.log("ログアウトボタンが見えない");
  }

  await page.waitForTimeout(5000);
  await browser.close();
})();
