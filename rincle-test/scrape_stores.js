// 二次パス: 店舗一覧タブの本文テキストから店舗情報（名称・住所・営業時間）を取得
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://rincle.co.jp";
const OUT = path.join(__dirname, "scrape_output", "stores2.json");

function normalize(s) {
  return (s || "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[−－―‐]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  const dd = page.locator("select.bubble-element.Dropdown").first();
  await dd.waitFor({ state: "visible", timeout: 20000 });
  const prefs = (await dd.locator("option").allTextContents()).filter((o) => !o.includes("選択してください"));

  const stores = [];
  for (const pref of prefs) {
    try {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(4000);
      const d = page.locator("select.bubble-element.Dropdown").first();
      await d.waitFor({ state: "visible", timeout: 20000 });
      await d.selectOption({ label: pref });
      await page.waitForTimeout(500);
      await page.locator('input[type="checkbox"]').nth(0).check();
      await page.locator('input[type="checkbox"]').nth(1).check();
      await page.getByRole("button", { name: "検索する" }).click();
      await page.waitForTimeout(8000);

      // 店舗一覧タブ（デフォルト）はスクロールで全件ロード
      for (let i = 0; i < 15; i++) { await page.mouse.wheel(0, 4000); await page.waitForTimeout(600); }

      const lines = await page.evaluate(() =>
        document.body.innerText.split("\n").map((l) => l.trim()).filter(Boolean)
      );
      let count = 0;
      for (let i = 0; i < lines.length; i++) {
        if (/^住所/.test(lines[i]) && i > 0) {
          const name = lines[i - 1];
          const address = normalize(lines[i].replace(/^住所\s*[:：]\s*/, ""));
          let hours = "";
          if (i + 1 < lines.length && /^営業時間/.test(lines[i + 1])) {
            hours = lines[i + 1].replace(/^営業時間\s*[:：]\s*/, "").replace(/^営業時間\s*[:：]\s*/, "").trim();
          }
          stores.push({ pref, name: normalize(name), address, hours });
          count++;
        }
      }
      console.log(`✅ ${pref}: 店舗${count}`);
    } catch (e) {
      console.log(`❌ ${pref}: ${e.message.split("\n")[0]}`);
    }
    fs.writeFileSync(OUT, JSON.stringify(stores, null, 1));
  }
  console.log(`合計店舗カード: ${stores.length}`);
  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
