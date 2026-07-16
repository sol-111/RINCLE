// rincle.co.jp 本番サイトから全都道府県の自転車情報+店舗情報を取得するスクレイパー
// 使い方: node scrape_all_prefs.js
// 出力: scrape_output/bikes.json, stores.json（都道府県ごとに追記保存）
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://rincle.co.jp";
const OUT_DIR = path.join(__dirname, "scrape_output");
fs.mkdirSync(OUT_DIR, { recursive: true });

// 全角数字・全角ダッシュ・全角チルダをASCIIへ正規化
function normalize(s) {
  return (s || "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[−－―ー‐]/g, "-")
    .replace(/[〜～]/g, "~")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(s) {
  const m = (s || "").replace(/[，,]/g, "").match(/(\d+)/);
  return m ? m[1] : "";
}

// カードのinnerText行配列 → レコード
function parseCard(lines) {
  const rec = {
    brand: "", model: "", ebike: "", status: "貸出可能",
    store: "", address: "", type: "", size: "",
    p3h: "", p1d: "", p2d: "", p3d: "", p7d: "", p14d: "", p30d: "",
    note: [],
  };
  const idxStore = lines.findIndex((l) => l === "取扱店舗");
  const idxType = lines.findIndex((l) => l === "種別");
  const idxSize = lines.findIndex((l) => l === "サイズ");
  const idxPrice = lines.findIndex((l) => l === "レンタル料金");

  // タイトル・タグ（取扱店舗より前の行）
  for (const l of lines.slice(0, idxStore >= 0 ? idxStore : 3)) {
    if (l === "e-bike") rec.ebike = "e-bike";
    else if (l === "メンテナンス中") rec.status = "メンテナンス中";
    else if (l === "詳細を見る") continue;
    else if (l.includes("・") && !rec.model) {
      const m = l.match(/^(.*?)\s*・\s*(.*)$/);
      if (m) { rec.brand = m[1].trim(); rec.model = m[2].trim(); }
    }
  }
  if (idxStore >= 0 && idxType > idxStore) {
    const seg = lines.slice(idxStore + 1, idxType);
    rec.address = normalize(seg[seg.length - 1] || "");
    rec.store = normalize(seg.slice(0, -1).join(" "));
  }
  if (idxType >= 0) rec.type = lines[idxType + 1] || "";
  if (idxSize >= 0) rec.size = normalize(lines[idxSize + 1] || "");
  if (idxPrice >= 0) {
    for (let i = idxPrice + 1; i < lines.length - 1; i++) {
      const label = normalize(lines[i]);
      const val = lines[i + 1] || "";
      if (!/円/.test(val)) continue;
      const price = parsePrice(val);
      if (/^~?3時間$/.test(label)) rec.p3h = price;
      else if (/^1日$/.test(label)) rec.p1d = price;
      else if (/^~?2日間$/.test(label)) rec.p2d = price;
      else if (/^~?3日間$/.test(label)) rec.p3d = price;
      else if (/^~?7日間$/.test(label)) rec.p7d = price;
      else if (/^~?14日間$/.test(label)) rec.p14d = price;
      else if (/^~?30日間$/.test(label)) rec.p30d = price;
      else rec.note.push(`${label} ¥${price}`); // 〜10日間などの変則枠
      i++;
    }
  }
  rec.note = rec.note.join(" / ");
  return rec;
}

async function searchPref(page, pref) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  const dd = page.locator("select.bubble-element.Dropdown").first();
  await dd.waitFor({ state: "visible", timeout: 20000 });
  await dd.selectOption({ label: pref });
  await page.waitForTimeout(500);
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole("button", { name: "検索する" }).click();
  await page.waitForTimeout(8000);
}

// 店舗一覧タブ（デフォルト表示）から店舗情報を取得
async function extractStores(page) {
  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll(".bubble-element"))
      .filter((el) => el.className.includes("group-item"))
      .filter((el) => {
        const t = el.innerText || "";
        return t.includes("住所") && t.includes("営業時間");
      });
    const innermost = cells.filter((c) => !cells.some((o) => o !== c && c.contains(o)));
    return innermost.map((el) => el.innerText.split("\n").map((l) => l.trim()).filter(Boolean));
  });
}

async function extractBikes(page) {
  // 自転車一覧タブへ切替
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".clickable-element"));
    const el = els.find((e) => e.textContent.trim() === "自転車一覧");
    if (el) el.click();
  });
  await page.waitForTimeout(6000);

  // スクロールして全件ロード
  let prev = -1;
  for (let i = 0; i < 60; i++) {
    const n = await page.getByRole("button", { name: "詳細を見る" }).count();
    if (n === prev && i > 3) break;
    prev = n;
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(1000);
  }

  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll(".bubble-element"))
      .filter((el) => el.className.includes("group-item"))
      .filter((el) => {
        const t = el.innerText || "";
        return t.includes("取扱店舗") && t.includes("レンタル料金") && t.includes("詳細を見る") && /・/.test(t);
      });
    const innermost = cells.filter((c) => !cells.some((o) => o !== c && c.contains(o)));
    return innermost.map((el) => el.innerText.split("\n").map((l) => l.trim()).filter(Boolean));
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 都道府県リスト取得
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  const dd = page.locator("select.bubble-element.Dropdown").first();
  await dd.waitFor({ state: "visible", timeout: 20000 });
  const prefs = (await dd.locator("option").allTextContents()).filter((o) => !o.includes("選択してください"));
  console.log(`対象都道府県: ${prefs.length}件 — ${prefs.join(", ")}`);

  const allBikes = [];
  const allStores = [];
  for (const pref of prefs) {
    try {
      await searchPref(page, pref);
      const storeRaw = await extractStores(page);
      const bikeRaw = await extractBikes(page);
      const bikes = bikeRaw.map((lines) => ({ pref, ...parseCard(lines) }));
      allBikes.push(...bikes);
      allStores.push(...storeRaw.map((lines) => ({ pref, lines })));
      const maint = bikes.filter((b) => b.status === "メンテナンス中").length;
      console.log(`✅ ${pref}: 店舗${storeRaw.length} / 自転車${bikes.length}（うちメンテ中${maint}）`);
    } catch (e) {
      console.log(`❌ ${pref}: ${e.message.split("\n")[0]}`);
    }
    // 途中経過を毎回保存（失敗しても部分データが残る）
    fs.writeFileSync(path.join(OUT_DIR, "bikes.json"), JSON.stringify(allBikes, null, 1));
    fs.writeFileSync(path.join(OUT_DIR, "stores.json"), JSON.stringify(allStores, null, 1));
  }

  console.log(`\n合計: 自転車${allBikes.length}台 / 店舗カード${allStores.length}件`);
  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
