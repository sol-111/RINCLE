// sitemap.xml生成スクリプト
// 使い方: node documents/4_growth/03_seo/sitemap/generate_sitemap.js
// 出力:   documents/4_growth/03_seo/sitemap/sitemap.xml
// 前提:   BubbleのData APIで shop / Bicycle が公開されていること（手順は同フォルダの sitemap-creation-guide.md）
const fs = require("fs");
const path = require("path");

const BASE = "https://rincle.co.jp";
// --dev を付けると開発版（version-test）のData APIで動作確認できる
// ※開発版はテスト用データベースなのでIDが本番と別物。出力は sitemap_devcheck.xml（本番用とは別名）
const DEV = process.argv.includes("--dev");
const API_BASE = DEV ? `${BASE}/version-test` : BASE;
const OUT = path.join(__dirname, DEV ? "sitemap_devcheck.xml" : "sitemap.xml");

// Data APIから1種類ぶん全件取得（1回最大100件なのでcursorを進めながら）
async function fetchAll(type) {
  const all = [];
  let cursor = 0;
  for (;;) {
    const res = await fetch(`${API_BASE}/api/1.1/obj/${type}?limit=100&cursor=${cursor}`);
    if (!res.ok) {
      throw new Error(
        `${type}: HTTP ${res.status} — Data APIの公開チェックが入っているか確認（sitemap-creation-guide.md 手順2-1）`
      );
    }
    const json = await res.json();
    const results = json.response?.results || [];
    all.push(...results);
    if ((json.response?.remaining || 0) <= 0 || results.length === 0) break;
    cursor += results.length;
  }
  return all;
}

// 掲載してよい店舗: 削除されておらず、審査通過（passed）のもの
// （brand_status: passed / in_review / declined。フィールドが無い古いデータは載せる側に倒す）
// ※在庫ゼロの店舗（「レンタル車体準備中」等）も載せる — SEOはページの歴が効くため、
//   入荷前からURLを登録して育てておく（2026-08-21 清野さん判断）
const isLiveShop = (r) => !r.deleted_at && (!r.brand_status || r.brand_status === "passed");

// 掲載してよい自転車: 削除されておらず、アーカイブされておらず、「ユーザー非表示」でないもの
const isLiveBicycle = (r) =>
  !r.deleted_at && r["__is_archive"] !== true && r.rental_status !== "ユーザー非表示";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

(async () => {
  console.log("Data APIから取得中…");
  const [shops, bicycles] = await Promise.all([fetchAll("shop"), fetchAll("bicycle")]);
  const liveShops = shops.filter(isLiveShop);
  const liveShopIds = new Set(liveShops.map((s) => s._id));
  // 掲載しない店舗（審査未通過・削除済み）に属する自転車は、予約できないので載せない
  const liveBicycles = bicycles.filter((b) => isLiveBicycle(b) && b.shop && liveShopIds.has(b.shop));
  const orphan = bicycles.filter((b) => isLiveBicycle(b) && !(b.shop && liveShopIds.has(b.shop))).length;
  console.log(`店舗: 全${shops.length}件 → 掲載${liveShops.length}件（削除済み・審査未通過を除外／在庫ゼロの店舗も載せる）`);
  console.log(`自転車: 全${bicycles.length}件 → 掲載${liveBicycles.length}件（削除・アーカイブ・ユーザー非表示、および掲載しない店舗の${orphan}台を除外）`);

  const urls = [
    { loc: `${BASE}/`, changefreq: "weekly", priority: "1.0", comment: "トップページ" },
    { loc: `${BASE}/search`, changefreq: "daily", priority: "0.9", comment: "検索（条件パラメータなし）" },
    { loc: `${BASE}/legal`, changefreq: "yearly", priority: "0.2", comment: "利用規約・プライバシーポリシー" },
    ...liveShops
      .sort((a, b) => (a._id < b._id ? -1 : 1))
      .map((s) => ({
        loc: `${BASE}/shop_detail?shop=${s._id}`,
        changefreq: "weekly",
        priority: "0.8",
        comment: s.name || "",
      })),
    ...liveBicycles
      .sort((a, b) => (a._id < b._id ? -1 : 1))
      .map((b) => ({
        loc: `${BASE}/bicycle_detail?bicycle=${b._id}`,
        changefreq: "weekly",
        priority: "0.7",
        comment: [b["Brand name"], b.name].filter(Boolean).join("・"),
      })),
  ];

  const today = new Date().toISOString().slice(0, 10);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<!-- RINCLE sitemap.xml（${today}生成 / 静的3 + 店舗${liveShops.length} + 自転車${liveBicycles.length} = ${urls.length} URL） -->\n`;
  xml += `<!-- 作り方・更新方法: documents/4_growth/03_seo/sitemap/sitemap-creation-guide.md -->\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const u of urls) {
    if (u.comment) xml += `  <!-- ${esc(u.comment)} -->\n`;
    xml += `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>\n`;
  }
  xml += `</urlset>\n`;

  fs.writeFileSync(OUT, xml);
  console.log(`生成完了: ${OUT}（合計${urls.length} URL）`);
  console.log("確認: 店舗数・自転車数が本番サイトの検索で見える数とだいたい合っているか見ること");
})().catch((e) => {
  console.error("失敗:", e.message);
  process.exit(1);
});
