// 本番サイトの自転車検索がログインなしで動くか+一覧DOM構造の確認プローブ
const { chromium } = require("@playwright/test");

const BASE_URL = "https://rincle.co.jp";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // 都道府県ドロップダウンの選択肢
  const dd = page.locator("select.bubble-element.Dropdown").first();
  await dd.waitFor({ state: "visible", timeout: 15000 });
  const options = await dd.locator("option").allTextContents();
  console.log("PREF_OPTIONS:", JSON.stringify(options));

  // 兵庫県で検索
  await dd.selectOption({ label: "兵庫県" });
  await page.waitForTimeout(500);
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole("button", { name: "検索する" }).click();
  await page.waitForTimeout(5000);

  const allBtn = page.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first();
  const hasAllBtn = await allBtn.isVisible().catch(() => false);
  console.log("ALL_BIKES_BTN_VISIBLE:", hasAllBtn, "URL:", page.url());
  if (hasAllBtn) {
    await allBtn.click();
    await page.waitForTimeout(5000);
  }

  // 一覧を最後までスクロールして全件ロード
  let prev = -1;
  for (let i = 0; i < 30; i++) {
    const n = await page.getByRole("button", { name: "詳細を見る" }).count();
    if (n === prev && i > 2) break;
    prev = n;
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(1200);
  }
  console.log("DETAIL_BTN_COUNT:", prev, "URL:", page.url());

  // カードの構造: 「取扱店舗」ラベルを含むカード先頭要素のHTMLを1枚分ダンプ
  const cardHtml = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll("*")).find(
      (el) => el.children.length === 0 && el.textContent.trim() === "取扱店舗"
    );
    if (!label) return "NO_LABEL";
    let node = label;
    for (let i = 0; i < 12; i++) {
      node = node.parentElement;
      if (!node) return "NO_CARD";
      if (node.textContent.includes("詳細を見る") && node.textContent.includes("レンタル料金")) break;
    }
    return node.outerHTML.slice(0, 6000);
  });
  console.log("CARD_HTML_HEAD:\n" + cardHtml);

  await browser.close();
})().catch((e) => { console.error("PROBE_ERROR:", e.message); process.exit(1); });
