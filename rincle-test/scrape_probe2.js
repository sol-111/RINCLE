// 検索結果ページのレンダリング確認（待ち時間長め）
const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://rincle.co.jp", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const dd = page.locator("select.bubble-element.Dropdown").first();
  await dd.selectOption({ label: "兵庫県" });
  await page.waitForTimeout(500);
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole("button", { name: "検索する" }).click();

  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(5000);
    const n = await page.getByRole("button", { name: "詳細を見る" }).count();
    const label = await page.getByText("取扱店舗").count();
    console.log(`t=${(i + 1) * 5}s 詳細を見る=${n} 取扱店舗=${label}`);
    if (n > 0) break;
  }
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log("BODY_TEXT_HEAD:\n" + bodyText.replace(/\n{2,}/g, "\n"));
  await browser.close();
})().catch((e) => { console.error("PROBE_ERROR:", e.message); process.exit(1); });
