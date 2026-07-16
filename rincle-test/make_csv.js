// bikes.json / stores2.json → 自転車情報_全国.csv / 店舗別台数_全国.csv
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.resolve(__dirname, "..");
const bikes = require("./scrape_output/bikes.json");

// bikes.jsonの正規化バグ修復: カタカナ直後の "-" は長音「ー」だったもの
function fixChoon(s) {
  return String(s ?? "").replace(/([ァ-ヶ])-/g, "$1ー");
}

function esc(v) {
  v = String(v ?? "");
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function toCsv(rows) {
  return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

// --- 自転車情報 ---
const bikeHeader = ["都道府県","ブランド","モデル","e-bike","ステータス","取扱店舗","住所","種別","サイズ","料金_3時間","料金_1日","料金_2日間","料金_3日間","料金_7日間","料金_14日間","料金_30日間","備考"];
const bikeRows = bikes.map((b) => [b.pref,b.brand,b.model,b.ebike,b.status,fixChoon(b.store),fixChoon(b.address),b.type,fixChoon(b.size),b.p3h,b.p1d,b.p2d,b.p3d,b.p7d,b.p14d,b.p30d,b.note]);
fs.writeFileSync(path.join(OUT_DIR, "自転車情報_全国.csv"), toCsv([bikeHeader, ...bikeRows]));
console.log(`自転車情報_全国.csv: ${bikeRows.length}件`);

// --- 店舗別台数 ---
const storeMap = new Map();
for (const b of bikes) {
  const key = b.pref + "|" + fixChoon(b.store);
  if (!storeMap.has(key)) storeMap.set(key, { pref: b.pref, store: fixChoon(b.store), address: fixChoon(b.address), total: 0, maint: 0 });
  const s = storeMap.get(key);
  s.total++;
  if (b.status === "メンテナンス中") s.maint++;
}

// 店舗一覧タブ由来の店舗カード（自転車0台の店舗もここで拾う）
let hoursMap = new Map();
const stores2Path = path.join(__dirname, "scrape_output", "stores2.json");
if (fs.existsSync(stores2Path)) {
  for (const s of JSON.parse(fs.readFileSync(stores2Path, "utf8"))) {
    const key = s.pref + "|" + s.name;
    hoursMap.set(key, s.hours);
    if (!storeMap.has(key)) storeMap.set(key, { pref: s.pref, store: s.name, address: s.address, total: 0, maint: 0 });
  }
}

const storeHeader = ["都道府県","店舗","住所","営業時間","台数","うちメンテナンス中"];
const storeRows = [...storeMap.values()]
  .sort((a, b) => b.total - a.total)
  .map((s) => [s.pref, s.store, s.address, hoursMap.get(s.pref + "|" + s.store) || "", s.total, s.maint || ""]);
fs.writeFileSync(path.join(OUT_DIR, "店舗別台数_全国.csv"), toCsv([storeHeader, ...storeRows]));
console.log(`店舗別台数_全国.csv: ${storeRows.length}店舗（営業時間あり: ${storeRows.filter((r) => r[3]).length}）`);
