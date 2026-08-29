import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

// ============================================================================
// 店舗管理E2E（新アプリ・version-43erq 対応版 2026-07-13）
// 旧アプリ版（version-5398j/shop_admin_login）から全面書き換え。
//
// 新アプリの店舗管理の構造（実地調査 2026-07-13）:
//   - ログイン: /admin_signin?role=shop&mode=sign_in → 成功で /admin/reservation?role=shop
//   - サイドナビ: 予約一覧 / 売上レポート / 顧客一覧 / 自転車一覧 / オプション管理 /
//                 営業時間設定 / 営業カレンダー / 店舗情報 / お問い合わせ一覧 / 設定
//   - 各セクションURL: /admin/{reservation|bicycle|option|business_hour|calendar|shop_info}?role=shop
//   - 自転車一覧の各行: 「ユーザー表示/非表示」ドロップダウン（bicycle.rental_status に
//     auto-binding・即時保存）+「在庫設定」ボタン
//
// テストアカウントの店舗: RINCLE 千葉柏店/オンザロード柏店（.env の STORE_EMAIL・旧SEINO自転車）
// 共有開発環境のため、データを変更するテストは必ず finally で復元する。
// ============================================================================

const BASE_URL = process.env.RINCLE_BASE_URL || "https://rincle.co.jp/version-43erq";
const STORE_EMAIL    = process.env.STORE_EMAIL!;
const STORE_PASSWORD = process.env.STORE_PASSWORD!;
// 統合テスト（非表示⇄ユーザー検索）用: 店舗所在地の都道府県コード
// 【2026-08実測】テスト店舗のフィクスチャは7/16-17に再作成された（店舗名は SEINO自転車 →
// 「RINCLE 千葉柏店/オンザロード柏店」・栃木県→千葉県）。都道府県コードは千葉=12。
const SHOP_PREF_CODE = process.env.STORE_PREF_CODE || "12";
// テスト店舗の自転車（「ちゃんとしたロードバイク」）。作り直した場合は .env の TEST_BIKE_ID で上書き
const TEST_BIKE_URL = `${BASE_URL}/bicycle_detail?bicycle=${process.env.TEST_BIKE_ID || "1784370816467x497983313811946050"}`;

async function freshenIfStale(page: Page): Promise<boolean> {
  const stale = await page.getByText("アプリが更新されました").first().isVisible().catch(() => false);
  if (!stale) return false;
  console.log("⚠️ アプリ更新バナーを検出 → リロード");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return true;
}

// 店舗ログイン。成功判定はサイドナビ「自転車一覧」の表示。
async function storeLogin(page: Page) {
  // 一時的なネットワーク断（ERR_NETWORK_CHANGED等）にも耐えるよう試行全体をtryで包む
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/admin_signin?role=shop&mode=sign_in`, { waitUntil: "domcontentloaded" });
      await freshenIfStale(page);
      await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 20000 });
      await page.locator('input[type="email"]').first().fill(STORE_EMAIL);
      await page.locator('input[type="password"]').first().fill(STORE_PASSWORD);
      await page.getByRole("button", { name: /ログイン/ }).first().click();
      await page.waitForURL(/\/admin\//, { timeout: 15000 });
      await page.getByText("自転車一覧").first().waitFor({ state: "visible", timeout: 15000 });
      return;
    } catch (e) {
      console.log(`⚠️ ログイン試行${attempt + 1}回目失敗: ${String(e).split("\n")[0]}`);
      await page.waitForTimeout(3000);
    }
  }
  throw new Error("店舗ログインに失敗しました（/admin_signin?role=shop 経由・3回試行）");
}

async function gotoSection(page: Page, path: string) {
  await page.goto(`${BASE_URL}/admin/${path}?role=shop`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await freshenIfStale(page);
}

// 自転車一覧の先頭行を読む（select=ユーザー表示/非表示 の祖先を「在庫設定」を含むまで遡る）
async function firstBikeRow(page: Page): Promise<{ name: string; status: string }> {
  return page.evaluate(() => {
    const sel = document.querySelector("select") as HTMLSelectElement | null;
    if (!sel) return { name: "", status: "" };
    // selectの直近親はセル（ユーザー表示/非表示+在庫設定のみ）なので、
    // 行全体（No/種別/ブランド名/名称/…を含む8行以上のブロック）まで遡る
    let node: HTMLElement | null = sel;
    let lines: string[] = [];
    for (let i = 0; i < 10 && node; i++) {
      node = node.parentElement;
      if (!node) break;
      lines = (node.innerText || "").split("\n").map(s => s.trim()).filter(Boolean);
      if (lines.length >= 8 && (node.innerText || "").includes("在庫設定")
          && !(node.innerText || "").includes("バイクの名称")) break; // ヘッダ行まで上がりすぎない
    }
    // 行の構造: [No, 種別, ブランド名, 名称, サイズ, カラー, シリアル, （select群）, 在庫設定]
    return { name: lines[3] || "", status: (sel.selectedOptions[0]?.textContent || "").trim() };
  });
}

// ユーザー側の検索一覧で自転車名が見えるかを判定
// 【2026-08 UI刷新】検索結果はタブ切替式になり mode=bicycle で自転車一覧を直接開ける
// （旧「貸出可能な自転車をすべて見る」ボタンは廃止）
async function bikeVisibleInUserSearch(page: Page, bikeName: string): Promise<boolean> {
  await page.goto(`${BASE_URL}/search?pref=${SHOP_PREF_CODE}&init=yes&mode=bicycle`,
    { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  let text = await page.evaluate(() => document.body.innerText);
  if (!text.includes(bikeName)) {
    // まだ店舗一覧モードの場合は「自転車一覧」タブへ切替えて再判定
    await page.getByText("自転車一覧", { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(3000);
    text = await page.evaluate(() => document.body.innerText);
  }
  return text.includes(bikeName);
}

test.describe("RINCLE 店舗管理E2E", () => {

  test("店舗ログイン", async ({ page }) => {
    await storeLogin(page);
    for (const nav of ["予約一覧", "自転車一覧", "オプション管理", "営業時間設定", "営業カレンダー", "店舗情報"]) {
      await expect(page.getByText(nav, { exact: true }).first(), `サイドナビ「${nav}」がありません`).toBeVisible();
    }
    console.log("✅ 店舗ログイン完了（サイドナビ6項目確認）");
  });

  test("予約一覧", async ({ page }) => {
    await storeLogin(page);
    await gotoSection(page, "reservation");
    await expect(page.getByText(/予約一覧（\d+）/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("CSVダウンロード").first()).toBeVisible();
    await expect(page.getByText("過去の予約").first()).toBeVisible();
    console.log("✅ 店舗の予約一覧表示確認完了");
  });

  test("自転車一覧", async ({ page }) => {
    await storeLogin(page);
    await gotoSection(page, "bicycle");
    for (const h of ["種別", "ブランド名", "バイクの名称", "ステータス"]) {
      await expect(page.getByText(h, { exact: true }).first(), `一覧ヘッダ「${h}」がありません`).toBeVisible({ timeout: 15000 });
    }
    const row = await firstBikeRow(page);
    expect(row.name, "自転車一覧に1台も表示されていません（テスト店舗には最低1台必要）").toBeTruthy();
    expect(["ユーザー表示", "ユーザー非表示"], "ステータスの現在値が不正").toContain(row.status);
    await expect(page.getByRole("button", { name: "在庫設定" }).first()).toBeVisible();
    console.log(`✅ 自転車一覧確認完了（1台目: ${row.name} / ${row.status}）`);
  });

  // --------------------------------------------------------------------------
  // 【統合・回帰②】非表示切替がユーザー検索に反映されるか
  // 増永さん報告（7/13）: 非表示にしても表示される。
  // 原因特定済み: search/shop_detailページの自転車Searchに rental_status 制約がない
  //  （E2E_STATUS_20260713.md「増永さん報告バグの切り分け」参照）。
  // 修正されるまでこのテストは fail する（正検出）。データは finally で必ず復元。
  // --------------------------------------------------------------------------
  test("非表示切替のユーザー反映（統合・回帰）", async ({ page, browser }) => {
    test.setTimeout(180000);
    await storeLogin(page);
    await gotoSection(page, "bicycle");
    // 【2026-08実測】一覧行の描画・selectの値バインドが遅れることがある
    // → 先頭行のステータスがプレースホルダ（ユーザー表示/非表示）でなくなるまで待つ
    let row = await firstBikeRow(page);
    for (let i = 0; i < 8 && !(row.name && row.status && row.status !== "ユーザー表示/非表示"); i++) {
      await page.waitForTimeout(3000);
      row = await firstBikeRow(page);
    }
    expect(row.name, "対象自転車が見つかりません").toBeTruthy();
    expect(row.status, "前提: テスト開始時はユーザー表示であること").toBe("ユーザー表示");

    // 【2026-08実測】店舗ログイン中のセッションでユーザー向けページを開くと描画が変わるため、
    // ユーザー側の確認は未ログインの別コンテキストで行う（テスト終了時に自動で閉じる）
    const userPage = await (await browser.newContext()).newPage();

    // 事前確認: 表示状態ではユーザー検索に出ている
    const visibleBefore = await bikeVisibleInUserSearch(userPage, row.name);
    expect(visibleBefore, `前提: ユーザー表示状態の「${row.name}」が検索に出ていません`).toBe(true);

    try {
      // 非表示へ切替（auto-binding・即時保存）→ リロードで保存を確認
      await gotoSection(page, "bicycle");
      await page.locator("select").first().selectOption({ label: "ユーザー非表示" });
      await page.waitForTimeout(3000);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5000);
      const after = await firstBikeRow(page);
      expect(after.status, "非表示への切替が保存されていません（店舗管理側の問題）").toBe("ユーザー非表示");
      console.log("✅ 店舗管理側: ユーザー非表示への切替・保存を確認");

      // ユーザー側検索から消えること（現状バグ②で fail する想定＝正検出）
      const visibleAfter = await bikeVisibleInUserSearch(userPage, row.name);
      expect(visibleAfter,
        `「${row.name}」を非表示にしたのにユーザー検索に表示されています（バグ②: searchページのSearchにrental_status制約がない）`
      ).toBe(false);
      console.log("✅ ユーザー検索から非表示を確認（バグ②修正済み）");
    } finally {
      // 必ずユーザー表示へ復元
      await gotoSection(page, "bicycle");
      await page.locator("select").first().selectOption({ label: "ユーザー表示" }).catch(() => {});
      await page.waitForTimeout(3000);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5000);
      const restored = await firstBikeRow(page);
      console.log(restored.status === "ユーザー表示"
        ? "🧹 復元OK: ユーザー表示に戻しました"
        : `⚠️ 復元失敗: 現在値=${restored.status}。手動で戻してください`);
    }
  });

  test("オプション管理", async ({ page }) => {
    await storeLogin(page);
    await gotoSection(page, "option");
    await expect(page.getByText("オプション設定").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("新規登録").first()).toBeVisible();
    await expect(page.getByText("在庫管理").first()).toBeVisible();
    console.log("✅ オプション管理表示確認完了");
  });

  // --------------------------------------------------------------------------
  // 【統合】オプションのライフサイクル: 作成 → ユーザー側表示 → アーカイブ → 両側から消える
  // 増永さん報告③（オプション在庫・紐づき）の周辺を回帰カバー（7/13手動検証の自動化）。
  // 在庫の減算/復元（予約が必要）は rincle-integration.e2e.ts 側の予約系と別掛かりのため、
  // ここでは予約を作らない範囲（作成〜表示〜アーカイブ）を検証する。
  // --------------------------------------------------------------------------
  test("オプションライフサイクル（作成→ユーザー表示→アーカイブ）", async ({ page, browser }) => {
    test.setTimeout(240000);
    const optName = `E2E自動テスト用オプション_${Date.now()}`;
    let created = false;
    // 【2026-08実測】店舗ログイン中のセッションでユーザー向けページを開くと描画が変わるため、
    // ユーザー側の確認は未ログインの別コンテキストで行う（テスト終了時に自動で閉じる）
    const userPage = await (await browser.newContext()).newPage();

    await storeLogin(page);
    try {
      // --- 作成 ---
      await gotoSection(page, "option");
      await page.getByText("新規登録").first().click();
      await page.waitForTimeout(4000);
      const vis = page.locator("input:visible, textarea:visible");
      // フォーム構造（2026-07-13実測）: [0]=名称 [1]=数量 [2]=説明 [3..11]=各プラン料金 [12]=税率
      await vis.nth(0).fill(optName);
      await vis.nth(1).fill("2");
      await vis.nth(2).fill("E2E自動テスト用。テスト内で必ずアーカイブされます");
      for (let i = 3; i <= 11; i++) await vis.nth(i).fill("100");
      await vis.nth(12).fill("10");
      // 適用する自転車 → 全ての自転車に適用（個別クリックは効かないことを実測済み）
      await page.getByText("追加", { exact: true }).first().click();
      await page.waitForTimeout(3000);
      await page.getByText("全ての自転車に適用する").first().click();
      await page.waitForTimeout(3000);
      await page.getByRole("button", { name: "登録する" }).locator("visible=true").first().click();
      await page.waitForTimeout(6000);
      await expect(page.getByText(optName).first(), "登録したオプションが一覧に出ません").toBeVisible({ timeout: 15000 });
      created = true;
      console.log(`✅ オプション作成完了: ${optName}`);

      // --- ユーザー側の自転車詳細に表示されること（未ログインで閲覧可） ---
      await userPage.goto(TEST_BIKE_URL, { waitUntil: "domcontentloaded" });
      await userPage.waitForTimeout(10000);
      const userSide = await userPage.evaluate(() => document.body.innerText);
      expect(userSide.includes(optName),
        "作成したオプションがユーザー側の自転車詳細（オプションを選択）に表示されません").toBe(true);
      console.log("✅ ユーザー側の自転車詳細にオプション表示を確認");
    } finally {
      if (created) {
        // --- アーカイブ（削除の実体）して後始末 ---
        await storeLogin(page);
        await gotoSection(page, "option");
        await page.getByText(optName).first().click();
        await page.waitForTimeout(4000);
        await page.getByRole("button", { name: "削除する" }).locator("visible=true").first().click();
        await page.waitForTimeout(3000);
        await page.getByRole("button", { name: "アーカイブする" }).locator("visible=true").first().click();
        await page.waitForTimeout(5000);
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(6000);
        const gone = !(await page.evaluate(() => document.body.innerText)).includes(optName);
        console.log(gone ? "🧹 アーカイブ完了（店舗一覧から消えました）"
                         : `⚠️ アーカイブ失敗: 「${optName}」を手動で削除してください`);
        if (gone) {
          // ユーザー側からも消えていること
          await userPage.goto(TEST_BIKE_URL, { waitUntil: "domcontentloaded" });
          await userPage.waitForTimeout(10000);
          const stillShown = (await userPage.evaluate(() => document.body.innerText)).includes(optName);
          expect(stillShown, "アーカイブしたオプションがユーザー側にまだ表示されています").toBe(false);
          console.log("✅ アーカイブ後、ユーザー側からも消えたことを確認");
        }
      }
    }
  });

  test("営業時間設定", async ({ page }) => {
    await storeLogin(page);
    await gotoSection(page, "business_hour");
    await expect(page.getByText("営業時間設定").first()).toBeVisible({ timeout: 15000 });
    for (const d of ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"]) {
      await expect(page.getByText(d, { exact: true }).first(), `曜日「${d}」の行がありません`).toBeVisible();
    }
    console.log("✅ 営業時間設定（曜日別）表示確認完了");
  });

  test("営業カレンダー", async ({ page }) => {
    await storeLogin(page);
    await gotoSection(page, "calendar");
    await expect(page.getByText("営業カレンダー").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/\d{4}年\d{1,2}月/).first(), "カレンダーの年月表示がありません").toBeVisible();
    // 日別セルに「休業」または時間帯（HH:MM 〜 HH:MM）が出ていること
    const text = await page.evaluate(() => document.body.innerText);
    expect(/休業|\d{2}:\d{2}\s*〜\s*\d{2}:\d{2}/.test(text), "日別の営業時間/休業表示がありません").toBe(true);
    console.log("✅ 営業カレンダー（日別）表示確認完了");
  });

  test("店舗情報", async ({ page }) => {
    await storeLogin(page);
    await gotoSection(page, "shop_info");
    await expect(page.getByText("施設情報").first()).toBeVisible({ timeout: 15000 });
    const shopName = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      return inputs.map(i => i.value).find(v => v && v.length > 1 && v.length < 40) || "";
    });
    expect(shopName, "店舗情報のフォームに値が入っていません").toBeTruthy();
    console.log(`✅ 店舗情報表示確認完了（先頭入力値: ${shopName}）`);
  });

  test("店舗ログアウト", async ({ page }) => {
    await storeLogin(page);
    await page.getByText("ログアウト", { exact: true }).first().click();
    await page.waitForTimeout(5000);
    const stillIn = await page.getByText("自転車一覧", { exact: true }).first().isVisible().catch(() => false);
    expect(stillIn, "ログアウト後も管理画面が表示されています").toBe(false);
    console.log("✅ 店舗ログアウト完了");
  });
});
