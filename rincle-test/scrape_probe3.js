// 自転車一覧タブへの切替+カードDOM構造の確認
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
  await page.waitForTimeout(8000);

  // 「自転車一覧」タブをクリック（clickable-element方式）
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".clickable-element"));
    const el = els.find((e) => e.textContent.trim() === "自転車一覧");
    if (el) el.click();
  });
  await page.waitForTimeout(6000);

  // スクロールして全件ロード
  let prev = -1;
  for (let i = 0; i < 40; i++) {
    const n = await page.getByRole("button", { name: "詳細を見る" }).count();
    if (n === prev && i > 3) break;
    prev = n;
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(1000);
  }
  console.log("DETAIL_BTN_COUNT:", prev);
  const kubun = await page.getByText("メンテナンス中").count();
  console.log("MAINTENANCE_TAGS:", kubun);

  // 1カード分のテキストを取得（取扱店舗ラベルから親を辿る）
  const cardText = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll("*")).find(
      (el) => el.children.length === 0 && el.textContent.trim() === "取扱店舗"
    );
    if (!label) return "NO_LABEL";
    let node = label;
    for (let i = 0; i < 15; i++) {
      node = node.parentElement;
      if (!node) return "NO_CARD";
      if (node.innerText.includes("詳細を見る") && node.innerText.includes("レンタル料金")) break;
    }
    return "TAG=" + node.tagName + " CLASS=" + node.className + "\n---\n" + node.innerText;
  });
  console.log("CARD_TEXT:\n" + cardText);
  await browser.close();
})().catch((e) => { console.error("PROBE_ERROR:", e.message); process.exit(1); });
